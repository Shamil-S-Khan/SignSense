#!/usr/bin/env python3
"""
Fine-tune the I3D+Transformer on personally recorded clips.

By default only the Transformer head is trained (fast, GPU-friendly).
Use --unfreeze-backbone to also fine-tune the I3D backbone.

Usage
-----
  cd backend
  python finetune_personal.py                              # 10 epochs, transformer only
  python finetune_personal.py --epochs 20 --lr 5e-5
  python finetune_personal.py --unfreeze-backbone --epochs 5 --batch-size 1

After training, update SIGN_RECOGNITION_MODEL_WEIGHTS_PATH in your .env or config.py
to point to the saved checkpoint.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
import types
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset

# ── allow running from any directory ────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_BACKEND_DIR))

from sign_recognition.i3d.custom_models import (
    I3DFeatureExtractor,
    SignLanguageRecognitionModel,
)
from sign_recognition.i3d.pytorch_i3d import InceptionI3d

# ── paths ────────────────────────────────────────────────────────────────────
_ROOT = _BACKEND_DIR.parent
TRAINING_DATA_DIR = _BACKEND_DIR / "training_data"
WEIGHTS_OUT_DIR   = _ROOT / "model_weights" / "vanilla_weigths"
DEFAULT_CKPT      = WEIGHTS_OUT_DIR / "best_model_40_73.pth"
CLASS_LIST_PATH   = _BACKEND_DIR / "models" / "wlasl_class_list.txt"

NUM_CLASSES = 100   # WLASL100
NUM_FRAMES  = 64
FRAME_SIZE  = 224

# ── logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("finetune")


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def load_class_map(path: Path, limit: int = NUM_CLASSES) -> dict[str, int]:
    """Return {WORD_UPPER: class_idx} for the first `limit` entries."""
    mapping: dict[str, int] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            parts = line.strip().split("\t")
            if len(parts) != 2:
                continue
            idx, word = int(parts[0]), parts[1].strip().upper()
            mapping[word] = idx
            if len(mapping) == limit:
                break
    return mapping


def _load_clip(clip_dir: Path, num_frames: int, flip: bool) -> torch.Tensor:
    """
    Load a clip directory into a float32 tensor of shape [3, T, H, W]
    normalised to [-1, 1].  Frames are uniformly sampled to `num_frames`.
    """
    jpegs = sorted(clip_dir.glob("frame_*.jpg"))
    if not jpegs:
        raise ValueError(f"No frames in {clip_dir}")

    n = len(jpegs)
    if n >= num_frames:
        indices = [int(i * n / num_frames) for i in range(num_frames)]
    else:
        indices = list(range(n)) + [n - 1] * (num_frames - n)

    frames: list[torch.Tensor] = []
    for i in indices:
        img = (
            Image.open(jpegs[i])
            .convert("RGB")
            .resize((FRAME_SIZE, FRAME_SIZE), Image.BILINEAR)
        )
        if flip:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        arr = (np.array(img, dtype=np.float32) / 127.5) - 1.0  # [-1, 1]
        frames.append(torch.from_numpy(arr).permute(2, 0, 1))   # [3, H, W]

    return torch.stack(frames, dim=1)  # [3, T, H, W]


# ────────────────────────────────────────────────────────────────────────────
# Dataset
# ────────────────────────────────────────────────────────────────────────────

class PersonalClipDataset(Dataset[tuple[torch.Tensor, int]]):
    def __init__(
        self,
        data_dir: Path,
        class_map: dict[str, int],
        augment: bool = True,
    ) -> None:
        # Each sample: (clip_dir, label, flip)
        self._samples: list[tuple[Path, int, bool]] = []

        skipped_words: list[str] = []
        for word_dir in sorted(data_dir.iterdir()):
            if not word_dir.is_dir():
                continue
            word = word_dir.name.upper()
            if word not in class_map:
                skipped_words.append(word)
                continue
            label = class_map[word]
            for clip_dir in sorted(word_dir.glob("clip_*")):
                if clip_dir.is_dir() and any(clip_dir.glob("frame_*.jpg")):
                    self._samples.append((clip_dir, label, False))
                    if augment:
                        self._samples.append((clip_dir, label, True))

        if skipped_words:
            log.warning(
                "Words not in WLASL%d class map (skipped): %s",
                NUM_CLASSES,
                ", ".join(skipped_words),
            )

        unique_words = set(s[1] for s in self._samples)
        log.info(
            "Dataset: %d samples  |  %d unique classes%s",
            len(self._samples),
            len(unique_words),
            "  (augmented)" if augment else "",
        )

    def __len__(self) -> int:
        return len(self._samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        clip_dir, label, flip = self._samples[idx]
        video = _load_clip(clip_dir, NUM_FRAMES, flip)
        return video, label


# ────────────────────────────────────────────────────────────────────────────
# Model helpers
# ────────────────────────────────────────────────────────────────────────────

def _build_and_load(ckpt: Path, device: torch.device) -> SignLanguageRecognitionModel:
    """Construct the I3D+Transformer model and load pretrained weights (fp32)."""
    i3d = InceptionI3d(num_classes=NUM_CLASSES, in_channels=3)
    fe  = I3DFeatureExtractor(i3d)
    model = SignLanguageRecognitionModel(fe, NUM_CLASSES)

    state = torch.load(ckpt, map_location=device, weights_only=True)
    # Strip DataParallel "module." prefix if present
    if all(k.startswith("module.") for k in state):
        state = {k[len("module."):]: v for k, v in state.items()}
    model.load_state_dict(state, strict=True)

    model.to(device)
    model.float()   # fp32 for training (inference uses fp16)
    return model


def _patch_feature_extractor(model: SignLanguageRecognitionModel) -> None:
    """
    Remove the hard-coded `torch.no_grad()` context from I3DFeatureExtractor.forward
    so that gradients can flow into the backbone when --unfreeze-backbone is set.
    """
    def _forward_with_grad(self: I3DFeatureExtractor, x: torch.Tensor) -> torch.Tensor:
        return self.feature_extractor(x)

    model.feature_extractor.forward = types.MethodType(   # type: ignore[method-assign]
        _forward_with_grad, model.feature_extractor
    )


def _configure_trainable(
    model: SignLanguageRecognitionModel,
    unfreeze_backbone: bool,
) -> int:
    if unfreeze_backbone:
        for p in model.parameters():
            p.requires_grad = True
        log.info("Trainable: full model (I3D backbone + Transformer)")
    else:
        for p in model.feature_extractor.parameters():
            p.requires_grad = False
        for p in model.transformer.parameters():
            p.requires_grad = True
        log.info("Trainable: Transformer head only (I3D backbone frozen)")

    n_train = sum(p.numel() for p in model.parameters() if p.requires_grad)
    n_total = sum(p.numel() for p in model.parameters())
    log.info("Params: %d / %d trainable", n_train, n_total)
    return n_train


# ────────────────────────────────────────────────────────────────────────────
# Training loop
# ────────────────────────────────────────────────────────────────────────────

def train(args: argparse.Namespace) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info("Device: %s", device)

    # ── validate data ────────────────────────────────────────────────────────
    if not TRAINING_DATA_DIR.exists() or not any(TRAINING_DATA_DIR.iterdir()):
        log.error("No training data found at: %s", TRAINING_DATA_DIR)
        log.error("Record clips via the /collect page in the frontend first.")
        sys.exit(1)

    class_map = load_class_map(CLASS_LIST_PATH, NUM_CLASSES)

    dataset = PersonalClipDataset(
        TRAINING_DATA_DIR, class_map, augment=not args.no_augment
    )
    if len(dataset) == 0:
        log.error("No usable clips found for WLASL%d words.", NUM_CLASSES)
        log.error("Check that your recorded words match the class list.")
        sys.exit(1)

    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,          # Windows-safe
        pin_memory=(device.type == "cuda"),
        drop_last=False,
    )

    # ── build model ───────────────────────────────────────────────────────────
    log.info("Loading checkpoint: %s", args.checkpoint)
    model = _build_and_load(Path(args.checkpoint), device)
    _patch_feature_extractor(model)
    _configure_trainable(model, args.unfreeze_backbone)
    model.train()

    # ── optimiser ────────────────────────────────────────────────────────────
    trainable = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.Adam(trainable, lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs, eta_min=args.lr * 0.01
    )
    criterion = nn.CrossEntropyLoss()

    WEIGHTS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = WEIGHTS_OUT_DIR / args.out

    best_acc = 0.0
    log.info("Starting fine-tuning: %d epochs, lr=%.2e, batch=%d", args.epochs, args.lr, args.batch_size)
    log.info("-" * 60)

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for step, (videos, labels) in enumerate(loader, 1):
            videos = videos.to(device, dtype=torch.float32)   # [B, 3, T, H, W]
            labels = labels.to(device)

            optimizer.zero_grad()
            logits = model(videos)
            loss = criterion(logits, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(trainable, max_norm=1.0)
            optimizer.step()

            total_loss += loss.item()
            correct += (logits.argmax(dim=1) == labels).sum().item()
            total += labels.size(0)

            if step % max(1, len(loader) // 4) == 0 or step == len(loader):
                log.info(
                    "  Epoch %d/%d  step %d/%d  loss=%.4f",
                    epoch, args.epochs, step, len(loader), loss.item(),
                )

        scheduler.step()
        epoch_acc = correct / total * 100
        epoch_loss = total_loss / len(loader)
        log.info(
            "Epoch %d/%d  avg_loss=%.4f  train_acc=%.1f%%",
            epoch, args.epochs, epoch_loss, epoch_acc,
        )

        if epoch_acc > best_acc:
            best_acc = epoch_acc
            torch.save(model.state_dict(), out_path)
            log.info("  ↳ Best so far — saved to %s", out_path)

    # Always save the final epoch weights too
    final_path = WEIGHTS_OUT_DIR / f"final_{args.out}"
    torch.save(model.state_dict(), final_path)

    log.info("=" * 60)
    log.info("Fine-tuning complete.")
    log.info("  Best checkpoint:  %s  (%.1f%% train acc)", out_path, best_acc)
    log.info("  Final checkpoint: %s", final_path)
    log.info("")
    log.info("To activate the fine-tuned model, add this to your .env:")
    log.info(
        "  SIGN_RECOGNITION_MODEL_WEIGHTS_PATH=%s",
        out_path.as_posix(),
    )


# ────────────────────────────────────────────────────────────────────────────
# CLI
# ────────────────────────────────────────────────────────────────────────────

def main() -> None:
    ts = time.strftime("%Y%m%d_%H%M%S")

    parser = argparse.ArgumentParser(
        description="Fine-tune I3D+Transformer on personal recorded clips",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--checkpoint",
        default=str(DEFAULT_CKPT),
        help="Path to the pretrained checkpoint",
    )
    parser.add_argument("--epochs",     type=int,   default=10,    help="Training epochs")
    parser.add_argument("--lr",         type=float, default=1e-4,  help="Learning rate")
    parser.add_argument("--batch-size", type=int,   default=2,     help="Batch size (keep low for GPU RAM)")
    parser.add_argument(
        "--no-augment",
        action="store_true",
        help="Disable horizontal-flip augmentation",
    )
    parser.add_argument(
        "--unfreeze-backbone",
        action="store_true",
        help="Also fine-tune the I3D backbone (needs more clips & GPU RAM)",
    )
    parser.add_argument(
        "--out",
        default=f"finetuned_{ts}.pth",
        help="Output filename (saved inside model_weights/vanilla_weigths/)",
    )
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
