from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User

class StreakService:
    @staticmethod
    async def record_session(user: User, session_date: datetime, db: AsyncSession) -> dict:
        """
        Updates user streak based on session_date.
        Rules:
        - Same day: no-op
        - Consecutive day: increment current_streak, check longest
        - 1-day gap with shield: current_streak maintained, shield consumed
        - 1-day gap without shield: reset current_streak to 1
        - 2+ day gap: reset current_streak to 1
        """
        result = {
            "streak_updated": False,
            "shield_used": False,
            "streak_lost": False,
            "current_streak": user.current_streak,
            "milestone_hit": None
        }

        if not user.last_session_date:
            user.current_streak = 1
            user.longest_streak = 1
            user.last_session_date = session_date
            result["streak_updated"] = True
            result["current_streak"] = 1
            return result

        last_date = user.last_session_date.date()
        current_date = session_date.date()
        delta_days = (current_date - last_date).days

        if delta_days == 0:
            return result

        if delta_days == 1:
            user.current_streak += 1
            result["streak_updated"] = True
        elif delta_days == 2 and user.streak_shields > 0:
            user.streak_shields -= 1
            user.current_streak += 1
            result["shield_used"] = True
            result["streak_updated"] = True
        else:
            user.current_streak = 1
            result["streak_lost"] = True
            result["streak_updated"] = True

        if user.current_streak > user.longest_streak:
            user.longest_streak = user.current_streak

        user.last_session_date = session_date

        # Check milestones {7, 14, 30, 90, 365}
        milestones = {7, 14, 30, 90, 365}
        if result["streak_updated"] and user.current_streak in milestones:
            user.streak_shields += 1 # Award a shield
            result["milestone_hit"] = user.current_streak

        db.add(user)
        await db.commit()
        
        result["current_streak"] = user.current_streak
        return result
