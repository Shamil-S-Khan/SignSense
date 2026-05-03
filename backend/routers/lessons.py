from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from database import get_db
from models.user import User
from models.lesson import LessonAttempt
from utils.auth import get_current_user
from services.xp_service import XPService
from services.achievement_service import AchievementService

router = APIRouter(prefix="/api/lessons", tags=["lessons"])

class CompletionRequest(BaseModel):
    hearts_remaining: int
    accuracy: float

LESSON_SIGNS = {
    "basics_1": ["A", "B", "C"],
    "basics_2": ["D", "E", "F"],
    "basics_3": ["G", "H", "I"],
    "basics_4": ["K", "L", "M"],
    "basics_5": ["N", "O", "P"],
    "basics_6": ["Q", "R", "S"],
    "basics_7": ["T", "U", "V"],
    "basics_8": ["W", "X", "Y"],
    "greetings": ["hello", "goodbye", "fine", "thanksgiving"],
    "food": ["drink", "apple", "pizza", "eat", "candy"],
    "actions": ["go", "walk", "read", "write", "play"],
    "colors": ["red", "blue", "yellow", "white", "black"]
}

@router.get("/{lesson_id}")
async def get_lesson(lesson_id: str, current_user: User = Depends(get_current_user)):
    signs = LESSON_SIGNS.get(lesson_id, ["A", "B", "C"])
    return {
        "id": lesson_id,
        "title": f"Lesson {lesson_id.replace('_', ' ').capitalize()}",
        "signs": signs,
        "total_hearts": 5
    }

@router.post("/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: str,
    req: CompletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    bonus_xp = XPService.calculate_lesson_completion_bonus(req.hearts_remaining)
    xp_result = await XPService.award_xp(current_user, bonus_xp, db)
    
    attempt = LessonAttempt(
        user_id=current_user.id,
        lesson_id=lesson_id,
        hearts_remaining=req.hearts_remaining,
        xp_earned=bonus_xp,
        accuracy=req.accuracy
    )
    db.add(attempt)
    
    ach_result = await AchievementService.check_and_award(
        current_user,
        trigger_event="lesson_completed",
        event_data={"hearts_remaining": req.hearts_remaining},
        db=db
    )
    
    await db.commit()
    
    return {
        "success": True,
        "xp_awarded": xp_result,
        "achievements_unlocked": [a.id for a in ach_result]
    }
