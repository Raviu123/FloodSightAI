from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class ThreatLevel(str, Enum):
    NO_DANGER = "NO_DANGER"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SimulationInput(BaseModel):
    tide_level_meters: float = Field(default=2.4, ge=0.0, le=10.0, description="Tide level above MSL in meters")
    rainfall_mm_per_hour: float = Field(default=65.0, ge=0.0, le=500.0, description="Precipitation rate in mm/hour")
    forecast_hours: int = Field(default=6, ge=1, le=48, description="Prediction window in hours")
    wind_speed_kmh: Optional[float] = Field(default=35.0, ge=0.0, description="Wind speed in km/h")
    cyclone_active: Optional[bool] = Field(default=False, description="Whether a cyclonic storm surge is active")


class ZoneSimulationResult(BaseModel):
    zone_id: str
    zone_name: str
    elevation_meters: float
    current_water_level_meters: float
    projected_peak_level_meters: float
    time_to_peak_hours: float
    risk_level: ThreatLevel
    is_inundated: bool
    affected_population: int
    evacuation_priority: int


class SimulationResponse(BaseModel):
    threat_index: float
    overall_risk: ThreatLevel
    simulation_params: SimulationInput
    estimated_inundated_area_sq_km: float
    total_population_at_risk: int
    zones: List[ZoneSimulationResult]
    recommendation: str
