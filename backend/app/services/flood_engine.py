import uuid
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.schemas.simulation import (
    SimulationInput,
    SimulationResponse,
    ThreatLevel,
    EnhancedZoneResult,
    DriverItem,
    FacilityItem,
    RoadItem,
    Timeline24hResponse,
    TimelineHourStep,
    WhatIfInput,
    WhatIfResponse,
)
from app.models.zone import Zone
from app.models.prediction import PredictionRecord
from app.services.ml_predictor import ml_predictor
from app.services.xai_engine import xai_engine
from app.services.decision_engine import decision_engine
from app.services.llm_service import llm_service
from app.services.sms_service import sms_service

# Comprehensive National Flood Hub Master Registry covering all Hotspots HUD presets
NATIONWIDE_REGIONAL_SEEDS: List[Dict[str, Any]] = [
    {
        "id": "IXE-01",
        "name": "Mangalore Estuary & Netravati Confluence",
        "state": "Karnataka",
        "region": "mangalore",
        "zone_type": "COASTAL",
        "latitude": 12.8615,
        "longitude": 74.8430,
        "elevation_meters": 0.8,
        "population": 14200,
        "dist_to_coast_km": 0.35,
        "dist_to_river_km": 0.05,
        "drainage_capacity_pct": 32.0,
        "soil_saturation_base": 0.78,
        "default_river_discharge": 350.0,
        "facilities": [
            {"name": "Mangalore City Trauma Center", "type": "HOSPITAL", "elevation_meters": 1.1, "capacity": 350, "status": "OPERATIONAL"},
            {"name": "Sultan Batteri Highland Emergency Shelter", "type": "SHELTER", "elevation_meters": 14.5, "capacity": 2500, "status": "OPERATIONAL"},
            {"name": "Jeppu Power Grid Substation", "type": "POWER_SUBSTATION", "elevation_meters": 0.9, "capacity": 0, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "NH-66 Netravati Bridge Lowland Approach", "elevation_meters": 0.7, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Bolar Estuary River Road", "elevation_meters": 0.5, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Jeppu Higher Ground Bypass", "elevation_meters": 8.5, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "COK-02",
        "name": "Kochi Backwaters & Canal Network",
        "state": "Kerala",
        "region": "kochi",
        "zone_type": "COASTAL",
        "latitude": 9.9674,
        "longitude": 76.2440,
        "elevation_meters": 0.5,
        "population": 32000,
        "dist_to_coast_km": 1.10,
        "dist_to_river_km": 0.02,
        "drainage_capacity_pct": 28.0,
        "soil_saturation_base": 0.88,
        "default_river_discharge": 420.0,
        "facilities": [
            {"name": "General Hospital West Kochi", "type": "HOSPITAL", "elevation_meters": 0.7, "capacity": 600, "status": "OPERATIONAL"},
            {"name": "Ernakulam South High-Ground Relief Center", "type": "SHELTER", "elevation_meters": 16.0, "capacity": 4500, "status": "OPERATIONAL"},
            {"name": "Willingdon Island Transformer Station", "type": "POWER_SUBSTATION", "elevation_meters": 0.6, "capacity": 0, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Mattancherry Low Canal Ring Road", "elevation_meters": 0.4, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Kochi Marina Bypass Corridor", "elevation_meters": 2.2, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "MG Road Elevated Transit Flyover", "elevation_meters": 9.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "MAA-03",
        "name": "Chennai Marina Lowlands & Adyar Delta",
        "state": "Tamil Nadu",
        "region": "chennai",
        "zone_type": "COASTAL",
        "latitude": 13.0102,
        "longitude": 80.2580,
        "elevation_meters": 2.1,
        "population": 45000,
        "dist_to_coast_km": 0.45,
        "dist_to_river_km": 0.15,
        "drainage_capacity_pct": 52.0,
        "soil_saturation_base": 0.60,
        "default_river_discharge": 280.0,
        "facilities": [
            {"name": "Adyar Multi-Specialty Health Center", "type": "HOSPITAL", "elevation_meters": 2.3, "capacity": 400, "status": "OPERATIONAL"},
            {"name": "Guindy Safe Elevation Community Shelter", "type": "SHELTER", "elevation_meters": 18.0, "capacity": 5000, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Marina Coastal Road (Kamarajar Salai)", "elevation_meters": 1.9, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Adyar Bridge Overpass Link", "elevation_meters": 6.5, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "BOM-04",
        "name": "Mumbai Mithi River Basin & Mahim Bay",
        "state": "Maharashtra",
        "region": "mumbai",
        "zone_type": "COASTAL",
        "latitude": 19.0550,
        "longitude": 72.8450,
        "elevation_meters": 1.6,
        "population": 85000,
        "dist_to_coast_km": 0.80,
        "dist_to_river_km": 0.05,
        "drainage_capacity_pct": 36.0,
        "soil_saturation_base": 0.82,
        "default_river_discharge": 520.0,
        "facilities": [
            {"name": "Sion Emergency Critical Care Center", "type": "HOSPITAL", "elevation_meters": 1.7, "capacity": 750, "status": "OPERATIONAL"},
            {"name": "Bandra East Highland Disaster Refuge", "type": "SHELTER", "elevation_meters": 19.5, "capacity": 7000, "status": "OPERATIONAL"},
            {"name": "Dharavi Municipal Stormwater Pump Substation", "type": "POWER_SUBSTATION", "elevation_meters": 1.2, "capacity": 0, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "BKC Central Arterial Lowland Link", "elevation_meters": 1.4, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Western Express Highway Elevated Viaduct", "elevation_meters": 8.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "CCU-05",
        "name": "Kolkata Hooghly Tidal Basin & Alipore",
        "state": "West Bengal",
        "region": "kolkata",
        "zone_type": "COASTAL",
        "latitude": 22.5400,
        "longitude": 88.3300,
        "elevation_meters": 2.3,
        "population": 65000,
        "dist_to_coast_km": 115.0,
        "dist_to_river_km": 0.10,
        "drainage_capacity_pct": 40.0,
        "soil_saturation_base": 0.85,
        "default_river_discharge": 1850.0,
        "facilities": [
            {"name": "SSKM Multi-Specialty Hospital", "type": "HOSPITAL", "elevation_meters": 2.5, "capacity": 900, "status": "OPERATIONAL"},
            {"name": "Alipore Command Center Highland Base", "type": "SHELTER", "elevation_meters": 15.0, "capacity": 5500, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Strand Road Lowland Riverfront Corridor", "elevation_meters": 2.1, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Vidyasagar Setu Highway Expressway", "elevation_meters": 14.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "GAU-06",
        "name": "Guwahati Brahmaputra River Basin & Pandu Port",
        "state": "Assam",
        "region": "guwahati",
        "zone_type": "RIVERINE",
        "latitude": 26.1600,
        "longitude": 91.7100,
        "elevation_meters": 48.0,
        "population": 58000,
        "dist_to_coast_km": 480.0,
        "dist_to_river_km": 0.08,
        "drainage_capacity_pct": 34.0,
        "soil_saturation_base": 0.92,
        "default_river_discharge": 4200.0,
        "facilities": [
            {"name": "Gauhati Medical College Hospital", "type": "HOSPITAL", "elevation_meters": 54.0, "capacity": 850, "status": "OPERATIONAL"},
            {"name": "Kamakhya Hilltop Emergency Command Base", "type": "SHELTER", "elevation_meters": 180.0, "capacity": 9000, "status": "OPERATIONAL"},
            {"name": "Pandu Ghat Pumping Station", "type": "POWER_SUBSTATION", "elevation_meters": 49.0, "capacity": 0, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "MG Road Brahmaputra Embankment Corridor", "elevation_meters": 49.2, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "GS Road Elevated Highway Flyover", "elevation_meters": 62.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "PAT-07",
        "name": "Patna Gangetic Floodplain & Digha Embankment",
        "state": "Bihar",
        "region": "patna",
        "zone_type": "RIVERINE",
        "latitude": 25.6200,
        "longitude": 85.1200,
        "elevation_meters": 51.0,
        "population": 72000,
        "dist_to_coast_km": 520.0,
        "dist_to_river_km": 0.06,
        "drainage_capacity_pct": 30.0,
        "soil_saturation_base": 0.90,
        "default_river_discharge": 5100.0,
        "facilities": [
            {"name": "Patna Medical College Hospital (PMCH)", "type": "HOSPITAL", "elevation_meters": 52.0, "capacity": 1100, "status": "OPERATIONAL"},
            {"name": "Bailey Road Highland Emergency Shelter", "type": "SHELTER", "elevation_meters": 58.0, "capacity": 6500, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Ashok Rajpath Lowland Riverfront Arterial", "elevation_meters": 51.5, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "JP Ganga Pathway Elevated Expressway", "elevation_meters": 61.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "STV-08",
        "name": "Surat Tapi River Estuary & Dumas Lowlands",
        "state": "Gujarat",
        "region": "surat",
        "zone_type": "COASTAL",
        "latitude": 21.1500,
        "longitude": 72.7800,
        "elevation_meters": 2.8,
        "population": 50000,
        "dist_to_coast_km": 3.50,
        "dist_to_river_km": 0.15,
        "drainage_capacity_pct": 46.0,
        "soil_saturation_base": 0.70,
        "default_river_discharge": 1100.0,
        "facilities": [
            {"name": "Surat New Civil Hospital", "type": "HOSPITAL", "elevation_meters": 3.8, "capacity": 700, "status": "OPERATIONAL"},
            {"name": "Athwa Highland Relief Center", "type": "SHELTER", "elevation_meters": 12.0, "capacity": 4200, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Dumas Coastal Ring Road", "elevation_meters": 2.9, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Gaurav Path Elevated Flyover", "elevation_meters": 8.5, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "VTZ-09",
        "name": "Visakhapatnam Harbor & Coastal Bay",
        "state": "Andhra Pradesh",
        "region": "visakhapatnam",
        "zone_type": "COASTAL",
        "latitude": 17.6980,
        "longitude": 83.2980,
        "elevation_meters": 3.4,
        "population": 18000,
        "dist_to_coast_km": 0.10,
        "dist_to_river_km": 2.50,
        "drainage_capacity_pct": 68.0,
        "soil_saturation_base": 0.45,
        "default_river_discharge": 120.0,
        "facilities": [
            {"name": "Port Trust Central Hospital", "type": "HOSPITAL", "elevation_meters": 4.1, "capacity": 300, "status": "OPERATIONAL"},
            {"name": "Kailasagiri Hilltop Evacuation Base", "type": "SHELTER", "elevation_meters": 35.0, "capacity": 6000, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Beach Road Coastal Boulevard", "elevation_meters": 2.8, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "NH-16 Harbor Bypass Expressway", "elevation_meters": 11.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "SXR-10",
        "name": "Srinagar Jhelum Basin & Rajbagh Lowlands",
        "state": "Jammu & Kashmir",
        "region": "srinagar",
        "zone_type": "RIVERINE",
        "latitude": 34.0700,
        "longitude": 74.8100,
        "elevation_meters": 1580.0,
        "population": 34000,
        "dist_to_coast_km": 950.0,
        "dist_to_river_km": 0.05,
        "drainage_capacity_pct": 26.0,
        "soil_saturation_base": 0.94,
        "default_river_discharge": 950.0,
        "facilities": [
            {"name": "SMHS Hospital Srinagar", "type": "HOSPITAL", "elevation_meters": 1581.5, "capacity": 800, "status": "OPERATIONAL"},
            {"name": "Shankaracharya Ridge Safe Sanctuary", "type": "SHELTER", "elevation_meters": 1720.0, "capacity": 4500, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Jhelum River Bund Lowland Road", "elevation_meters": 1580.8, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "NH-44 Bypass Elevated Flyover", "elevation_meters": 1589.0, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
    {
        "id": "PRI-11",
        "name": "Puri Coastal Beachfront & Swargadwar Lowlands",
        "state": "Odisha",
        "region": "puri",
        "zone_type": "COASTAL",
        "latitude": 19.7980,
        "longitude": 85.8200,
        "elevation_meters": 2.9,
        "population": 22000,
        "dist_to_coast_km": 0.15,
        "dist_to_river_km": 1.80,
        "drainage_capacity_pct": 55.0,
        "soil_saturation_base": 0.65,
        "default_river_discharge": 210.0,
        "facilities": [
            {"name": "Puri District Headquarters Hospital", "type": "HOSPITAL", "elevation_meters": 3.6, "capacity": 450, "status": "OPERATIONAL"},
            {"name": "Jagannath Temple Highland Refuge", "type": "SHELTER", "elevation_meters": 18.0, "capacity": 8000, "status": "OPERATIONAL"},
        ],
        "roads": [
            {"name": "Marine Drive Coastal Boulevard", "elevation_meters": 2.7, "status": "OPEN", "depth_over_road_m": 0.0},
            {"name": "Grand Road Highland Evacuation Corridor", "elevation_meters": 5.2, "status": "OPEN", "depth_over_road_m": 0.0},
        ]
    },
]


def calculate_flood_simulation(params: SimulationInput, db: Session = None) -> SimulationResponse:
    """
    Executes the full AI Hydrological Pipeline:
    1. Loads zone GIS profiles with physical coastal vs riverine decoupling
    2. Incorporates region filtering from Hotspots HUD
    3. Runs Tabular ML Predictor (Gradient Boosting & Balanced Random Forest)
    4. Computes Explainable AI (XAI) factor attributions
    5. Calculates Juve multi-criteria urgency scores and road/hospital cut-offs
    6. Returns continuous dynamic KPIs (Threat Index, Pop at Risk, Inundation km²)
    """
    # 1. Fetch zones from Database or Master Seeds
    raw_zones = NATIONWIDE_REGIONAL_SEEDS

    # Filter by selected region if specified and not 'all' or 'india'
    if params.region_id and params.region_id.lower() not in ["all", "india", "nationwide"]:
        filtered = [z for z in raw_zones if z["region"].lower() == params.region_id.lower()]
        if filtered:
            raw_zones = filtered

    # Build lookup for zone overrides if provided
    overrides_dict = {}
    if params.zone_overrides:
        for ov in params.zone_overrides:
            overrides_dict[ov.zone_id.upper()] = ov

    zone_evaluations: List[Dict[str, Any]] = []
    total_population_at_risk = 0
    inundated_area_sq_km = 0.0
    zone_probabilities: List[float] = []
    zone_depths: List[float] = []

    for z in raw_zones:
        z_id = z["id"]
        z_name = z["name"]
        z_state = z["state"]
        z_region = z["region"]
        z_type = z.get("zone_type", "COASTAL")
        z_elev = z["elevation_meters"]
        z_pop = z["population"]
        z_coast = z["dist_to_coast_km"]
        z_river = z["dist_to_river_km"]
        z_drain = z["drainage_capacity_pct"]
        z_lat = z["latitude"]
        z_lng = z["longitude"]
        z_facilities = z.get("facilities", [])
        z_roads = z.get("roads", [])
        z_discharge = params.river_discharge_m3_s or z.get("default_river_discharge", 350.0)

        # Check for localized zone override
        zone_ov = overrides_dict.get(z_id.upper())
        zone_rain = zone_ov.rainfall_mm_per_hour if (zone_ov and zone_ov.rainfall_mm_per_hour is not None) else params.rainfall_mm_per_hour
        zone_saturation = zone_ov.soil_saturation if (zone_ov and zone_ov.soil_saturation is not None) else (params.soil_saturation or 0.75)
        
        drainage_adj = z_drain
        if zone_ov and zone_ov.drainage_blocked_pct is not None:
            drainage_adj = max(5.0, z_drain * (1.0 - zone_ov.drainage_blocked_pct / 100.0))

        # 2. Run ML Predictive Inference with physical coastal decoupling
        rainfall_accum = zone_rain * min(params.forecast_hours, 6) * 0.7
        cyclone_wind = (params.wind_speed_kmh or 35.0) * (1.5 if params.cyclone_active else 1.0)

        ml_result = ml_predictor.predict_zone(
            tide_level_m=params.tide_level_meters,
            rainfall_rate_mm_h=zone_rain,
            rainfall_accum_6h_mm=rainfall_accum,
            elevation_m=z_elev,
            dist_to_coast_km=z_coast,
            dist_to_river_km=z_river,
            drainage_capacity_pct=drainage_adj,
            soil_saturation_idx=zone_saturation,
            cyclone_wind_kmh=cyclone_wind,
            river_discharge_m3_s=z_discharge,
        )

        pred_depth = ml_result["projected_depth_meters"]
        zone_depths.append(pred_depth)
        zone_probabilities.append(ml_result["flood_probability"])

        # 3. Hypsometric Continuous Population Exposure Curve
        # Lowland elevation distribution: exposure scales continuously with depth
        if ml_result["is_flooded"] and pred_depth > 0.05:
            exposure_fraction = min(1.0, max(0.05, float((pred_depth / 1.6) ** 0.75)))
            zone_exposed_pop = int(round(z_pop * exposure_fraction))
            total_population_at_risk += zone_exposed_pop
            inundated_area_sq_km += ml_result["inundated_area_sq_km"]

        # 4. Explainable AI Feature Attribution
        xai_result = xai_engine.explain_prediction(
            features=ml_result["features_used"],
            flood_probability=ml_result["flood_probability"],
            projected_depth_m=pred_depth,
            zone_name=z_name,
        )

        # 5. Juve Multi-Criteria Decision & Infrastructure Impact
        impact_result = decision_engine.evaluate_zone_impact(
            zone_id=z_id,
            zone_name=z_name,
            population=z_pop,
            projected_depth_m=pred_depth,
            flood_probability=ml_result["flood_probability"],
            onset_time_min=ml_result["onset_time_minutes"],
            facilities=z_facilities,
            roads=z_roads,
        )

        # 6. Alert & SMS text formatting
        submerged_road_name = impact_result["submerged_roads"][0]["name"] if impact_result["submerged_roads"] else None
        safe_shelter_name = impact_result["safe_shelters"][0]["name"] if impact_result["safe_shelters"] else None
        
        alert_payload = llm_service.generate_sms_alert(
            zone_name=z_name,
            threat_level=ml_result["threat_level"].value if hasattr(ml_result["threat_level"], "value") else str(ml_result["threat_level"]),
            onset_min=ml_result["onset_time_minutes"],
            peak_min=ml_result["peak_time_minutes"],
            submerged_road=submerged_road_name,
            shelter_name=safe_shelter_name,
        )

        zone_eval = {
            "zone_id": z_id,
            "zone_name": z_name,
            "state": z_state,
            "region": z_region,
            "zone_type": z_type,
            "elevation_meters": z_elev,
            "population": z_pop,
            "dist_to_coast_km": z_coast,
            "dist_to_river_km": z_river,
            "drainage_capacity_pct": drainage_adj,
            "latitude": z_lat,
            "longitude": z_lng,
            # ML Predictions
            "flood_probability": ml_result["flood_probability"],
            "is_flooded": ml_result["is_flooded"],
            "projected_depth_meters": pred_depth,
            "inundated_area_sq_km": ml_result["inundated_area_sq_km"],
            "onset_time_minutes": ml_result["onset_time_minutes"],
            "peak_time_minutes": ml_result["peak_time_minutes"],
            "threat_level": ml_result["threat_level"],
            # XAI
            "primary_drivers": [DriverItem(**d) for d in xai_result["primary_drivers"]],
            "plain_language_explanation": xai_result["plain_language_explanation"],
            # Impact
            "priority_score": impact_result["priority_score"],
            "threatened_facilities": [FacilityItem(**f) for f in impact_result["threatened_facilities"]],
            "safe_shelters": [FacilityItem(**s) for s in impact_result["safe_shelters"]],
            "submerged_roads": [RoadItem(**r) for r in impact_result["submerged_roads"]],
            "passable_roads": [RoadItem(**p) for p in impact_result["passable_roads"]],
            "recommended_action": impact_result["recommended_action"],
            # Alerts
            "alert_headline": alert_payload["headline"],
            "sms_text": alert_payload["sms_text"],
        }
        zone_evaluations.append(zone_eval)

    # 7. Rank Zones using Juve Prioritizer
    ranked_zones = decision_engine.rank_zones(zone_evaluations)
    enhanced_results = [EnhancedZoneResult(**rz) for rz in ranked_zones]

    # Critical & High Counts
    critical_count = sum(1 for z in enhanced_results if z.threat_level == ThreatLevel.CRITICAL)
    high_count = sum(1 for z in enhanced_results if z.threat_level == ThreatLevel.HIGH)
    medium_count = sum(1 for z in enhanced_results if z.threat_level == ThreatLevel.MEDIUM)

    # 8. Continuous Composite System Threat Index (0 - 100)
    max_d = max(zone_depths) if zone_depths else 0.0
    avg_d = sum(zone_depths) / len(zone_depths) if zone_depths else 0.0
    avg_prob = sum(zone_probabilities) / len(zone_probabilities) if zone_probabilities else 0.0
    total_pop_base = sum(z["population"] for z in raw_zones) or 1
    pop_ratio = min(1.0, total_population_at_risk / total_pop_base)

    computed_index = float(
        (max_d * 24.0) +
        (avg_d * 18.0) +
        (pop_ratio * 25.0) +
        (critical_count * 10.0) +
        (high_count * 5.0) +
        (avg_prob * 15.0)
    )
    threat_index = min(100.0, max(5.0, round(computed_index, 1)))

    if threat_index >= 68.0 or critical_count >= 1:
        overall_threat = ThreatLevel.CRITICAL
        recommendation = "RED ALERT: Immediate evacuation of vulnerable lowlands required. Issue mobile broadcasts & mobilize NDRF rescue boat units."
    elif threat_index >= 42.0 or high_count >= 1:
        overall_threat = ThreatLevel.HIGH
        recommendation = "ORANGE ADVISORY: Deploy de-watering pumps to compromised road arteries and pre-stage highland emergency relief shelters."
    elif threat_index >= 20.0 or medium_count >= 1:
        overall_threat = ThreatLevel.MEDIUM
        recommendation = "YELLOW WATCH: Monitor riverine confluence and drainage channels. Standby for runoff surge."
    elif threat_index >= 8.0:
        overall_threat = ThreatLevel.LOW
        recommendation = "GREEN ADVISORY: Minor waterlogging probability. Standard monitoring protocol active."
    else:
        overall_threat = ThreatLevel.NO_DANGER
        recommendation = "SAFE: All regional sectors operating within normal hydrological buffer limits."

    return SimulationResponse(
        threat_index=threat_index,
        overall_risk=overall_threat,
        simulation_params=params,
        estimated_inundated_area_sq_km=round(inundated_area_sq_km, 2),
        total_population_at_risk=total_population_at_risk,
        critical_zones_count=critical_count,
        zones=enhanced_results,
        recommendation=recommendation,
        ai_validation_metrics=ml_predictor.metrics,
        auto_sms_alerts=[],
    )


def calculate_24h_timeline(params: SimulationInput, db: Session = None) -> Timeline24hResponse:
    """
    Simulates a 24-hour flood propagation timeline modeling semi-diurnal tidal cycles
    and storm hyetographs with sub-50ms vectorized batch inference.
    """
    # Filter zones by region if specified
    raw_zones = NATIONWIDE_REGIONAL_SEEDS
    if params.region_id and params.region_id.lower() not in ["all", "india", "nationwide"]:
        filtered = [z for z in raw_zones if z["region"].lower() == params.region_id.lower()]
        if filtered:
            raw_zones = filtered

    # Pre-build overrides lookup
    overrides_dict = {}
    if params.zone_overrides:
        for ov in params.zone_overrides:
            overrides_dict[ov.zone_id.upper()] = ov

    base_tide = params.tide_level_meters
    base_rain = params.rainfall_mm_per_hour
    cyclone_wind = (params.wind_speed_kmh or 35.0) * (1.5 if params.cyclone_active else 1.0)

    # 1. Build batch input for all 24 hours x zones
    batch_items = []
    hour_metadata = []

    for h in range(1, 25):
        tide_offset = np.sin((h / 12.4) * 2 * np.pi) * 0.9
        hourly_tide = max(0.0, base_tide + tide_offset)
        rain_mult = max(0.1, np.exp(-((h - 10) ** 2) / 25.0) * 1.6)
        hourly_rain = base_rain * rain_mult
        hourly_sat = min(1.0, (params.soil_saturation or 0.75) + (h * 0.01))

        hour_metadata.append({
            "hour": h,
            "hourly_tide": hourly_tide,
            "hourly_rain": hourly_rain,
        })

        for z in raw_zones:
            z_id = z["id"]
            z_elev = z["elevation_meters"]
            z_pop = z["population"]
            z_coast = z["dist_to_coast_km"]
            z_river = z["dist_to_river_km"]
            z_drain = z["drainage_capacity_pct"]
            z_discharge = params.river_discharge_m3_s or z.get("default_river_discharge", 350.0)

            zone_ov = overrides_dict.get(z_id.upper())
            zone_rain = zone_ov.rainfall_mm_per_hour if (zone_ov and zone_ov.rainfall_mm_per_hour is not None) else hourly_rain
            zone_sat = zone_ov.soil_saturation if (zone_ov and zone_ov.soil_saturation is not None) else hourly_sat
            
            drainage_adj = z_drain
            if zone_ov and zone_ov.drainage_blocked_pct is not None:
                drainage_adj = max(5.0, z_drain * (1.0 - zone_ov.drainage_blocked_pct / 100.0))

            accum_6h = zone_rain * min(6, h) * 0.7

            batch_items.append({
                "zone_id": z_id,
                "population": z_pop,
                "tide_level_m": hourly_tide,
                "rainfall_rate_mm_h": zone_rain,
                "rainfall_accum_6h_mm": accum_6h,
                "elevation_m": z_elev,
                "dist_to_coast_km": z_coast,
                "dist_to_river_km": z_river,
                "drainage_capacity_pct": drainage_adj,
                "soil_saturation_idx": zone_sat,
                "cyclone_wind_kmh": cyclone_wind,
                "river_discharge_m3_s": z_discharge,
            })

    # 2. Run vectorized batch inference across entire 24h timeline
    batch_predictions = ml_predictor.predict_batch(batch_items)

    # 3. Reconstruct hourly timeline steps
    steps: List[TimelineHourStep] = []
    max_depth = 0.0
    peak_hour = 12
    max_pop = 0
    num_zones = len(raw_zones)

    for h_idx in range(24):
        h_meta = hour_metadata[h_idx]
        h = h_meta["hour"]
        hourly_tide = h_meta["hourly_tide"]
        hourly_rain = h_meta["hourly_rain"]

        start_i = h_idx * num_zones
        end_i = start_i + num_zones
        h_preds = batch_predictions[start_i:end_i]
        h_zones = raw_zones

        hourly_pop_at_risk = 0
        hourly_inundated_area = 0.0
        hourly_critical_count = 0
        hourly_high_count = 0
        hourly_zone_depths: Dict[str, float] = {}

        for z_idx, z in enumerate(h_zones):
            z_id = z["id"]
            z_pop = z["population"]
            pred = h_preds[z_idx]

            p_depth = pred["projected_depth_meters"]
            hourly_zone_depths[z_id] = p_depth

            if pred["is_flooded"] and p_depth > 0.05:
                exposure_frac = min(1.0, max(0.05, float((p_depth / 1.6) ** 0.75)))
                hourly_pop_at_risk += int(round(z_pop * exposure_frac))
                hourly_inundated_area += pred["inundated_area_sq_km"]

            t_level = pred["threat_level"]
            if t_level == ThreatLevel.CRITICAL or p_depth >= 1.4:
                hourly_critical_count += 1
            elif t_level == ThreatLevel.HIGH or p_depth >= 0.7:
                hourly_high_count += 1

        step_max_depth = max(hourly_zone_depths.values()) if hourly_zone_depths else 0.0
        if step_max_depth > max_depth:
            max_depth = step_max_depth
            peak_hour = h
            max_pop = hourly_pop_at_risk

        if hourly_critical_count >= 1 or step_max_depth >= 1.5:
            step_risk = ThreatLevel.CRITICAL
        elif hourly_high_count >= 1 or step_max_depth >= 0.8:
            step_risk = ThreatLevel.HIGH
        elif hourly_pop_at_risk > 0 or step_max_depth >= 0.3:
            step_risk = ThreatLevel.MEDIUM
        elif step_max_depth > 0.05:
            step_risk = ThreatLevel.LOW
        else:
            step_risk = ThreatLevel.NO_DANGER

        steps.append(
            TimelineHourStep(
                hour=h,
                tide_level_meters=round(hourly_tide, 2),
                rainfall_mm_per_hour=round(hourly_rain, 1),
                total_population_at_risk=hourly_pop_at_risk,
                inundated_area_sq_km=round(hourly_inundated_area, 2),
                critical_zones_count=hourly_critical_count,
                overall_risk=step_risk,
                zone_depths=hourly_zone_depths,
            )
        )

    return Timeline24hResponse(
        simulation_id=f"TL-{uuid.uuid4().hex[:8].upper()}",
        generated_at=datetime.utcnow().isoformat() + "Z",
        total_hours=24,
        peak_hour=peak_hour,
        peak_water_depth_m=round(max_depth, 2),
        max_population_at_risk=max_pop,
        timeline_steps=steps,
    )


def calculate_what_if(input_data: WhatIfInput, db: Session = None) -> WhatIfResponse:
    """
    Computes comparative sensitivity deltas between a baseline and counterfactual scenario.
    """
    base_res = calculate_flood_simulation(input_data.base_params, db=db)

    # Construct counterfactual parameters
    new_tide = max(0.0, input_data.base_params.tide_level_meters + (input_data.tide_delta_m or 0.0))
    rain_factor = 1.0 + ((input_data.rain_delta_pct or 0.0) / 100.0)
    new_rain = max(0.0, input_data.base_params.rainfall_mm_per_hour * rain_factor)

    counter_input = SimulationInput(
        tide_level_meters=new_tide,
        rainfall_mm_per_hour=new_rain,
        forecast_hours=input_data.base_params.forecast_hours,
        wind_speed_kmh=input_data.base_params.wind_speed_kmh,
        cyclone_active=input_data.base_params.cyclone_active,
        soil_saturation=input_data.base_params.soil_saturation,
        region_id=input_data.base_params.region_id,
        river_discharge_m3_s=input_data.base_params.river_discharge_m3_s,
    )

    counter_res = calculate_flood_simulation(counter_input, db=db)

    delta_area = round(counter_res.estimated_inundated_area_sq_km - base_res.estimated_inundated_area_sq_km, 2)
    delta_pop = counter_res.total_population_at_risk - base_res.total_population_at_risk

    tide_desc = f"{input_data.tide_delta_m:+.2f}m tide" if input_data.tide_delta_m else "no tide change"
    rain_desc = f"{input_data.rain_delta_pct:+.0f}% rain" if input_data.rain_delta_pct else "no rain change"
    summary = f"What-If Scenario ({tide_desc}, {rain_desc}): Resulted in {delta_area:+.2f} sq km flooded land change and {delta_pop:+,} affected residents delta."

    return WhatIfResponse(
        scenario_summary=summary,
        base_threat_level=base_res.overall_risk,
        new_threat_level=counter_res.overall_risk,
        avoided_or_added_inundation_sq_km=delta_area,
        avoided_or_added_population_at_risk=delta_pop,
        base_response=base_res,
        counterfactual_response=counter_res,
    )
