"""
WebSocket handler — receives landmarks from the browser at 30fps,
runs them through the recognition engine, and sends back predictions.

Protocol:
  Client → Server:
    {"action": "start_drill", "sign": "A", "session_id": "abc123"}
    {"landmarks": [...63 floats...], "session_id": "abc123"}
    {"action": "end_drill", "session_id": "abc123"}

  Server → Client:
    {"prediction": "A", "confidence": 0.92}                     (per-frame)
    {"type": "scores", "handshape": 85, "orientation": 90, ...} (end of drill)
    {"type": "coaching", "tip": "Try curling your..."}          (async, ~1-2s later)
"""

import asyncio
import json
import logging
from collections import deque
from typing import Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from recognition import engine as recognition_engine
from scoring import scoring_engine
from coaching import get_coaching_tip
from config import settings

logger = logging.getLogger("ws_handler")

router = APIRouter()


class DrillSession:
    """Per-session state for an active drill."""
    def __init__(self, target_sign: str, session_id: str):
        self.target_sign = target_sign
        self.session_id = session_id
        # Pose-TGCN expects 50 frames
        self.frame_buffer = deque(maxlen=50)
        self.all_frames = []
        self.per_frame_confidences = []
        self.active = True
        # Check if the target is a dynamic sign (word) or static (letter)
        self.is_dynamic = len(target_sign) > 1


# Active sessions keyed by session_id
_sessions: Dict[str, DrillSession] = {}


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("WebSocket client connected")

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)

            action = data.get("action")
            session_id = data.get("session_id", "default")

            # ── Start Drill ────────────────────────────────
            if action == "start_drill":
                target_sign = data.get("sign", "A")
                _sessions[session_id] = DrillSession(target_sign, session_id)
                logger.info("[DRILL] Started drill for '%s' (dynamic=%s)", target_sign, len(target_sign) > 1)
                print(f"[DRILL] Started drill for '{target_sign}' (dynamic={len(target_sign) > 1})")
                await ws.send_json({"type": "drill_started", "sign": target_sign})
                continue

            # ── End Drill ──────────────────────────────────
            if action == "end_drill":
                session = _sessions.get(session_id)
                if session and session.active:
                    session.active = False

                    # Run scoring engine
                    scores = scoring_engine.score(
                        target_sign=session.target_sign,
                        captured_frames=session.all_frames,
                        per_frame_confidences=session.per_frame_confidences,
                    )
                    await ws.send_json({"type": "scores", **scores})

                    # Async coaching tip (fire-and-forget style with await)
                    asyncio.create_task(
                        _send_coaching(ws, session.target_sign, scores)
                    )

                    del _sessions[session_id]
                continue

            # ── Landmark Frame ─────────────────────────────
            landmarks = data.get("landmarks")
            if landmarks is not None:
                session = _sessions.get(session_id)
                
                # Debug: log every 30th frame to avoid spam
                frame_count = len(session.all_frames) if session else -1
                if frame_count % 30 == 0:
                    print(f"[WS] Frame #{frame_count}, landmarks len={len(landmarks)}, session={session_id}, active={session.active if session else 'no session'}")

                if session and session.active:
                    # For dynamic signs, we accumulate frames
                    session.frame_buffer.append(landmarks)
                    session.all_frames.append(landmarks)

                    if session.is_dynamic:
                        # Only run dynamic prediction if we have enough frames
                        if len(session.frame_buffer) >= 50:
                            label, confidence = recognition_engine.predict_dynamic(list(session.frame_buffer))
                        else:
                            label, confidence = "...", 0.0
                    else:
                        # Static sign (fingerspelling)
                        label, confidence = recognition_engine.predict_fingerspelling(landmarks)
                    
                    # Debug: log predictions every 30 frames
                    if frame_count % 30 == 0:
                        print(f"[WS] Prediction: '{label}' conf={confidence:.3f} target='{session.target_sign}'")
                    
                    # Track confidence for the TARGET sign
                    if label.upper() == session.target_sign.upper():
                        session.per_frame_confidences.append(confidence)
                    else:
                        session.per_frame_confidences.append(0.0)

                    response = {
                        "type": "prediction",
                        "prediction": label,
                        "confidence": round(confidence, 3),
                        "target": session.target_sign,
                    }
                else:
                    # Free-roam / no active drill: default to fingerspelling
                    label, confidence = recognition_engine.predict_fingerspelling(landmarks)
                    response = {
                        "type": "prediction",
                        "prediction": label,
                        "confidence": round(confidence, 3),
                    }

                await ws.send_json(response)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        # Clean up any active sessions for this connection
        pass


async def _send_coaching(ws: WebSocket, target_sign: str, scores: dict):
    """Send coaching tip asynchronously (non-blocking)."""
    try:
        issues = scores.get("issues", [])
        tip = await get_coaching_tip(
            target_sign=target_sign,
            scores=scores,
            issues=issues,
            api_key=getattr(settings, "GROQ_API_KEY", None),
        )
        await ws.send_json({"type": "coaching", "tip": tip})
    except Exception as e:
        logger.error("Failed to send coaching tip: %s", e)
