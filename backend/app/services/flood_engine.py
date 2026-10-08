from typing import List, Dict, Any
from app.schemas.simulation import (
    SimulationInput,
    SimulationResponse,
    ThreatLevel,
    ZoneSimulationResult,
)

# Mock baseline data for Indian coastal monitoring stations
DEFAULT_COASTAL_ZONES: List[Dict[str, Any]] = [
    {
        "id": "ZONE-01",
        "name": "Mangalore Estuary & Netravati Confluence",
        "state": "Karnataka",
        "region": "West Coast",
        "elevation_meters": 0.8,
        "population": 14200,
        "base_risk": ThreatLevel.HIGH,
    },
    {
        "id": "ZONE-02",
        "name": "Udupi Lowland Swamps & Malpe Port Area",
        "state": "Karnataka",
        "region": "West Coast",
        "elevation_meters": 1.3,
        "population": 8900,
        "base_risk": ThreatLevel.MEDIUM,
    },
    {
        "id": "ZONE-03",
        "name": "Kochi Backwaters & Canal Network",
        "state": "Kerala",
        "region": "South-West Coast",
        "elevation_meters": 0.5,
        "population": 32000,
        "base_risk": ThreatLevel.CRITICAL,
    },
    {
        "id": "ZONE-04",
        "name": "Chennai Marina Lowlands & Adyar Delta",
        "state": "Tamil Nadu",
        "region": "East Coast",
        "elevation_meters": 2.1,
        "population": 45000,
        "base_risk": ThreatLevel.LOW,
    },
    {
        "id": "ZONE-05",
        "name": "Visakhapatnam Harbor & Coastal Bay",
        "state": "Andhra Pradesh",
        "region": "East Coast",
        "elevation_meters": 3.4,
        "population": 18000,
        "base_risk": ThreatLevel.NO_DANGER,
    },
]


def calculate_flood_simulation(params: SimulationInput) -> SimulationResponse:
    """
    Simulates flood inundation and risk levels across coastal zones based on:
    - Tide surge (meters above MSL)
    - Rainfall intensity (mm/hour)
    - Forecast window (hours)
    - Wind and cyclonic factor
    """
    cyclone_multiplier = 1.35 if params.cyclone_active else 1.0
    effective_water_surge = (
        (params.tide_level_meters * 0.75)
        + ((params.rainfall_mm_per_hour / 100.0) * 0.45)
    ) * cyclone_multiplier

    # Threat score calculation (0 - 100)
    threat_index = min(
        100.0,
        (params.tide_level_meters * 15.0)
        + (params.rainfall_mm_per_hour * 0.35)
        + (15.0 if params.cyclone_active else 0.0),
    )

    if threat_index >= 75:
        overall_risk = ThreatLevel.CRITICAL
        recommendation = "Immediate evacuation of Tier-1 coastal lowlands required. Issue red alert to emergency units."
    elif threat_index >= 50:
        overall_risk = ThreatLevel.HIGH
        recommendation = "Deploy barrier pumps and place emergency rescue vessels on active standby."
    elif threat_index >= 30:
        overall_risk = ThreatLevel.MEDIUM
        recommendation = "Monitor water ingress at river mouths. Issue advisory to coastal fishing communities."
    else:
        overall_risk = ThreatLevel.LOW
        recommendation = "Conditions normal. Regular tidal fluctuation observed."

    zone_results: List[ZoneSimulationResult] = []
    total_population_at_risk = 0
    inundated_area_sq_km = 0.0

    for idx, zone in enumerate(DEFAULT_COASTAL_ZONES):
        zone_elevation = zone["elevation_meters"]
        projected_water = max(0.0, round(effective_water_surge - (zone_elevation * 0.2), 2))
        is_inundated = projected_water > zone_elevation

        if is_inundated:
            time_to_peak = max(0.5, round(params.forecast_hours * 0.45, 1))
            zone_risk = ThreatLevel.CRITICAL if projected_water > (zone_elevation + 1.0) else ThreatLevel.HIGH
            total_population_at_risk += zone["population"]
            inundated_area_sq_km += 4.5
        elif projected_water > (zone_elevation * 0.7):
            time_to_peak = max(1.0, round(params.forecast_hours * 0.75, 1))
            zone_risk = ThreatLevel.MEDIUM
        else:
            time_to_peak = round(float(params.forecast_hours), 1)
            zone_risk = ThreatLevel.LOW

        zone_results.append(
            ZoneSimulationResult(
                zone_id=zone["id"],
                zone_name=zone["name"],
                elevation_meters=zone_elevation,
                current_water_level_meters=round(projected_water * 0.6, 2),
                projected_peak_level_meters=projected_water,
                time_to_peak_hours=time_to_peak,
                risk_level=zone_risk,
                is_inundated=is_inundated,
                affected_population=zone["population"] if is_inundated else 0,
                evacuation_priority=idx + 1 if is_inundated else 99,
            )
        )

    # Sort zones by evacuation priority
    zone_results.sort(key=lambda x: x.evacuation_priority)

    return SimulationResponse(
        threat_index=round(threat_index, 1),
        overall_risk=overall_risk,
        simulation_params=params,
        estimated_inundated_area_sq_km=round(inundated_area_sq_km, 2),
        total_population_at_risk=total_population_at_risk,
        zones=zone_results,
        recommendation=recommendation,
    )
