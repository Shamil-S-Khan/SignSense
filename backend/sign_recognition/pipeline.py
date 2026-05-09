from __future__ import annotations

import io
import logging
import threading
import time
from pathlib import Path

import torch
from PIL import Image

from config import settings

from .i3d.model import I3DSignRecognitionModel
from .types import PredictionResult

logger = logging.getLogger("sign_recognition")


def _load_labels(path: str, limit: int) -> list[str]:
    labels_path = Path(path)
    if not labels_path.exists():
        raise FileNotFoundError(f"WLASL labels file not found: {labels_path}")

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
    import numpy as np
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
        self._model = I3DSignRecognitionModel(
            weights_path=settings.SIGN_RECOGNITION_MODEL_WEIGHTS_PATH,
            num_classes=settings.SIGN_RECOGNITION_NUM_CLASSES,
            device=settings.SIGN_RECOGNITION_DEVICE,
        )

    def load(self) -> None:
        if self._loaded:
            return

        self._labels = _load_labels(
            settings.SIGN_RECOGNITION_LABELS_PATH,
            settings.SIGN_RECOGNITION_NUM_CLASSES,
        )
        self._model.load()
        self._loaded = True

    def _preprocess(self, frames: list[bytes]) -> tuple[torch.Tensor, float]:
        t0 = time.perf_counter()

        size = settings.SIGN_RECOGNITION_FRAME_SIZE
        num_frames = settings.SIGN_RECOGNITION_NUM_FRAMES

        sampled = _sample_frames(frames, num_frames)
        tensors = [_decode_jpeg(f, size) for f in sampled]  # list of [3, H, W]
        video = torch.stack(tensors, dim=1).unsqueeze(0)     # [1, 3, T, H, W]

        preprocess_ms = (time.perf_counter() - t0) * 1000.0
        return video, preprocess_ms

    def predict(self, frames: list[bytes]) -> dict[str, object]:
        if len(frames) < settings.SIGN_RECOGNITION_MIN_FRAMES:
            raise ValueError(
                f"Need at least {settings.SIGN_RECOGNITION_MIN_FRAMES} frames before prediction"
            )

        self.load()

        video_tensor, preprocess_ms = self._preprocess(frames)

        logger.info(
            "I3D inference: %d raw frames → sampled to %d, tensor=%s",
            len(frames),
            settings.SIGN_RECOGNITION_NUM_FRAMES,
            tuple(video_tensor.shape),
        )

        inference_started = time.perf_counter()
        with self._lock:
            logits = self._model.predict_logits(video_tensor)  # [1, num_classes]
        inference_ms = (time.perf_counter() - inference_started) * 1000.0

        probs = torch.softmax(logits.float(), dim=-1)[0]  # [num_classes]
        top_indices = probs.argsort(descending=True)[:3].tolist()

        predictions = [
            PredictionResult(
                label=self._labels[i],
                confidence=float(probs[i]),
            )
            for i in top_indices
        ]

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
