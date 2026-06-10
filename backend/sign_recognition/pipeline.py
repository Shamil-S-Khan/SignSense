from __future__ import annotations

import io
import logging
import threading
import time
import os
import re
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
import numpy as np

from config import settings
from .types import PredictionResult
from .asl_citizen_model import DualStreamASL
from .i3d.model import I3DSignRecognitionModel

logger = logging.getLogger("sign_recognition")


def _load_labels(path: str, limit: int) -> list[str]:
    labels_path = Path(path)
    if not labels_path.exists():
        raise FileNotFoundError(f"Labels file not found: {labels_path}")

    labels: list[str] = []
    with labels_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            parts = line.strip().split("\t")
            if len(parts) != 2:
                continue
            labels.append(parts[1].strip().upper())
            if len(labels) == limit:
                break

    if len(labels) != limit:
        raise ValueError(f"Expected {limit} labels, found {len(labels)}")
    return labels


def _decode_jpeg(data: bytes, size: int) -> torch.Tensor:
    """Decode a JPEG byte string to a float32 tensor of shape [3, size, size] in [-1, 1]."""
    img = Image.open(io.BytesIO(data)).convert("RGB").resize((size, size), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)  # [H, W, 3]
    arr = (arr / 127.5) - 1.0             # normalise to [-1, 1]
    return torch.from_numpy(arr).permute(2, 0, 1)  # [3, H, W]


def _sample_frames(frames: list[bytes], num_frames: int) -> list[bytes]:
    """Uniformly sample or pad `frames` to exactly `num_frames`."""
    n = len(frames)
    if n == num_frames:
        return frames
    if n > num_frames:
        indices = [int(i * n / num_frames) for i in range(num_frames)]
        return [frames[i] for i in indices]
    # Pad by repeating the last frame
    return frames + [frames[-1]] * (num_frames - n)


class SignRecognitionPipeline:
    def __init__(self):
        self._lock = threading.Lock()
        self._loaded = False
        self._labels: list[str] = []
        self._is_dual_stream = False
        self._model = None
        self._detector_hand = None
        self._detector_pose = None
        self.device = torch.device(settings.SIGN_RECOGNITION_DEVICE if torch.cuda.is_available() else "cpu")

    def load(self) -> None:
        if self._loaded:
            return

        weights_path = Path(settings.SIGN_RECOGNITION_MODEL_WEIGHTS_PATH)
        if not weights_path.exists():
            raise FileNotFoundError(f"Weights not found: {weights_path}")

        logger.info("Loading checkpoint metadata from: %s", weights_path)
        checkpoint = torch.load(weights_path, map_location="cpu")

        # Determine architecture from checkpoint keys
        state_dict = checkpoint.get("model_state", checkpoint)
        if all(k.startswith("module.") for k in state_dict.keys()):
            state_dict = {k[len("module."):]: v for k, v in state_dict.items()}

        is_dual = any(k.startswith("rgb_stream") for k in state_dict.keys()) and any(k.startswith("pose_stream") for k in state_dict.keys())

        if is_dual:
            logger.info("Detected ASL Citizen Dual-Stream model architecture.")
            self._is_dual_stream = True

            # Extract number of classes from classifier head shape or config
            num_classes = state_dict["classifier.weight"].shape[0]
            logger.info("Building DualStreamASL model (num_classes=%d)", num_classes)
            
            # Build Dual-Stream architecture
            model = DualStreamASL(num_classes=num_classes)
            model.load_state_dict(state_dict, strict=True)
            model.to(self.device).eval()
            self._model = model

            # Auto-load labels from checkpoint's idx2gloss if present
            if "idx2gloss" in checkpoint:
                idx2gloss = checkpoint["idx2gloss"]
                self._labels = [idx2gloss[i].strip().upper() for i in range(num_classes)]
                logger.info("Successfully loaded vocabulary of %d classes directly from model metadata.", len(self._labels))
            else:
                self._labels = _load_labels(settings.SIGN_RECOGNITION_LABELS_PATH, num_classes)

            # Initialize MediaPipe landmarker models on demand
            try:
                import mediapipe as mp
                from mediapipe.tasks import python
                from mediapipe.tasks.python import vision

                models_dir = Path(os.path.dirname(__file__)).parent / "models"
                hand_path = models_dir / "hand_landmarker.task"
                pose_path = models_dir / "pose_landmarker_lite.task"

                if not hand_path.exists() or not pose_path.exists():
                    logger.warning("MediaPipe task files not found. Fallback landmark extraction will be disabled.")
                else:
                    logger.info("Initializing MediaPipe Hand & Pose Landmarker on backend...")
                    self._detector_hand = vision.HandLandmarker.create_from_options(
                        vision.HandLandmarkerOptions(
                            base_options=python.BaseOptions(model_asset_path=str(hand_path)),
                            num_hands=2,
                            min_hand_detection_confidence=0.35,
                            min_hand_presence_confidence=0.35,
                            min_tracking_confidence=0.35,
                        )
                    )
                    self._detector_pose = vision.PoseLandmarker.create_from_options(
                        vision.PoseLandmarkerOptions(
                            base_options=python.BaseOptions(model_asset_path=str(pose_path)),
                            min_pose_detection_confidence=0.4,
                            min_pose_presence_confidence=0.4,
                            min_tracking_confidence=0.4,
                        )
                    )
                    logger.info("MediaPipe landmarker backend engines initialized successfully.")
            except Exception as e:
                logger.error("Failed to initialize MediaPipe task engines on backend: %s", e)
        else:
            logger.info("Detected WLASL Vanilla model architecture.")
            self._is_dual_stream = False
            self._labels = _load_labels(
                settings.SIGN_RECOGNITION_LABELS_PATH,
                settings.SIGN_RECOGNITION_NUM_CLASSES,
            )
            # Build and load vanilla I3D model wrapper
            model_wrapper = I3DSignRecognitionModel(
                weights_path=str(weights_path),
                num_classes=settings.SIGN_RECOGNITION_NUM_CLASSES,
                device=settings.SIGN_RECOGNITION_DEVICE,
            )
            model_wrapper.load()
            self._model = model_wrapper

        self._loaded = True
        logger.info("Sign recognition pipeline loaded successfully. Active model type: %s", "DualStream" if self._is_dual_stream else "Vanilla")

    def _extract_landmarks_from_frame(self, frame_bytes: bytes) -> list[float]:
        """Extracts 225 pose and hand landmark floats from a raw frame using MediaPipe Tasks."""
        import mediapipe as mp
        
        # Initialize default lists
        pose_lms = [[0.0, 0.0, 0.0] for _ in range(33)]
        left_hand_lms = [[0.0, 0.0, 0.0] for _ in range(21)]
        right_hand_lms = [[0.0, 0.0, 0.0] for _ in range(21)]

        if self._detector_hand is None or self._detector_pose is None:
            # Fallback to zero landmarks
            return [0.0] * 225

        try:
            # Decode JPEG
            img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
            img_np = np.array(img)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_np)

            # Process pose
            pose_res = self._detector_pose.detect(mp_image)
            if pose_res.pose_landmarks:
                for j, lm in enumerate(pose_res.pose_landmarks[0]):
                    if j < 33:
                        pose_lms[j] = [lm.x, lm.y, lm.z]

            # Process hands
            hand_res = self._detector_hand.detect(mp_image)
            if hand_res.hand_landmarks:
                for idx, hand in enumerate(hand_res.hand_landmarks):
                    handedness = hand_res.handedness[idx][0].category_name
                    if handedness == "Left":
                        for j, lm in enumerate(hand):
                            if j < 21:
                                left_hand_lms[j] = [lm.x, lm.y, lm.z]
                    elif handedness == "Right":
                        for j, lm in enumerate(hand):
                            if j < 21:
                                right_hand_lms[j] = [lm.x, lm.y, lm.z]
        except Exception as e:
            logger.debug("Failed to extract landmarks from frame: %s", e)

        # Flatten in order: pose + left_hand + right_hand
        row = []
        for lm in pose_lms:
            row.extend(lm)
        for lm in left_hand_lms:
            row.extend(lm)
        for lm in right_hand_lms:
            row.extend(lm)

        return row

    def _convert_288_to_225(self, lms_288: list[float]) -> list[float]:
        """Convert a client-side 288-float landmark array into a 225-float model array."""
        f = np.array(lms_288).reshape(-1, 3)  # [96 points, 3 coords]
        pose = f[63:96]      # [33 points, 3 coords]
        l_hand = f[21:42]    # [21 points, 3 coords]
        r_hand = f[42:63]    # [21 points, 3 coords]
        joints_75 = np.vstack([pose, l_hand, r_hand])  # [75 points, 3 coords]
        return joints_75.flatten().tolist()

    def predict(self, frames: list[bytes], landmarks: list[list[float]] | None = None) -> dict[str, object]:
        if len(frames) < settings.SIGN_RECOGNITION_MIN_FRAMES:
            raise ValueError(
                f"Need at least {settings.SIGN_RECOGNITION_MIN_FRAMES} frames before prediction"
            )

        self.load()

        t0 = time.perf_counter()

        if self._is_dual_stream:
            # ── DUAL STREAM MODEL PREPROCESSING (16 frames) ──────────────────
            num_frames = 16
            n = len(frames)
            
            # Uniformly sample indices
            indices = np.linspace(0, n - 1, num_frames).round().astype(int)
            sampled_frames = [frames[i] for i in indices]

            # 1. Video frame tensor processing
            size = settings.SIGN_RECOGNITION_FRAME_SIZE
            tensors = [_decode_jpeg(f, size) for f in sampled_frames]  # list of [3, H, W]
            video_tensor = torch.stack(tensors, dim=1).unsqueeze(0)    # [1, 3, 16, 224, 224]

            # Normalize video from [-1, 1] to standard ImageNet normalisation
            video_tensor = (video_tensor + 1.0) / 2.0  # scale to [0, 1]
            mean = torch.tensor([0.485, 0.456, 0.406], device=self.device).view(1, 3, 1, 1, 1)
            std = torch.tensor([0.229, 0.224, 0.225], device=self.device).view(1, 3, 1, 1, 1)
            video_tensor = (video_tensor.to(self.device) - mean) / std

            # 2. Landmarks processing
            sampled_lms_list = []
            if landmarks is not None and len(landmarks) == n:
                # Client-side landmarks provided
                for i in indices:
                    curr_lms = landmarks[i]
                    if len(curr_lms) == 288:
                        sampled_lms_list.append(self._convert_288_to_225(curr_lms))
                    elif len(curr_lms) == 225:
                        sampled_lms_list.append(curr_lms)
                    else:
                        sampled_lms_list.append([0.0] * 225)
            else:
                # Backend MediaPipe fallback extraction
                logger.info("Extracting landmarks on backend for %d sampled frames...", num_frames)
                for f in sampled_frames:
                    sampled_lms_list.append(self._extract_landmarks_from_frame(f))

            landmarks_arr = np.array(sampled_lms_list, dtype=np.float32)  # [16, 225]

            # Normalize landmarks (centering on shoulder mid-point, scale by shoulder width)
            ls = landmarks_arr[:, 33:36].copy()  # left shoulder (points 11 * 3)
            rs = landmarks_arr[:, 36:39].copy()  # right shoulder (points 12 * 3)
            centre = (ls + rs) / 2.0
            width = np.linalg.norm(rs - ls, axis=1, keepdims=True)
            width = np.where(width < 1e-6, 1.0, width)

            normalized_lms = landmarks_arr.copy()
            for start in range(0, 225, 3):
                normalized_lms[:, start:start + 3] = (landmarks_arr[:, start:start + 3] - centre) / width

            landmarks_tensor = torch.from_numpy(normalized_lms).unsqueeze(0).to(self.device)  # [1, 16, 225]

            preprocess_ms = (time.perf_counter() - t0) * 1000.0

            # 3. Model Inference
            inference_started = time.perf_counter()
            with self._lock:
                with torch.inference_mode():
                    logits = self._model(video_tensor, landmarks_tensor)  # [1, num_classes]
            inference_ms = (time.perf_counter() - inference_started) * 1000.0

        else:
            # ── VANILLA MODEL PREPROCESSING (64 frames) ─────────────────────
            size = settings.SIGN_RECOGNITION_FRAME_SIZE
            num_frames = settings.SIGN_RECOGNITION_NUM_FRAMES

            sampled = _sample_frames(frames, num_frames)
            tensors = [_decode_jpeg(f, size) for f in sampled]  # list of [3, H, W]
            video_tensor = torch.stack(tensors, dim=1).unsqueeze(0)     # [1, 3, T, H, W]

            preprocess_ms = (time.perf_counter() - t0) * 1000.0

            inference_started = time.perf_counter()
            with self._lock:
                logits = self._model.predict_logits(video_tensor)  # [1, num_classes]
            inference_ms = (time.perf_counter() - inference_started) * 1000.0

        # Calculate prediction classes and probabilities
        probs = torch.softmax(logits.float(), dim=-1)[0]  # [num_classes]
        top_indices = probs.argsort(descending=True)[:3].tolist()

        predictions = []
        for i in top_indices:
            raw_label = self._labels[i]
            # Strip trailing variant digit if present (e.g. "DOG1" -> "DOG", "PATIENT2" -> "PATIENT")
            cleaned_label = re.sub(r'\d+$', '', raw_label).upper()
            predictions.append(
                PredictionResult(
                    label=cleaned_label,
                    confidence=float(probs[i]),
                )
            )

        top_confidence = float(probs[top_indices[0]])
        is_confident = top_confidence >= settings.SIGN_RECOGNITION_CONFIDENCE_THRESHOLD

        logger.info(
            "Prediction: %s (%.1f%%) | is_confident=%s | preprocess=%.1fms inference=%.1fms",
            predictions[0].label,
            top_confidence * 100,
            is_confident,
            preprocess_ms,
            inference_ms,
        )

        return {
            "predictions": predictions,
            "preprocess_ms": preprocess_ms,
            "inference_ms": inference_ms,
            "total_ms": preprocess_ms + inference_ms,
            "frames_received": len(frames),
            "is_confident": is_confident,
        }


pipeline = SignRecognitionPipeline()
