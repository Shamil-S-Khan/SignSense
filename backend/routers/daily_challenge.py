from fastapi import APIRouter, Depends
from models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/api/daily-challenge", tags=["daily-challenge"])

@router.get("/today")
async def get_daily_challenge(current_user: User = Depends(get_current_user)):
    return {
        "sign": "HELLO",
        "description": "Spell the word HELLO perfectly.",
        "reward_xp": 100,
        "completed": False
    }

@router.post("/attempt")
async def attempt_daily_challenge(current_user: User = Depends(get_current_user)):
    # Stub for now
    return {"success": True, "xp_awarded": 100}
