from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class FrameMessage(BaseModel):
    type: Literal["frame"]
    frame_index: int = Field(ge=0)
    jpeg: str  # base64-encoded JPEG frame


class PredictMessage(BaseModel):
    type: Literal["predict"]


class ClearMessage(BaseModel):
    type: Literal["clear"]


class PredictionItem(BaseModel):
    label: str
    confidence: float


class PredictionResponse(BaseModel):
    type: Literal["prediction"] = "prediction"
    predictions: list[PredictionItem]
    preprocess_ms: float
    inference_ms: float
    total_ms: float
    frames_received: int
    is_confident: bool


class ErrorResponse(BaseModel):
    type: Literal["error"] = "error"
    message: str