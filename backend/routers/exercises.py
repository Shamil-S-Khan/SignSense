import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from models.sign_attempt import SignAttempt
from utils.auth import get_current_user
from services.xp_service import XPService
from services.streak_service import StreakService
from services.sr_service import SRService
from services.achievement_service import AchievementService
from datetime import datetime

router = APIRouter(prefix="/api/exercises", tags=["exercises"])

class AttemptRequest(BaseModel):
    sign_id: str
    handshape_score: float
    orientation_score: float
    movement_score: float

@router.post("/attempt")
async def record_attempt(
    req: AttemptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Calculate overall score: 35% handshape, 35% movement, 30% orientation
    overall_score = (req.handshape_score * 0.35) + (req.movement_score * 0.35) + (req.orientation_score * 0.30)
    
    # Check attempt number in current session (stubbed as 1 for now)
    attempt_num = 1
    
    attempt = SignAttempt(
        user_id=current_user.id,
        sign_id=req.sign_id,
        handshape_score=req.handshape_score,
        orientation_score=req.orientation_score,
        movement_score=req.movement_score,
        overall_score=overall_score,
        attempt_number=attempt_num
    )
    db.add(attempt)
    
    # 1. Spaced Repetition update
    await SRService.record_attempt(str(current_user.id), req.sign_id, overall_score, db)
    
    # 2. XP Award
    xp_earned = XPService.calculate_exercise_xp(overall_score, attempt_num)
    xp_result = await XPService.award_xp(current_user, xp_earned, db)
    
    # 3. Streak check
    streak_result = await StreakService.record_session(current_user, datetime.utcnow(), db)
    
    # 4. Achievements check
    ach_result = await AchievementService.check_and_award(
        current_user, 
        trigger_event="sign_completed", 
        event_data={"overall_score": overall_score}, 
        db=db
    )
    
    await db.commit()
    
    return {
        "success": True,
        "overall_score": overall_score,
        "xp_awarded": xp_result,
        "streak_status": streak_result,
        "achievements_unlocked": [a.id for a in ach_result]
    }
