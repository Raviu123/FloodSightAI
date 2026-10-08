from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.schemas.simulation import (
    SimulationInput,
    SimulationResponse,
    ThreatLevel,
    EnhancedZoneResult,
    DriverItem,
    FacilityItem,
    RoadItem,
)
from app.models.zone import Zone, CriticalFacility, AffectedRoad
from app.models.prediction import PredictionRecord
from app.models.alert import AlertRecord
from app.services.ml_predictor import ml_predictor
from app.services.xai_engine import xai_engine
from app.services.decision_engine import decision_engine
from app.services.llm_service import llm_service


def calculate_flood_simulation(params: SimulationInput, db: Session = None) -> SimulationResponse:
    """
    Executes the full AI Pipeline:
    1. Loads zone GIS profiles, facilities, and roads from Database
    2. Runs Tabular ML Predictor (Scikit-Learn Random Forest & Gradient Boosting)
    3. Computes Explainable AI (XAI) feature attributions
    4. Calculates Juve multi-criteria urgency scores and road/hospital threats
    5. Formulates plain-language SITREP and SMS alerts
    6. Persists predictions to Database
    """
    # 1. Fetch zones from DB if available
    zones_db = []
    is_valid_db = db is not None and hasattr(db, "query") and hasattr(db, "add")
    if is_valid_db:
        try:
            zones_db = db.query(Zone).all()
        except Exception:
            zones_db = []

    # If DB not yet populated, fallback to inline seed definitions
    if not zones_db:
        from scripts.seed_db import COASTAL_SEEDS
        raw_zones = COASTAL_SEEDS
    else:
        raw_zones = zones_db

    zone_evaluations: List[Dict[str, Any]] = []
    total_population_at_risk = 0
    inundated_area_sq_km = 0.0

    for z in raw_zones:
        if hasattr(z, "id"):
            z_id = z.id
            z_name = z.name
            z_state = z.state
            z_region = z.region
            z_elev = z.elevation_meters
            z_pop = z.population
            z_coast = z.dist_to_coast_km
            z_river = z.dist_to_river_km
            z_drain = z.drainage_capacity_pct
            z_lat = z.latitude
            z_lng = z.longitude
            z_facilities = z.facilities
            z_roads = z.roads
        else:
            z_id = z["id"]
            z_name = z["name"]
            z_state = z["state"]
            z_region = z["region"]
            z_elev = z["elevation_meters"]
            z_pop = z["population"]
            z_coast = z["dist_to_coast_km"]
            z_river = z["dist_to_river_km"]
            z_drain = z["drainage_capacity_pct"]
            z_lat = z["latitude"]
            z_lng = z["longitude"]
            z_facilities = z.get("facilities", [])
            z_roads = z.get("roads", [])

        # 2. Run ML Predictive Inference
        rainfall_accum = params.rainfall_mm_per_hour * min(params.forecast_hours, 6) * 0.7
        cyclone_wind = (params.wind_speed_kmh or 35.0) * (1.5 if params.cyclone_active else 1.0)
        saturation = params.soil_saturation or 0.75

        ml_result = ml_predictor.predict_zone(
            tide_level_m=params.tide_level_meters,
            rainfall_rate_mm_h=params.rainfall_mm_per_hour,
            rainfall_accum_6h_mm=rainfall_accum,
            elevation_m=z_elev,
            dist_to_coast_km=z_coast,
            dist_to_river_km=z_river,
            drainage_capacity_pct=z_drain,
            soil_saturation_idx=saturation,
            cyclone_wind_kmh=cyclone_wind,
        )

        # 3. Explainable AI Feature Attribution
        xai_result = xai_engine.explain_prediction(
            features=ml_result["features_used"],
            flood_probability=ml_result["flood_probability"],
            projected_depth_m=ml_result["projected_depth_meters"],
            zone_name=z_name,
        )

        # 4. Juve Multi-Criteria Decision & Infrastructure Impact
        impact_result = decision_engine.evaluate_zone_impact(
            zone_id=z_id,
            zone_name=z_name,
            population=z_pop,
            projected_depth_m=ml_result["projected_depth_meters"],
            flood_probability=ml_result["flood_probability"],
            onset_time_min=ml_result["onset_time_minutes"],
            facilities=z_facilities,
            roads=z_roads,
        )

        # 5. Alert & SMS text formatting
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

        if ml_result["is_flooded"]:
            total_population_at_risk += z_pop
            inundated_area_sq_km += 5.2

        zone_eval = {
            "zone_id": z_id,
            "zone_name": z_name,
            "state": z_state,
            "region": z_region,
            "elevation_meters": z_elev,
            "population": z_pop,
            "dist_to_coast_km": z_coast,
            "dist_to_river_km": z_river,
            "drainage_capacity_pct": z_drain,
            "latitude": z_lat,
            "longitude": z_lng,
            # ML
            "flood_probability": ml_result["flood_probability"],
            "is_flooded": ml_result["is_flooded"],
            "projected_depth_meters": ml_result["projected_depth_meters"],
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

    # 6. Rank Zones using Juve Prioritizer
    ranked_zones = decision_engine.rank_zones(zone_evaluations)
    enhanced_results = [EnhancedZoneResult(**rz) for rz in ranked_zones]

    # Save to Database if session provided
    if is_valid_db:
        try:
            for er in enhanced_results:
                rec = PredictionRecord(
                    zone_id=er.zone_id,
                    tide_level_meters=params.tide_level_meters,
                    rainfall_mm_per_hour=params.rainfall_mm_per_hour,
                    soil_saturation=params.soil_saturation or 0.75,
                    cyclone_active=1.0 if params.cyclone_active else 0.0,
                    flood_probability=er.flood_probability,
                    projected_depth_meters=er.projected_depth_meters,
                    onset_time_minutes=er.onset_time_minutes,
                    peak_time_minutes=er.peak_time_minutes,
                    threat_level=er.threat_level.value if hasattr(er.threat_level, "value") else str(er.threat_level),
                    primary_drivers=[d.model_dump() for d in er.primary_drivers],
                    explanation_text=er.plain_language_explanation,
                    evacuation_priority_rank=er.evacuation_priority_rank,
                )
                db.add(rec)
            db.commit()
        except Exception:
            db.rollback()

    # Overall system threat score calculation
    critical_count = sum(1 for z in enhanced_results if z.threat_level in [ThreatLevel.CRITICAL, ThreatLevel.HIGH])
    avg_prob = sum(z.flood_probability for z in enhanced_results) / len(enhanced_results) if enhanced_results else 0
    threat_index = round(min(100.0, (avg_prob * 60.0) + (critical_count * 12.0) + (10.0 if params.cyclone_active else 0.0)), 1)

    if threat_index >= 70 or critical_count >= 2:
        overall_risk = ThreatLevel.CRITICAL
        recommendation = "RED ALERT: Immediate evacuation of Tier-1 coastal lowlands required. Issue mobile broadcasts & mobilize NDRF units."
    elif threat_index >= 45 or critical_count >= 1:
        overall_risk = ThreatLevel.HIGH
        recommendation = "ORANGE ADVISORY: Deploy de-watering pumps to compromised road arteries and pre-stage emergency relief shelters."
    elif threat_index >= 25:
        overall_risk = ThreatLevel.MEDIUM
        recommendation = "YELLOW WATCH: Monitor tidal ingress at estuary mouths. Restrict coastal navigation and alert fishing communities."
    else:
        overall_risk = ThreatLevel.LOW
        recommendation = "GREEN NORMAL: Coastal parameters within standard safety envelope. Maintain continuous telemetry polling."

    metrics_data = ml_predictor.get_metrics_summary()

    return SimulationResponse(
        threat_index=threat_index,
        overall_risk=overall_risk,
        simulation_params=params,
        estimated_inundated_area_sq_km=round(inundated_area_sq_km, 2),
        total_population_at_risk=total_population_at_risk,
        critical_zones_count=critical_count,
        zones=enhanced_results,
        recommendation=recommendation,
        ai_validation_metrics=metrics_data.get("metrics") if metrics_data else None,
    )
