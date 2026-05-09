from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RawHolisticFrame:
    left_hand: np.ndarray
    right_hand: np.ndarray
    pose: np.ndarray


@dataclass(frozen=True)
class PredictionResult:
    label: str
    confidence: float