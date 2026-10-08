from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..base import Base


class AlertRecord(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False, index=True)
    issued_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    severity = Column(String(50), nullable=False)
    headline = Column(String(300), nullable=False)
    message_body = Column(String(1000), nullable=False)
    sms_text = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)

    zone = relationship("Zone", back_populates="alerts")
