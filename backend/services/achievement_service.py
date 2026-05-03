from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.user import User
from models.achievement import Achievement, UserAchievement
from models.notification import Notification
from services.xp_service import XPService

class AchievementService:
    @staticmethod
    async def check_and_award(user: User, trigger_event: str, event_data: dict, db: AsyncSession):
        # Retrieve all achievements user doesn't have yet
        user_ach_stmt = select(UserAchievement.achievement_id).where(UserAchievement.user_id == user.id)
        user_ach_res = await db.execute(user_ach_stmt)
        earned_ids = [r for r in user_ach_res.scalars().all()]
        
        all_ach_stmt = select(Achievement).where(Achievement.id.not_in(earned_ids) if earned_ids else True)
        all_ach_res = await db.execute(all_ach_stmt)
        unearned = all_ach_res.scalars().all()
        
        newly_earned = []
        
        for ach in unearned:
            earned = False
            # Evaluate based on category and event
            if ach.category == "MILESTONE":
                if ach.id == "first_sign" and trigger_event == "sign_completed":
                    earned = True
                elif ach.id == "100_signs" and trigger_event == "sign_completed" and event_data.get("total_signs", 0) >= 100:
                    earned = True
            elif ach.category == "ACCURACY":
                if ach.id == "perfect_lesson" and trigger_event == "lesson_completed" and event_data.get("hearts_remaining") == 5:
                    earned = True
            elif ach.category == "STREAK":
                if ach.id == "streak_7" and user.current_streak >= 7:
                    earned = True
            elif ach.category == "DISCOVERY":
                if ach.id == "try_all_drills" and trigger_event == "drill_completed" and event_data.get("all_drills_tried"):
                    earned = True
            elif ach.category == "SOCIAL":
                if ach.id == "join_league" and trigger_event == "league_joined":
                    earned = True
                    
            if earned:
                # 1. Insert UserAchievement
                ua = UserAchievement(user_id=user.id, achievement_id=ach.id)
                db.add(ua)
                
                # 2. Award XP
                await XPService.award_xp(user, ach.xp_reward, db)
                
                # 3. Create Notification
                noti = Notification(
                    user_id=user.id,
                    message=f"Achievement Unlocked: {ach.name} (+{ach.xp_reward} XP)",
                    type="achievement"
                )
                db.add(noti)
                newly_earned.append(ach)
                
        if newly_earned:
            await db.commit()
            
        return newly_earned
