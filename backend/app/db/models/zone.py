from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from ..base import Base


class Zone(Base):
    __tablename__ = "zones"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    state = Column(String(100), nullable=False)
    region = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_meters = Column(Float, nullable=False)
    population = Column(Integer, nullable=False)
    dist_to_coast_km = Column(Float, nullable=False)
    dist_to_river_km = Column(Float, nullable=False)
    drainage_capacity_pct = Column(Float, nullable=False, default=50.0)
    soil_saturation_base = Column(Float, nullable=False, default=0.5)
    polygon_coordinates = Column(JSON, nullable=True)

    # Relationships
    facilities = relationship("CriticalFacility", back_populates="zone", cascade="all, delete-orphan")
    roads = relationship("AffectedRoad", back_populates="zone", cascade="all, delete-orphan")
    predictions = relationship("PredictionRecord", back_populates="zone", cascade="all, delete-orphan")
    alerts = relationship("AlertRecord", back_populates="zone", cascade="all, delete-orphan")
    subscribers = relationship("ZoneSubscriber", back_populates="zone", cascade="all, delete-orphan")


class ZoneSubscriber(Base):
    __tablename__ = "zone_subscribers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False, index=True)
    zone_name = Column(String(200), nullable=False)
    phone_number = Column(String(50), nullable=False, index=True)
    name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    subscribed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    zone = relationship("Zone", back_populates="subscribers")


class CriticalFacility(Base):
    __tablename__ = "critical_facilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    facility_type = Column(String(50), nullable=False)  # HOSPITAL, SHELTER, POWER_SUBSTATION, SCHOOL
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_meters = Column(Float, nullable=False)
    capacity = Column(Integer, default=0)
    is_at_risk = Column(Boolean, default=False)

    zone = relationship("Zone", back_populates="facilities")


class AffectedRoad(Base):
    __tablename__ = "affected_roads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    road_type = Column(String(50), default="PRIMARY")  # HIGHWAY, ARTERIAL, LOCAL
    elevation_meters = Column(Float, nullable=False)
    flood_cutoff_depth_m = Column(Float, default=0.3)
    status = Column(String(50), default="CLEAR")  # CLEAR, PARTIALLY_FLOODED, SUBMERGED

    zone = relationship("Zone", back_populates="roads")
