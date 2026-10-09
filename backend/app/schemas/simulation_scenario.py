"""
Pydantic Schemas for Multi-Scenario 2D Hydrodynamic Flood Simulation.
Enforces explicit unit validation, boundary conditions, scenario provenance,
and comparative delta models.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class RainfallPattern(str, Enum):
    CONSTANT = "constant"
    TRIANGULAR_PEAK = "triangular_peak"
    FRONT_LOADED = "front_loaded"
    BACK_LOADED = "back_loaded"


class SimulationScenarioConfig(BaseModel):
    """Configuration definition for a flood simulation scenario."""
    scenario_id: str = Field(..., min_length=2, max_length=64, description="Unique identifier for the scenario")
    name: str = Field(..., min_length=2, max_length=128, description="Human-readable scenario title")
    description: str = Field("", max_length=512, description="Summary of scenario conditions and assumptions")
    spatial_domain: str = Field("mumbai", description="Region ID (e.g. mumbai, patna, kochi, chennai)")
    
    # Rainfall Parameters
    rainfall_intensity_mm_h: float = Field(65.0, ge=0.0, le=500.0, description="Rainfall intensity in mm/hour")
    rainfall_duration_hours: float = Field(6.0, ge=0.5, le=72.0, description="Rainfall duration in hours")
    rainfall_pattern: RainfallPattern = Field(RainfallPattern.CONSTANT, description="Temporal hyetograph profile")
    
    # Infiltration & Soil Moisture Parameters
    soil_saturation_index: float = Field(0.75, ge=0.0, le=1.0, description="Initial soil saturation index (0.0 = dry, 1.0 = saturated)")
    curve_number_override: Optional[float] = Field(None, ge=30.0, le=100.0, description="Optional SCS Curve Number override")
    
    # Boundary Conditions
    coastal_surge_stage_m: float = Field(0.0, ge=0.0, le=10.0, description="Downstream coastal storm surge sea level in meters MSL")
    river_inflow_m3_s: float = Field(0.0, ge=0.0, le=50000.0, description="Upstream river channel discharge rate in m³/s")
    wind_speed_kmh: float = Field(0.0, ge=0.0, le=300.0, description="Wind speed used only for scenario provenance and boundary modeling")
    cyclone_active: bool = Field(False, description="Scenario flag; does not create water without compatible boundary forcing")
    zone_overrides: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Localized rainfall, saturation, and drainage overrides keyed by stable zone ID",
    )
    
    # Execution Settings
    time_step_minutes: float = Field(15.0, ge=1.0, le=60.0, description="Simulation temporal discretization step in minutes")
    total_duration_hours: float = Field(12.0, ge=1.0, le=72.0, description="Total simulation propagation duration in hours")
    
    # Provenance Disclaimer
    hypothetical_disclaimer: str = Field(
        "Hypothetical scenario simulation for planning and sensitivity analysis. Not a real-time calibrated forecast.",
        description="Explicit notice regarding scenario assumptions"
    )

    from pydantic import model_validator

    @model_validator(mode="after")
    def validate_durations(self) -> SimulationScenarioConfig:
        if self.rainfall_duration_hours > self.total_duration_hours:
            raise ValueError("Rainfall duration cannot exceed total simulation duration")
        return self


class SpatialZoneSummary(BaseModel):
    """Aggregated zone-level flood metrics computed from fine grid."""
    zone_id: str
    zone_name: str
    mean_water_depth_m: float
    max_water_depth_m: float
    inundated_area_sq_km: float
    population_at_risk: int
    threat_level: str
    mean_arrival_time_min: Optional[float] = None


class SimulationFrame(BaseModel):
    """A time-indexed spatial snapshot from the immutable terrain simulation."""
    time_minutes: float
    inundated_area_sq_km: float
    max_water_depth_m: float
    mean_water_surface_elevation_m: float
    cumulative_runoff_volume_m3: float
    cumulative_outflow_volume_m3: float
    quality_flags: List[str] = Field(default_factory=list)
    geojson_output: Dict[str, Any]


class ScenarioRunResult(BaseModel):
    """Complete execution output record for a single scenario run."""
    run_id: str
    scenario_config: SimulationScenarioConfig
    model_version: str = "v2.0-2d-storage-cell-hydro"
    executed_at: str
    execution_duration_ms: float
    
    # Hydrodynamic Conservation & Quality Flags
    mass_balance_error_pct: float
    total_rainfall_volume_m3: float
    total_runoff_volume_m3: float
    total_infiltrated_volume_m3: float
    
    # Output Aggregations
    inundated_area_sq_km: float
    max_water_depth_m: float
    mean_water_depth_m: float
    affected_population: int
    
    # Zone-level aggregations
    zone_summaries: List[SpatialZoneSummary]

    # Hourly spatial snapshots used by map playback. Terrain inputs are not duplicated or mutated.
    timeline: List[SimulationFrame] = Field(default_factory=list)
    
    # GeoJSON FeatureCollection containing depth grid polygons ($d >= 0.05m$)
    geojson_output: Dict[str, Any]


class ScenarioComparisonRequest(BaseModel):
    """Request payload to compare two compatible scenario runs."""
    baseline_run_id: str
    comparison_run_id: str


class ScenarioComparisonResult(BaseModel):
    """Comparative analysis output comparing two scenario runs."""
    comparison_id: str
    baseline_run_id: str
    comparison_run_id: str
    spatial_domain: str
    compared_at: str
    
    # Comparative Deltas (Comparison minus Baseline)
    delta_inundated_area_sq_km: float
    delta_max_depth_m: float
    delta_affected_population: int
    
    # Summary of parameter differences
    parameter_differences: Dict[str, Dict[str, Any]]
    
    # GeoJSON FeatureCollection of spatial depth deltas ($\Delta d(x,y)$)
    geojson_delta_output: Dict[str, Any]


class ScenarioPreset(BaseModel):
    """Pre-defined scenario preset configuration."""
    preset_id: str
    title: str
    category: str
    description: str
    config: SimulationScenarioConfig
