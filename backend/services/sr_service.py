from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.user import User
from models.spaced_repetition import SpacedRepetition

class SRService:
    @staticmethod
    async def record_attempt(user_id: str, sign_id: str, overall_score: float, db: AsyncSession):
        stmt = select(SpacedRepetition).where(
            SpacedRepetition.user_id == user_id,
            SpacedRepetition.sign_id == sign_id
        )
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        
        if not record:
            record = SpacedRepetition(
                user_id=user_id,
                sign_id=sign_id,
                interval=1,
                ease_factor=2.5,
                consecutive_correct=0,
            )
            db.add(record)
            
        # SuperMemo-2 algorithm adaptation
        # overall_score is 0-100. Let's map it to quality 0-5.
        quality = max(0, min(5, int(overall_score / 20)))
        
        if quality >= 3:
            if record.consecutive_correct == 0:
                record.interval = 1
            elif record.consecutive_correct == 1:
                record.interval = 6
            else:
                record.interval = int(record.interval * record.ease_factor)
            
            record.consecutive_correct += 1
        else:
            record.consecutive_correct = 0
            record.interval = 1
            
        # Update ease factor
        record.ease_factor = record.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        if record.ease_factor < 1.3:
            record.ease_factor = 1.3
            
        from datetime import timedelta
        record.next_review = datetime.utcnow() + timedelta(days=record.interval)
        
        await db.commit()
        return record

    @staticmethod
    async def get_due_signs(user_id: str, limit: int, db: AsyncSession):
        stmt = select(SpacedRepetition).where(
            SpacedRepetition.user_id == user_id,
            SpacedRepetition.next_review <= datetime.utcnow()
        ).order_by(SpacedRepetition.next_review).limit(limit)
        
        result = await db.execute(stmt)
        return result.scalars().all()
