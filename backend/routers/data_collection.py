"""
Data collection endpoint - saves signed clips to disk for fine-tuning.

Clips saved under:
  backend/training_data/{WORD}/clip_{n:04d}/frame_{i:04d}.jpg
  backend/training_data/{WORD}/manifest.json  (clip count + timestamps)
"""

import base64
import json
import logging
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("data_collection")

router = APIRouter(prefix="/api/data-collection", tags=["data-collection"])

# backend/training_data/
_TRAINING_DATA_DIR = Path(__file__).resolve().parent.parent / "training_data"


def _word_dir(word: str) -> Path:
    d = _TRAINING_DATA_DIR / word.upper()
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_manifest(word_dir: Path) -> dict:
    p = word_dir / "manifest.json"
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"word": word_dir.name, "clip_count": 0, "clips": []}


def _save_manifest(word_dir: Path, manifest: dict) -> None:
    p = word_dir / "manifest.json"
    with open(p, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


class RecordClipRequest(BaseModel):
    word: str
    frames: list[str]  # base64 JPEG strings (no data-URL prefix)


class RecordClipResponse(BaseModel):
    word: str
    clip_index: int
    frames_saved: int
    clip_path: str
    total_clips: int


class ClipInfo(BaseModel):
    index: int
    frames: int
    recorded_at: str
    path: str


class WordStatsResponse(BaseModel):
    word: str
    total_clips: int
    clips: list[ClipInfo]


@router.post("/record", response_model=RecordClipResponse)
async def record_clip(body: RecordClipRequest) -> RecordClipResponse:
    """Accept base64 JPEG frames from the browser and save them to disk."""
    word = body.word.strip().upper()
    if not word:
        raise HTTPException(status_code=400, detail="word must not be empty")
    if not body.frames:
        raise HTTPException(status_code=400, detail="frames list is empty")

    word_dir = _word_dir(word)
    manifest = _load_manifest(word_dir)
    clip_index = manifest["clip_count"]

    clip_dir = word_dir / f"clip_{clip_index:04d}"
    clip_dir.mkdir(exist_ok=True)

    frames_saved = 0
    for i, b64 in enumerate(body.frames):
        try:
            jpeg_bytes = base64.b64decode(b64)
        except Exception:
            logger.warning("Skipping malformed frame %d for %s", i, word)
            continue
        (clip_dir / f"frame_{i:04d}.jpg").write_bytes(jpeg_bytes)
        frames_saved += 1

    manifest["clip_count"] = clip_index + 1
    manifest["clips"].append({
        "index": clip_index,
        "frames": frames_saved,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "path": str(clip_dir.relative_to(_TRAINING_DATA_DIR)),
    })
    _save_manifest(word_dir, manifest)

    logger.info("Saved clip %d for %s (%d frames) -> %s", clip_index, word, frames_saved, clip_dir)

    return RecordClipResponse(
        word=word,
        clip_index=clip_index,
        frames_saved=frames_saved,
        clip_path=str(clip_dir.relative_to(_TRAINING_DATA_DIR)),
        total_clips=manifest["clip_count"],
    )


@router.delete("/clip/{word}/{clip_index}", status_code=204)
async def delete_clip(word: str, clip_index: int) -> None:
    """Delete a specific clip folder and update manifest."""
    import shutil
    w = word.strip().upper()
    word_dir = _TRAINING_DATA_DIR / w
    if not word_dir.exists():
        raise HTTPException(status_code=404, detail=f"No data for word {w}")
    manifest = _load_manifest(word_dir)
    clip_dir = word_dir / f"clip_{clip_index:04d}"
    if clip_dir.exists():
        shutil.rmtree(clip_dir)
    manifest["clips"] = [c for c in manifest["clips"] if c["index"] != clip_index]
    _save_manifest(word_dir, manifest)


@router.get("/stats/{word}", response_model=WordStatsResponse)
async def word_stats(word: str) -> WordStatsResponse:
    w = word.strip().upper()
    word_dir = _TRAINING_DATA_DIR / w
    if not word_dir.exists():
        return WordStatsResponse(word=w, total_clips=0, clips=[])
    m = _load_manifest(word_dir)
    return WordStatsResponse(
        word=w,
        total_clips=m["clip_count"],
        clips=[ClipInfo(**c) for c in m["clips"]],
    )


@router.get("/stats", response_model=list[WordStatsResponse])
async def all_stats() -> list[WordStatsResponse]:
    if not _TRAINING_DATA_DIR.exists():
        return []
    results = []
    for wd in sorted(_TRAINING_DATA_DIR.iterdir()):
        if not wd.is_dir():
            continue
        m = _load_manifest(wd)
        results.append(WordStatsResponse(
            word=m.get("word", wd.name),
            total_clips=m["clip_count"],
            clips=[ClipInfo(**c) for c in m["clips"]],
        ))
    return results