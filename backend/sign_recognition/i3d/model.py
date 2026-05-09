from __future__ import annotations

import logging
import sys
from pathlib import Path

import torch
import torch.nn as nn

from .pytorch_i3d import InceptionI3d
from .custom_models import I3DFeatureExtractor, SignLanguageRecognitionModel

logger = logging.getLogger("sign_recognition.model")


class I3DSignRecognitionModel:
    """Loads the combined I3D + Transformer model from a single checkpoint."""

    def __init__(self, weights_path: str, num_classes: int, device: str = "cuda"):
        self.weights_path = Path(weights_path)
        self.num_classes = num_classes
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        if device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA requested but not available — falling back to CPU")
        self.model: SignLanguageRecognitionModel | None = None

    def load(self) -> None:
        if self.model is not None:
            return

        if not self.weights_path.exists():
            raise FileNotFoundError(f"I3D weights not found: {self.weights_path}")

        logger.info("Building I3D + Transformer model (num_classes=%d)", self.num_classes)

        i3d_backbone = InceptionI3d(num_classes=self.num_classes, in_channels=3)
        feature_extractor = I3DFeatureExtractor(i3d_backbone)
        model = SignLanguageRecognitionModel(feature_extractor, self.num_classes)

        logger.info("Loading checkpoint: %s", self.weights_path)
        state_dict = torch.load(
            self.weights_path,
            map_location=self.device,
            weights_only=True,
        )

        # Weights were saved with nn.DataParallel — strip the "module." prefix.
        if all(k.startswith("module.") for k in state_dict.keys()):
            state_dict = {k[len("module."):]: v for k, v in state_dict.items()}

        model.load_state_dict(state_dict, strict=True)
        model.to(self.device)

        # fp16 for ~2× speedup on GPU; safe for inference.
        if self.device.type == "cuda":
            model = model.half()

        model.eval()
        self.model = model
        logger.info(
            "I3D model ready on %s (dtype=%s)",
            self.device,
            next(model.parameters()).dtype,
        )

    def predict_logits(self, video_tensor: torch.Tensor) -> torch.Tensor:
        """
        Args:
            video_tensor: float32 or float16 tensor of shape [1, 3, 64, 224, 224]
                          on the correct device, normalised to [-1, 1].
        Returns:
            logits of shape [1, num_classes].
        """
        if self.model is None:
            raise RuntimeError("Model not loaded — call load() first")

        if self.device.type == "cuda":
            video_tensor = video_tensor.to(self.device, dtype=torch.float16)
        else:
            video_tensor = video_tensor.to(self.device, dtype=torch.float32)

        with torch.inference_mode():
            return self.model(video_tensor)
