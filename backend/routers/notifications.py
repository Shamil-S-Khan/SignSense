from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models.user import User
from models.notification import Notification
from utils.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/unread")
async def get_unread(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).order_by(Notification.timestamp.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    result = await db.execute(stmt)
    noti = result.scalar_one_or_none()
    
    if noti:
        noti.is_read = True
        await db.commit()
        return {"success": True}
    return {"success": False, "error": "Not found"}
