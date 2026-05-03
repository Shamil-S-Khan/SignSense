import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class SpacedRepetition(Base):
    __tablename__ = "spaced_repetition"
    __table_args__ = (UniqueConstraint("user_id", "sign_id", name="uq_sr_user_sign"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    sign_id: Mapped[str] = mapped_column(String(50), nullable=False)
    
    interval: Mapped[int] = mapped_column(Integer, default=1)  # Days
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    next_review: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    consecutive_correct: Mapped[int] = mapped_column(Integer, default=0)
