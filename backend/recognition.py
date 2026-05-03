"""
Sign recognition engine — loads PyTorch models onto GPU at startup.

Two models:
  1. Fingerspelling MLP: single frame (63 floats) → A-Z probability
  2. Dynamic sign classifier (Pose-TGCN): 50-frame sequence → word vocabulary
"""

import os
import logging
import numpy as np
from typing import Optional, Tuple, List
from pathlib import Path

logger = logging.getLogger("recognition")

# --- Attempt to import torch; graceful fallback if not installed yet ---
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"PyTorch available, using device: {DEVICE}")
except ImportError:
    TORCH_AVAILABLE = False
    DEVICE = None
    logger.warning("PyTorch not installed — using fallback recognition.")


# ─────────────────────────────────────────────────────────────
# Fingerspelling MLP  (lightweight, <1ms per frame on GPU)
# ─────────────────────────────────────────────────────────────
# Full 26-class labels matching the HuggingFace sid220/asl-now-fingerspelling model
LABELS_26 = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")  # 26 classes (A-Z)
LABELS_24 = list("ABCDEFGHIKLMNOPQRSTUVWXY")    # 24 static only (no J, Z)
LABELS = LABELS_26  # Default; overridden at load time based on model

class FingerspellingMLP(nn.Module):
    """
    Matches the sid220/asl-now-fingerspelling architecture exactly:
      Flatten(21,3 -> 63) → Dense(128, relu) → Dense(26, linear)
    """
    def __init__(self, input_dim: int = 63, num_classes: int = 26):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ─────────────────────────────────────────────────────────────
# Pose-TGCN (Temporal Graph Convolutional Network)
# ─────────────────────────────────────────────────────────────
class GraphConvolution(nn.Module):
    """
    Spatio-temporal graph convolution layer.
    As used in Pose-TGCN (dxli94/WLASL).
    """
    def __init__(self, in_features: int, out_features: int, bias: bool = True):
        super(GraphConvolution, self).__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.weight = nn.Parameter(torch.FloatTensor(in_features, out_features))
        # Adjacency matrix is learnable in this architecture
        self.att = nn.Parameter(torch.FloatTensor(55, 55))
        if bias:
            self.bias = nn.Parameter(torch.FloatTensor(out_features))
        else:
            self.register_parameter('bias', None)
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.kaiming_uniform_(self.weight)
        nn.init.constant_(self.att, 1.0 / 55)
        if self.bias is not None:
            nn.init.constant_(self.bias, 0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [Batch, 55, in_features]
        x = torch.matmul(x, self.weight)  # [Batch, 55, out_features]
        x = torch.matmul(self.att, x)    # [Batch, 55, out_features]
        if self.bias is not None:
            x += self.bias
        return x

class TGCNBlock(nn.Module):
    """Residual TGCN block with two GraphConvolutions and BatchNorm."""
    def __init__(self, in_features: int, out_features: int):
        super(TGCNBlock, self).__init__()
        self.gc1 = GraphConvolution(in_features, out_features)
        self.bn1 = nn.BatchNorm1d(55 * out_features)
        self.gc2 = GraphConvolution(out_features, out_features)
        self.bn2 = nn.BatchNorm1d(55 * out_features)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        batch_size = x.size(0)
        
        # GC1 + BN1 + ReLU
        x = self.gc1(x)
        x = self.bn1(x.view(batch_size, -1)).view(batch_size, 55, -1)
        x = F.relu(x)
        
        # GC2 + BN2
        x = self.gc2(x)
        x = self.bn2(x.view(batch_size, -1)).view(batch_size, 55, -1)
        
        # Residual + ReLU
        return F.relu(x + residual)

class PoseTGCN(nn.Module):
    """
    Full Pose-TGCN architecture for WLASL2000.
    Input: [Batch, 55 joints, 100 features]
    100 features = 50 frames * 2 coordinates (x, y)
    """
    def __init__(self, num_classes: int = 2000):
        super(PoseTGCN, self).__init__()
        self.gc1 = GraphConvolution(100, 256)
        self.bn1 = nn.BatchNorm1d(55 * 256)
        self.gcbs = nn.ModuleList([TGCNBlock(256, 256) for _ in range(24)])
        self.fc_out = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size = x.size(0)
        
        # Initial convolution
        x = self.gc1(x)
        x = self.bn1(x.view(batch_size, -1)).view(batch_size, 55, -1)
        x = F.relu(x)
        
        # 24 stages of TGCN blocks
        for block in self.gcbs:
            x = block(x)
            
        # Global average pooling over joints
        x = x.mean(dim=1)
        
        # Final classification
        return self.fc_out(x)


# ─────────────────────────────────────────────────────────────
# Recognition Engine (singleton)
# ─────────────────────────────────────────────────────────────
class RecognitionEngine:
    def __init__(self):
        self.fingerspelling_model: Optional[nn.Module] = None
        self.dynamic_model: Optional[nn.Module] = None
        self._reference_cache: dict[str, np.ndarray] = {}
        self._loaded = False
        self._labels = LABELS_26
        self._dynamic_labels: List[str] = []

    def load(self, models_dir: str = "models", references_dir: str = "references"):
        """Load models into GPU memory. Call once at startup."""
        global LABELS
        if not TORCH_AVAILABLE:
            logger.warning("Skipping model load — PyTorch not available.")
            self._loaded = True
            return

        # 1. Fingerspelling MLP
        fs_path = os.path.join(models_dir, "fingerspelling.pt")
        if os.path.exists(fs_path):
            try:
                state = torch.load(fs_path, map_location=DEVICE, weights_only=True)
                last_bias_key = [k for k in state.keys() if k.endswith(".bias")][-1]
                num_classes = state[last_bias_key].shape[0]
                first_weight_key = [k for k in state.keys() if k.endswith(".weight")][0]
                input_dim = state[first_weight_key].shape[1]
                self._labels = LABELS_26 if num_classes == 26 else LABELS_24
                LABELS = self._labels
                self.fingerspelling_model = FingerspellingMLP(input_dim=input_dim, num_classes=num_classes)
                self.fingerspelling_model.load_state_dict(state)
                self.fingerspelling_model.to(DEVICE).eval()
                logger.info("Fingerspelling model loaded (%d classes)", num_classes)
            except Exception as e:
                logger.error("Failed to load fingerspelling model: %s", e)

        # 2. Pose-TGCN (Dynamic Signs)
        tgcn_path = os.path.join(models_dir, "pose_tgcn.pt")
        if os.path.exists(tgcn_path):
            try:
                # WLASL2000 by default
                self.dynamic_model = PoseTGCN(num_classes=2000)
                state = torch.load(tgcn_path, map_location=DEVICE)
                self.dynamic_model.load_state_dict(state)
                self.dynamic_model.to(DEVICE).eval()
                logger.info("Pose-TGCN dynamic model loaded (2000 classes)")
                
                # Load labels if available
                labels_path = os.path.join(models_dir, "wlasl_class_list.txt")
                if os.path.exists(labels_path):
                    with open(labels_path, "r") as f:
                        self._dynamic_labels = [line.split("\t")[-1].strip() for line in f if line.strip()]
                else:
                    logger.warning("wlasl_class_list.txt not found. Dynamic labels will be indices.")
            except Exception as e:
                logger.error("Failed to load Pose-TGCN model: %s", e)

        # 3. Reference trajectories
        ref_dir = Path(references_dir)
        if ref_dir.exists():
            for npy_file in ref_dir.glob("*.npy"):
                sign_name = npy_file.stem.upper()
                self._reference_cache[sign_name] = np.load(npy_file)
            logger.info("Loaded %d reference trajectories.", len(self._reference_cache))

        self._loaded = True

    # ── Fingerspelling (single frame) ──────────────────────
    def predict_fingerspelling(self, landmarks: List[float]) -> Tuple[str, float]:
        """Predict A-Z from a single frame of 21 hand landmarks."""
        if len(landmarks) < 63: return ("?", 0.0)
        raw = np.array(landmarks[:63], dtype=np.float32).reshape(21, 3)

        # sid220/asl-now-fingerspelling was trained on raw MediaPipe output:
        #   x, y in [0.0, 1.0] (normalized by image width/height)
        #   z already wrist-relative (MediaPipe convention)
        # Do NOT apply any additional centering or scaling — it shifts x,y
        # out of the [0,1] range the model was trained on and breaks predictions.
        flat = raw.flatten()

        if self.fingerspelling_model is not None:
            with torch.no_grad():
                tensor = torch.tensor(flat, dtype=torch.float32).unsqueeze(0).to(DEVICE)
                logits = self.fingerspelling_model(tensor)
                probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
                idx = int(np.argmax(probs))
                return (self._labels[idx], float(probs[idx]))

        return self._cosine_fallback(flat)

    def _cosine_fallback(self, arr: np.ndarray) -> Tuple[str, float]:
        best_label, best_sim = "?", 0.0
        for sign, ref in self._reference_cache.items():
            if sign not in LABELS: continue
            ref_flat = ref.flatten()[:63]
            cos = float(np.dot(arr, ref_flat) / (np.linalg.norm(arr) * np.linalg.norm(ref_flat) + 1e-8))
            if cos > best_sim:
                best_sim = cos
                best_label = sign
        return (best_label, max(0.0, best_sim))

    # ── Dynamic signs (multi-frame) ───────────────────────
    def predict_dynamic(self, frames: List[List[float]]) -> Tuple[str, float]:
        """
        Predict a dynamic sign from a sequence of frames.
        Incoming `frames` each have 288 floats (DomHand, LHand, RHand, Pose33).
        We map these to 55 joints (21 LHand, 21 RHand, 13 Pose).
        """
        if self.dynamic_model is None or len(frames) < 10:
            return ("...", 0.0)

        # 1. Subsample/Interpolate to exactly 50 frames
        indices = np.linspace(0, len(frames)-1, 50).astype(int)
        sampled = [frames[i] for i in indices]
        
        # 2. Extract and Map to 55 joints
        # Pose-TGCN expects: 21 LHand + 21 RHand + 13 Pose (0:Nose, 1:L-Sh, 2:R-Sh, ...)
        # Pose 13 mapping from MediaPipe 33:
        # [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
        POSE_MAP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
        
        sequence_data = [] # Will be [50, 55, 2]
        
        for frame in sampled:
            # frame is 288 floats
            f = np.array(frame).reshape(-1, 3) # [96 points? no, 288/3 = 96]
            # Our format: [21 Dom, 21 Left, 21 Right, 33 Pose] = 96 points.
            l_hand = f[21:42, :2] # [21, 2]
            r_hand = f[42:63, :2] # [21, 2]
            pose_all = f[63:96, :2] # [33, 2]
            pose_13 = pose_all[POSE_MAP] # [13, 2]
            
            # Combine to 55 joints
            joints_55 = np.vstack([l_hand, r_hand, pose_13]) # [55, 2]
            
            # Normalization (Center on Nose, scale by shoulder width)
            nose = pose_13[0]
            l_shoulder = pose_13[1]
            r_shoulder = pose_13[2]
            shoulder_width = np.linalg.norm(l_shoulder - r_shoulder) or 1.0
            
            joints_55 = (joints_55 - nose) / shoulder_width
            sequence_data.append(joints_55)

        arr = np.array(sequence_data, dtype=np.float32) # [50, 55, 2]
        
        # 3. Model Inference
        try:
            # WLASL Pose-TGCN expects [Batch, 55, 100] where 100 = 50 frames * 2 coords
            # Reshape: [50, 55, 2] -> [55, 50, 2] -> [55, 100]
            arr = arr.transpose(1, 0, 2).reshape(55, 100)
            tensor = torch.tensor(arr, dtype=torch.float32).unsqueeze(0).to(DEVICE)
            
            with torch.no_grad():
                logits = self.dynamic_model(tensor)
                probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
                idx = int(np.argmax(probs))
                
                label = self._dynamic_labels[idx] if idx < len(self._dynamic_labels) else f"class_{idx}"
                return (label, float(probs[idx]))
        except Exception as e:
            logger.error("Dynamic prediction failed: %s", e)
            return ("?", 0.0)


# Module-level singleton
engine = RecognitionEngine()
