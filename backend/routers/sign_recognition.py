from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import settings
from sign_recognition.pipeline import pipeline as sign_recognition_pipeline
from sign_recognition.schemas import (
    ClearMessage,
    ErrorResponse,
    FrameMessage,
    PredictMessage,
    PredictionItem,
    PredictionResponse,
)

logger = logging.getLogger("sign_recognition.websocket")

router = APIRouter(tags=["sign-recognition"])

_buffers: Dict[WebSocket, List[tuple[bytes, list[float] | None]]] = {}


@router.websocket("/ws/sign-recognition")
async def sign_recognition_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    _buffers[websocket] = []
    logger.info("Sign recognition WebSocket connected")

    try:
        while True:
            payload = json.loads(await websocket.receive_text())
            message_type = payload.get("type")

            if message_type == "frame":
                message = FrameMessage.model_validate(payload)
                buffer = _buffers[websocket]
                if len(buffer) >= settings.SIGN_RECOGNITION_MAX_BUFFER_FRAMES:
                    buffer.pop(0)
                buffer.append((base64.b64decode(message.jpeg), message.landmarks))
                continue

            if message_type == "clear":
                ClearMessage.model_validate(payload)
                _buffers[websocket].clear()
                continue

            if message_type == "predict":
                PredictMessage.model_validate(payload)
                buffered_items = list(_buffers[websocket])
                frames = [item[0] for item in buffered_items]
                landmarks = [item[1] for item in buffered_items]
                
                # If all are None, pass None to pipeline
                if all(lm is None for lm in landmarks):
                    landmarks = None

                logger.info("predict received: %d frames buffered", len(frames))
                if len(frames) < settings.SIGN_RECOGNITION_MIN_FRAMES:
                    await websocket.send_json(
                        ErrorResponse(
                            message=(
                                f"Need at least {settings.SIGN_RECOGNITION_MIN_FRAMES} frames before prediction"
                            )
                        ).model_dump()
                    )
                    continue

                loop = asyncio.get_running_loop()
                try:
                    result = await loop.run_in_executor(None, sign_recognition_pipeline.predict, frames, landmarks)
                except Exception as exc:
                    logger.exception("Sign recognition prediction failed")
                    await websocket.send_json(ErrorResponse(message=str(exc)).model_dump())
                else:
                    await websocket.send_json(
                        PredictionResponse(
                            predictions=[
                                PredictionItem(label=item.label, confidence=item.confidence)
                                for item in result["predictions"]
                            ],
                            preprocess_ms=result["preprocess_ms"],
                            inference_ms=result["inference_ms"],
                            total_ms=result["total_ms"],
                            frames_received=result["frames_received"],
                            is_confident=result["is_confident"],
                        ).model_dump()
                    )
                finally:
                    _buffers[websocket].clear()
                continue

            await websocket.send_json(ErrorResponse(message=f"Unsupported message type: {message_type}").model_dump())

    except WebSocketDisconnect:
        logger.info("Sign recognition WebSocket disconnected")
    except Exception:
        logger.exception("Unexpected sign recognition WebSocket error")
    finally:
        _buffers.pop(websocket, None)