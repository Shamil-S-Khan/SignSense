import math
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User

class XPService:
    @staticmethod
    def get_level_threshold(level: int) -> int:
        if level <= 1:
            return 0
        
        # Level 1 = 0 XP, each next = prev * 1.5 rounded to nearest 50
        # Wait, the spec says: "each next = prev * 1.5 rounded to nearest 50".
        # Let's compute this iteratively.
        threshold = 100 # Base for level 2
        for _ in range(2, level):
            threshold = round((threshold * 1.5) / 50) * 50
        return threshold

    @staticmethod
    def get_level_from_xp(xp: int) -> int:
        # Find the max level where threshold <= xp
        # Cap at level 50 as per spec
        level = 1
        while level < 50:
            if XPService.get_level_threshold(level + 1) > xp:
                break
            level += 1
        return level

    @staticmethod
    def calculate_exercise_xp(overall_score: float, attempt_number: int, exercise_type: str = "practice") -> int:
        base_xp = 10 if exercise_type == "practice" else 20
        bonus = 0
        if overall_score >= 90:
            bonus += 5
        if attempt_number == 1:
            bonus += 5
        return base_xp + bonus

    @staticmethod
    def calculate_lesson_completion_bonus(hearts_remaining: int) -> int:
        return 25 if hearts_remaining == 5 else 15

    @staticmethod
    def apply_streak_multiplier(base_xp: int, streak_count: int) -> int:
        if streak_count >= 30:
            return int(base_xp * 2.0)
        elif streak_count >= 7:
            return int(base_xp * 1.5)
        return base_xp

    @staticmethod
    async def award_xp(user: User, xp_amount: int, db: AsyncSession) -> dict:
        old_level = user.level
        user.xp += xp_amount
        user.level = XPService.get_level_from_xp(user.xp)
        
        db.add(user)
        await db.commit()
        
        return {
            "xp_added": xp_amount,
            "total_xp": user.xp,
            "level_up": user.level > old_level,
            "new_level": user.level
        }
