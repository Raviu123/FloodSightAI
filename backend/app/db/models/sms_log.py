from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime, timezone
from ..base import Base


class SMSLogRecord(Base):
    __tablename__ = "sms_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), nullable=True, index=True)
    zone_name = Column(String(200), nullable=True)
    recipient = Column(String(50), nullable=False, index=True)
    message = Column(String(1000), nullable=False)
    status = Column(String(50), default="SENT")  # QUEUED, SENT, SIMULATED, FAILED
    status_code = Column(Integer, nullable=True)
    gateway = Column(String(50), default="textbee")
    gateway_batch_id = Column(String(100), nullable=True)
    simulated = Column(Boolean, default=False)
    error_details = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
