from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..base import Base


class PredictionRecord(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Input telemetry
    tide_level_meters = Column(Float, nullable=False)
    rainfall_mm_per_hour = Column(Float, nullable=False)
    soil_saturation = Column(Float, default=0.7)
    cyclone_active = Column(Float, default=0.0)

    # ML Model Outputs
    flood_probability = Column(Float, nullable=False)
    projected_depth_meters = Column(Float, nullable=False)
    onset_time_minutes = Column(Integer, nullable=False)
    peak_time_minutes = Column(Integer, nullable=False)
    threat_level = Column(String(50), nullable=False)

    # XAI & Plain-language Explanations
    primary_drivers = Column(JSON, nullable=True)
    explanation_text = Column(String(1000), nullable=True)
    evacuation_priority_rank = Column(Integer, default=99)

    zone = relationship("Zone", back_populates="predictions")
