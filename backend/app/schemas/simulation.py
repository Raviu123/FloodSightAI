from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class ThreatLevel(str, Enum):
    NO_DANGER = "NO_DANGER"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ZoneOverrideItem(BaseModel):
    zone_id: str
    rainfall_mm_per_hour: Optional[float] = None
    soil_saturation: Optional[float] = None
    drainage_blocked_pct: Optional[float] = None


ZoneOverrideInput = ZoneOverrideItem


class SimulationInput(BaseModel):
    tide_level_meters: float = Field(default=2.4, ge=0.0, le=10.0, description="Tide level above MSL in meters")
    rainfall_mm_per_hour: float = Field(default=65.0, ge=0.0, le=500.0, description="Precipitation rate in mm/hour")
    forecast_hours: int = Field(default=6, ge=1, le=48, description="Prediction window in hours")
    wind_speed_kmh: Optional[float] = Field(default=35.0, ge=0.0, description="Wind speed in km/h")
    cyclone_active: Optional[bool] = Field(default=False, description="Whether a cyclonic storm surge is active")
    soil_saturation: Optional[float] = Field(default=0.75, ge=0.0, le=1.0, description="Soil saturation index (0-1)")
    river_discharge_m3_s: Optional[float] = Field(default=None, description="Optional upstream river discharge rate in m3/s")
    region_id: Optional[str] = Field(default=None, description="Optional target regional hotspot ID filter (e.g., mumbai, guwahati, chennai, all)")
    zone_overrides: Optional[List[ZoneOverrideItem]] = Field(default=None, description="Optional localized zone parameter overrides")


class DriverItem(BaseModel):
    factor_key: str
    factor_name: str
    contribution_pct: float
    raw_value: Optional[float] = None


class FacilityItem(BaseModel):
    name: str
    type: str
    elevation_meters: float
    capacity: int = 0
    status: str


class RoadItem(BaseModel):
    name: str
    elevation_meters: float
    status: str
    depth_over_road_m: Optional[float] = None


class EnhancedZoneResult(BaseModel):
    zone_id: str
    zone_name: str
    state: str
    region: str
    zone_type: str = "COASTAL"
    elevation_meters: float
    population: int
    dist_to_coast_km: float
    dist_to_river_km: float
    drainage_capacity_pct: float
    latitude: float
    longitude: float

    # ML Predictions
    flood_probability: float
    is_flooded: bool
    projected_depth_meters: float
    inundated_area_sq_km: float
    onset_time_minutes: int
    peak_time_minutes: int
    threat_level: ThreatLevel

    # Explainable AI (XAI)
    primary_drivers: List[DriverItem]
    plain_language_explanation: str

    # Decision & Infrastructure Impact
    priority_score: float
    evacuation_priority_rank: int
    threatened_facilities: List[FacilityItem]
    safe_shelters: List[FacilityItem]
    submerged_roads: List[RoadItem]
    passable_roads: List[RoadItem]
    recommended_action: str

    # Alert SMS Text
    alert_headline: str
    sms_text: str


class SimulationResponse(BaseModel):
    threat_index: float
    overall_risk: ThreatLevel
    simulation_params: SimulationInput
    estimated_inundated_area_sq_km: float
    total_population_at_risk: int
    critical_zones_count: int
    zones: List[EnhancedZoneResult]
    recommendation: str
    ai_validation_metrics: Optional[Dict[str, Any]] = None
    auto_sms_alerts: List[Dict[str, Any]] = Field(default=[], description="Automated SMS dispatches triggered for zones classified as CRITICAL")


class TimelineHourStep(BaseModel):
    hour: int
    tide_level_meters: float
    rainfall_mm_per_hour: float
    total_population_at_risk: int
    inundated_area_sq_km: float
    critical_zones_count: int
    overall_risk: ThreatLevel
    zone_depths: Dict[str, float]


class Timeline24hResponse(BaseModel):
    simulation_id: str
    generated_at: str
    total_hours: int = 24
    peak_hour: int
    peak_water_depth_m: float
    max_population_at_risk: int
    timeline_steps: List[TimelineHourStep]


class WhatIfInput(BaseModel):
    base_params: SimulationInput
    tide_delta_m: Optional[float] = Field(default=0.0, description="Delta change in tide level (+/- meters)")
    rain_delta_pct: Optional[float] = Field(default=0.0, description="Percentage change in rainfall (+/- %)")
    drainage_clearance_pct: Optional[float] = Field(default=0.0, description="Improvement in drainage capacity (+/- %)")


class WhatIfResponse(BaseModel):
    scenario_summary: str
    base_threat_level: ThreatLevel
    new_threat_level: ThreatLevel
    avoided_or_added_inundation_sq_km: float
    avoided_or_added_population_at_risk: int
    base_response: SimulationResponse
    counterfactual_response: SimulationResponse
