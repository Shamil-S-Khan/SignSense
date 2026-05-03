from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models.user import User
from models.achievement import UserAchievement, Achievement
from utils.auth import get_current_user

router = APIRouter(prefix="/api/achievements", tags=["achievements"])

@router.get("/")
async def get_achievements(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Join achievements and user_achievements
    stmt = select(Achievement, UserAchievement.earned_at).outerjoin(
        UserAchievement, 
        (Achievement.id == UserAchievement.achievement_id) & (UserAchievement.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    
    response = []
    for ach, earned_at in result.all():
        response.append({
            "id": ach.id,
            "name": ach.name,
            "desc": ach.desc,
            "category": ach.category,
            "xp_reward": ach.xp_reward,
            "earned": earned_at is not None,
            "earned_at": earned_at
        })
    return response
