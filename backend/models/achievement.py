import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class AchievementCategory(str, enum.Enum):
    MILESTONE = "milestone"
    ACCURACY = "accuracy"
    STREAK = "streak"
    DISCOVERY = "discovery"
    SOCIAL = "social"

class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    desc: Mapped[str] = mapped_column(String(255), nullable=False)
    hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[AchievementCategory] = mapped_column(Enum(AchievementCategory), nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False)

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    achievement_id: Mapped[str] = mapped_column(ForeignKey("achievements.id"), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
