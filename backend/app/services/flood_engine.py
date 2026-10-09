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


def calculate_flood_simulation(params: SimulationInput, db: Session = None) -> SimulationResponse:
    """
    Executes the full AI Pipeline:
    1. Loads zone GIS profiles, facilities, and roads from Database / Seeds
    2. Incorporates optional per-zone overrides
    3. Runs Tabular ML Predictor (Gradient Boosting & Balanced Random Forest)
    4. Computes Explainable AI (XAI) feature attributions
    5. Calculates Juve multi-criteria urgency scores and road/hospital threats
    6. Formulates plain-language SITREP and SMS alerts
    7. Persists predictions to Database
    """
    # 1. Fetch zones from DB if available
    zones_db = []
    is_valid_db = db is not None and hasattr(db, "query") and hasattr(db, "add")
    if is_valid_db:
        try:
            zones_db = db.query(Zone).all()
        except Exception:
            zones_db = []

    if not zones_db:
        from scripts.seed_db import COASTAL_SEEDS
        raw_zones = COASTAL_SEEDS
    else:
        raw_zones = zones_db

    # Build lookup for zone overrides if provided
    overrides_dict = {}
    if params.zone_overrides:
        for ov in params.zone_overrides:
            overrides_dict[ov.zone_id.upper()] = ov

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

        # Check for localized zone override
        zone_ov = overrides_dict.get(z_id.upper())
        zone_rain = zone_ov.rainfall_mm_per_hour if (zone_ov and zone_ov.rainfall_mm_per_hour is not None) else params.rainfall_mm_per_hour
        zone_saturation = zone_ov.soil_saturation if (zone_ov and zone_ov.soil_saturation is not None) else (params.soil_saturation or 0.75)
        
        drainage_adj = z_drain
        if zone_ov and zone_ov.drainage_blocked_pct is not None:
            drainage_adj = max(5.0, z_drain * (1.0 - zone_ov.drainage_blocked_pct / 100.0))

        # 2. Run ML Predictive Inference
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
            inundated_area_sq_km += ml_result["inundated_area_sq_km"]

        zone_eval = {
            "zone_id": z_id,
            "zone_name": z_name,
            "state": z_state,
            "region": z_region,
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
            "projected_depth_meters": ml_result["projected_depth_meters"],
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
                    flood_probability=er.flood_probability,
                    predicted_water_depth_m=er.projected_depth_meters,
                    onset_time_minutes=er.onset_time_minutes,
                    peak_time_minutes=er.peak_time_minutes,
                    threat_level=er.threat_level.value if hasattr(er.threat_level, "value") else str(er.threat_level),
                    affected_population=er.population if er.is_flooded else 0,
                    inundated_area_sq_km=er.inundated_area_sq_km,
                )
                db.add(rec)
            db.commit()
        except Exception:
            pass

    # 7. Automated Critical-Zone SMS Dispatch to Connected Phone Numbers
    auto_sms_alerts = []
    for er in enhanced_results:
        is_critical = (
            er.threat_level == ThreatLevel.CRITICAL
            or (hasattr(er.threat_level, "value") and er.threat_level.value == "CRITICAL")
            or str(er.threat_level).upper() == "CRITICAL"
        )
        if is_critical:
            alert_dispatch = sms_service.dispatch_critical_zone_alert(
                zone_id=er.zone_id,
                zone_name=er.zone_name,
                projected_depth_m=er.projected_depth_meters,
                onset_min=er.onset_time_minutes,
                peak_min=er.peak_time_minutes,
                sms_text=er.sms_text,
                db=db if is_valid_db else None,
            )
            if alert_dispatch:
                auto_sms_alerts.append(alert_dispatch)

    # Overall system risk calculation
    critical_count = sum(1 for z in enhanced_results if z.threat_level == ThreatLevel.CRITICAL)
    high_count = sum(1 for z in enhanced_results if z.threat_level == ThreatLevel.HIGH)
    
    if critical_count >= 1:
        overall_threat = ThreatLevel.CRITICAL
        threat_index = 88.5
        recommendation = "RED ALERT: Immediate evacuation of Tier-1 coastal lowlands required. Issue mobile broadcasts & mobilize NDRF units."
    elif high_count >= 1:
        overall_threat = ThreatLevel.HIGH
        threat_index = 68.0
        recommendation = "ORANGE ADVISORY: Deploy de-watering pumps to compromised road arteries and pre-stage emergency relief shelters."
    elif any(z.threat_level == ThreatLevel.MEDIUM for z in enhanced_results):
        overall_threat = ThreatLevel.MEDIUM
        threat_index = 42.0
        recommendation = "YELLOW WATCH: Monitor estuary confluence and maintain drainage channel vigilance."
    elif any(z.threat_level == ThreatLevel.LOW for z in enhanced_results):
        overall_threat = ThreatLevel.LOW
        threat_index = 22.0
        recommendation = "GREEN ADVISORY: Low waterlogging probability. Standard operations."
    else:
        overall_threat = ThreatLevel.NO_DANGER
        threat_index = 5.0
        recommendation = "SAFE: All coastal sectors operating within normal tidal and runoff limits."

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
        auto_sms_alerts=auto_sms_alerts,
    )


def calculate_24h_timeline(params: SimulationInput, db: Session = None) -> Timeline24hResponse:
    """
    Simulates a 24-hour flood propagation timeline modeling semi-diurnal tidal cycles
    and storm hyetographs.
    """
    steps: List[TimelineHourStep] = []
    max_depth = 0.0
    peak_hour = 12
    max_pop = 0

    base_tide = params.tide_level_meters
    base_rain = params.rainfall_mm_per_hour

    for h in range(1, 25):
        # Tidal oscillation curve (semi-diurnal tide period ~12.4h)
        tide_offset = np.sin((h / 12.4) * 2 * np.pi) * 0.9
        hourly_tide = max(0.0, base_tide + tide_offset)

        # Storm precipitation hyetograph (bell curve peaking at hour 8-12)
        rain_mult = max(0.1, np.exp(-((h - 10) ** 2) / 25.0) * 1.6)
        hourly_rain = base_rain * rain_mult

        step_input = SimulationInput(
            tide_level_meters=hourly_tide,
            rainfall_mm_per_hour=hourly_rain,
            forecast_hours=params.forecast_hours,
            wind_speed_kmh=params.wind_speed_kmh,
            cyclone_active=params.cyclone_active,
            soil_saturation=min(1.0, (params.soil_saturation or 0.75) + (h * 0.01)),
            zone_overrides=params.zone_overrides,
        )

        res = calculate_flood_simulation(step_input, db=db)
        
        zone_depths = {z.zone_id: z.projected_depth_meters for z in res.zones}
        step_max_depth = max(zone_depths.values()) if zone_depths else 0.0

        if step_max_depth > max_depth:
            max_depth = step_max_depth
            peak_hour = h
            max_pop = res.total_population_at_risk

        steps.append(
            TimelineHourStep(
                hour=h,
                tide_level_meters=round(hourly_tide, 2),
                rainfall_mm_per_hour=round(hourly_rain, 1),
                total_population_at_risk=res.total_population_at_risk,
                inundated_area_sq_km=res.estimated_inundated_area_sq_km,
                critical_zones_count=res.critical_zones_count,
                overall_risk=res.overall_risk,
                zone_depths=zone_depths,
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
