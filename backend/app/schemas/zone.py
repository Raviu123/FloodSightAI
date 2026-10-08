from pydantic import BaseModel, Field
from typing import List, Optional
from .simulation import ThreatLevel


class Coordinates(BaseModel):
    latitude: float
    longitude: float


class CriticalFacility(BaseModel):
    id: str
    name: str
    facility_type: str  # hospital, shelter, power_station, port
    elevation_meters: float
    is_operational: bool
    coordinates: Coordinates


class CoastalZone(BaseModel):
    id: str
    name: str
    state: str
    coastal_region: str
    elevation_meters: float
    risk_level: ThreatLevel
    population: int
    coordinates: Coordinates
    critical_facilities: List[CriticalFacility] = []
    water_body_connections: List[str] = []


class ZoneDetailResponse(BaseModel):
    zone: CoastalZone
    current_water_level: float
    historical_max_flood_height: float
    safe_evacuation_routes: List[str]
