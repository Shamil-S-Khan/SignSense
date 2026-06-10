import math
import torch
import torch.nn as nn
import torch.nn.functional as F

class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, dropout: float = 0.1, max_len: int = 512):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        pe  = torch.zeros(max_len, d_model)
        pos = torch.arange(max_len).unsqueeze(1).float()
        div = torch.exp(
            torch.arange(0, d_model, 2).float()
            * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:, :x.size(1)]
        return self.dropout(x)


class I3DStream(nn.Module):
    """
    I3D ResNet-50 backbone producing per-timestep tokens followed by a Transformer encoder.
    """
    def __init__(self, rgb_d_model=512, rgb_nhead=8, rgb_dim_ff=2048, rgb_layers=4, dropout=0.15):
        super().__init__()
        # Load the PyTorchVideo I3D ResNet-50 backbone
        full = torch.hub.load(
            "facebookresearch/pytorchvideo", "i3d_r50",
            pretrained=False, verbose=False,
        )
        self.backbone     = nn.ModuleList(list(full.blocks)[:-1])
        self.spatial_pool = nn.AdaptiveAvgPool3d((None, 1, 1))
        self.proj = nn.Sequential(
            nn.Linear(2048, rgb_d_model),
            nn.LayerNorm(rgb_d_model),
            nn.GELU(),
        )
        self.cls_token = nn.Parameter(
            torch.randn(1, 1, rgb_d_model) * 0.02
        )
        self.pos_enc = PositionalEncoding(rgb_d_model, dropout)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=rgb_d_model, nhead=rgb_nhead,
            dim_feedforward=rgb_dim_ff, dropout=dropout,
            batch_first=True, norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            enc_layer, num_layers=rgb_layers,
            norm=nn.LayerNorm(rgb_d_model),
            enable_nested_tensor=False,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, C, T, H, W]
        for block in self.backbone:
            x = block(x)
        x = self.spatial_pool(x).squeeze(-1).squeeze(-1)  # [B, 2048, T']
        x = x.permute(0, 2, 1)                            # [B, T', 2048]
        x = self.proj(x)                                   # [B, T', rgb_d_model]
        B   = x.size(0)
        cls = self.cls_token.expand(B, -1, -1)
        x   = torch.cat([cls, x], dim=1)                  # [B, 1 + T', rgb_d_model]
        x   = self.pos_enc(x)
        x   = self.transformer(x)
        return x[:, 0]                                     # [B, rgb_d_model]


class PoseStream(nn.Module):
    """
    Lightweight Transformer over landmark sequences.
    """
    def __init__(self, landmark_dim=225, pose_d_model=256, pose_nhead=4, pose_dim_ff=512, pose_layers=2, dropout=0.15):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(landmark_dim, pose_d_model),
            nn.LayerNorm(pose_d_model),
            nn.GELU(),
        )
        self.cls_token = nn.Parameter(
            torch.randn(1, 1, pose_d_model) * 0.02
        )
        self.pos_enc = PositionalEncoding(pose_d_model, dropout)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=pose_d_model, nhead=pose_nhead,
            dim_feedforward=pose_dim_ff, dropout=dropout,
            batch_first=True, norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            enc_layer, num_layers=pose_layers,
            norm=nn.LayerNorm(pose_d_model),
            enable_nested_tensor=False,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, landmark_dim]
        x   = self.input_proj(x)
        B   = x.size(0)
        cls = self.cls_token.expand(B, -1, -1)
        x   = torch.cat([cls, x], dim=1)
        x   = self.pos_enc(x)
        x   = self.transformer(x)
        return x[:, 0]                                     # [B, pose_d_model]


class GatedFusion(nn.Module):
    """
    Learnable gate over concatenated streams.
    """
    def __init__(self, rgb_d_model=512, pose_d_model=256, fused_dim=512, dropout=0.15):
        super().__init__()
        total = rgb_d_model + pose_d_model
        self.gate = nn.Sequential(
            nn.LayerNorm(total),
            nn.Linear(total, total),
            nn.Sigmoid(),
        )
        self.proj = nn.Sequential(
            nn.LayerNorm(total),
            nn.Linear(total, fused_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

    def forward(self, rgb_feat: torch.Tensor, pose_feat: torch.Tensor) -> torch.Tensor:
        x = torch.cat([rgb_feat, pose_feat], dim=1)
        return self.proj(x * self.gate(x))


class DualStreamASL(nn.Module):
    """
    Full dual-stream sign language recognition model:
    - RGB stream: I3D backbone + Transformer
    - Pose stream: Landmarks Transformer
    - Gated Fusion + classification head
    """
    def __init__(self, num_classes: int = 100):
        super().__init__()
        self.rgb_stream  = I3DStream()
        self.pose_stream = PoseStream()
        self.fusion      = GatedFusion()
        self.classifier  = nn.Linear(512, num_classes)

    def forward(self, frames: torch.Tensor, landmarks: torch.Tensor) -> torch.Tensor:
        rgb_feat  = self.rgb_stream(frames)
        pose_feat = self.pose_stream(landmarks)
        fused     = self.fusion(rgb_feat, pose_feat)
        return self.classifier(fused)
