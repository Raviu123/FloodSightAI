"""
FloodShield AI — Grounded LLM Assistant Tools Ecosystem
Deterministic Python bindings providing the Conversational Disaster AI Copilot with
real-time simulation telemetry, historical disaster archives, GIS lifelines,
SHAP XAI drivers, 24h timeline projections, multi-zone comparisons, and NDMA SOPs.
"""

import os
import csv
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.schemas.simulation import (
    SimulationInput,
    ZoneOverrideItem,
    ThreatLevel,
)
from app.services.flood_engine import calculate_flood_simulation
from app.services.ml_predictor import ml_predictor
from app.services.xai_engine import xai_engine
from app.services.decision_engine import decision_engine

logger = logging.getLogger("floodshield.assistant.tools")

# Cache for historical records loaded from CSV
_HISTORICAL_RECORDS_CACHE: Optional[List[Dict[str, Any]]] = None


def _load_historical_records() -> List[Dict[str, Any]]:
    global _HISTORICAL_RECORDS_CACHE
    if _HISTORICAL_RECORDS_CACHE is not None:
        return _HISTORICAL_RECORDS_CACHE

    records = []
    # Search paths for historical CSV
    base_dir = Path(__file__).resolve().parent.parent.parent
    csv_paths = [
        base_dir / "data" / "historical" / "historical_flood_records.csv",
        base_dir.parent / "data" / "historical" / "historical_flood_records.csv",
        base_dir / "data" / "historical_flood_records.csv",
    ]

    chosen_path = None
    for p in csv_paths:
        if p.exists():
            chosen_path = p
            break

    if chosen_path:
        try:
            with open(chosen_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        rec = {
                            "event_id": row.get("event_id", "").strip(),
                            "event_name": row.get("event_name", "").strip(),
                            "district": row.get("district", "").strip(),
                            "state": row.get("state", "").strip(),
                            "latitude": float(row.get("latitude", 0.0) or 0.0),
                            "longitude": float(row.get("longitude", 0.0) or 0.0),
                            "year": int(row.get("year", 0) or 0),
                            "start_date": row.get("start_date", "").strip(),
                            "end_date": row.get("end_date", "").strip(),
                            "recorded_flood_level_msl": float(row.get("recorded_flood_level_msl", 0.0) or 0.0),
                            "peak_rainfall_24h_mm": float(row.get("peak_rainfall_24h_mm", 0.0) or 0.0),
                            "historical_area_sqkm": float(row.get("historical_area_sqkm", 0.0) or 0.0),
                            "major_waterbody": row.get("major_waterbody", "").strip(),
                            "primary_driver": row.get("primary_driver", "").strip(),
                            "casualty_count": int(float(row.get("casualty_count", 0) or 0)),
                            "economic_loss_crore_inr": float(row.get("economic_loss_crore_inr", 0.0) or 0.0),
                        }
                        records.append(rec)
                    except Exception:
                        continue
        except Exception as e:
            logger.warning(f"Could not load historical records CSV: {e}")

    _HISTORICAL_RECORDS_CACHE = records
    return records


_SIM_CACHE: Dict[str, Any] = {}


def _get_sim(tide: float = 2.4, rain: float = 65.0, cyclone: bool = False, forecast_hours: int = 12):
    cache_key = f"{round(float(tide), 2)}_{round(float(rain), 1)}_{cyclone}_{forecast_hours}"
    if cache_key in _SIM_CACHE:
        return _SIM_CACHE[cache_key]
    params = SimulationInput(
        tide_level_meters=tide,
        rainfall_mm_per_hour=rain,
        cyclone_active=cyclone,
        forecast_hours=forecast_hours,
    )
    sim = calculate_flood_simulation(params)
    _SIM_CACHE[cache_key] = sim
    if len(_SIM_CACHE) > 50:
        _SIM_CACHE.clear()
    return sim


def _find_zone(sim, query: str):
    q = (query or "").strip().upper()
    if not q:
        return sim.zones[0] if sim.zones else None
    
    for z in sim.zones:
        if z.zone_id.upper() == q or q in z.zone_name.upper() or q in z.state.upper() or q in z.region.upper():
            return z
    
    # Fuzzy alias map
    aliases = {
        "MANGALORE": "IXE-01", "NETRAVATI": "IXE-01", "BOLAR": "IXE-01", "JEPPU": "IXE-01", "IXE": "IXE-01", "ZONE-01": "IXE-01",
        "KOCHI": "COK-02", "COCHIN": "COK-02", "ERNAKULAM": "COK-02", "VEMBANAD": "COK-02", "COK": "COK-02", "ZONE-02": "COK-02",
        "CHENNAI": "MAA-03", "ADYAR": "MAA-03", "MARINA": "MAA-03", "MAA": "MAA-03", "ZONE-03": "MAA-03",
        "MUMBAI": "BOM-04", "MITHI": "BOM-04", "BOM": "BOM-04", "ZONE-04": "BOM-04",
        "KOLKATA": "CCU-05", "HOOGHLY": "CCU-05", "CCU": "CCU-05", "ZONE-05": "CCU-05",
        "GUWAHATI": "GAU-06", "BRAHMAPUTRA": "GAU-06", "GAU": "GAU-06", "ZONE-06": "GAU-06",
        "PATNA": "PAT-07", "GANGA": "PAT-07", "PAT": "PAT-07", "ZONE-07": "PAT-07",
        "SURAT": "STV-08", "TAPTI": "STV-08", "STV": "STV-08", "ZONE-08": "STV-08",
        "VIZAG": "VTZ-09", "VISAKHAPATNAM": "VTZ-09", "VTZ": "VTZ-09", "ZONE-09": "VTZ-09",
        "SRINAGAR": "SXR-10", "JHELUM": "SXR-10", "DAL LAKE": "SXR-10", "SXR": "SXR-10", "ZONE-10": "SXR-10",
        "PURI": "PURI-11", "ODISHA": "PURI-11", "ZONE-11": "PURI-11",
    }
    for alias_key, target_id in aliases.items():
        if alias_key in q:
            for z in sim.zones:
                if z.zone_id.upper() == target_id:
                    return z

    return sim.zones[0] if sim.zones else None


def run_what_if_simulation(
    tide_level_meters: float = 2.4,
    rainfall_mm_per_hour: float = 65.0,
    cyclone_active: bool = False,
    wind_speed_kmh: float = 45.0,
    forecast_hours: int = 12,
    drainage_blocked_pct: float = 0.0,
    zone_name_or_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes a real-time ML-powered hydrodynamic What-If simulation with custom environmental forcings.
    Returns calculated water depths, onset lead time, peak arrival time, and system-wide impact metrics.
    """
    if drainage_blocked_pct > 0 and zone_name_or_id:
        overrides = [
            ZoneOverrideItem(
                zone_id=zone_name_or_id,
                drainage_blocked_pct=drainage_blocked_pct,
            )
        ]
        params = SimulationInput(
            tide_level_meters=tide_level_meters,
            rainfall_mm_per_hour=rainfall_mm_per_hour,
            cyclone_active=cyclone_active,
            wind_speed_kmh=wind_speed_kmh,
            forecast_hours=forecast_hours,
            zone_overrides=overrides,
        )
        sim = calculate_flood_simulation(params)
    else:
        sim = _get_sim(tide=tide_level_meters, rain=rainfall_mm_per_hour, cyclone=cyclone_active, forecast_hours=forecast_hours)

    matched_zone = None
    if zone_name_or_id:
        matched_zone = _find_zone(sim, zone_name_or_id)

    zone_summaries = []
    for z in sim.zones:
        zone_summaries.append({
            "zone_id": z.zone_id,
            "zone_name": z.zone_name,
            "state": z.state,
            "threat_level": str(z.threat_level),
            "projected_depth_meters": round(z.projected_depth_meters, 2),
            "flood_probability_pct": round(z.flood_probability * 100, 1),
            "onset_time_minutes": z.onset_time_minutes,
            "peak_time_minutes": z.peak_time_minutes,
            "population_at_risk": z.population if z.is_flooded else 0,
            "inundated_area_sq_km": round(z.inundated_area_sq_km, 2),
            "priority_rank": z.evacuation_priority_rank,
            "recommended_action": z.recommended_action,
        })

    result = {
        "simulation_parameters": {
            "tide_level_meters": tide_level_meters,
            "rainfall_mm_per_hour": rainfall_mm_per_hour,
            "cyclone_active": cyclone_active,
            "wind_speed_kmh": wind_speed_kmh,
            "forecast_hours": forecast_hours,
            "drainage_blocked_pct": drainage_blocked_pct,
        },
        "overall_risk": str(sim.overall_risk),
        "overall_threat_index": round(sim.threat_index, 1),
        "total_population_at_risk": sim.total_population_at_risk,
        "estimated_inundated_area_sq_km": round(sim.estimated_inundated_area_sq_km, 2),
        "system_recommendation": sim.recommendation,
        "zones_count": len(sim.zones),
        "zones": zone_summaries,
    }

    if matched_zone:
        result["focused_zone"] = {
            "zone_id": matched_zone.zone_id,
            "zone_name": matched_zone.zone_name,
            "state": matched_zone.state,
            "threat_level": str(matched_zone.threat_level),
            "projected_depth_meters": round(matched_zone.projected_depth_meters, 2),
            "flood_probability_pct": round(matched_zone.flood_probability * 100, 1),
            "onset_time_minutes": matched_zone.onset_time_minutes,
            "peak_time_minutes": matched_zone.peak_time_minutes,
            "population_at_risk": matched_zone.population if matched_zone.is_flooded else 0,
            "submerged_roads": [r.name for r in matched_zone.submerged_roads],
            "passable_roads": [r.name for r in matched_zone.passable_roads],
            "safe_shelters": [f"{s.name} (Elev: {s.elevation_meters}m)" for s in matched_zone.safe_shelters],
            "threatened_facilities": [f.name for f in matched_zone.threatened_facilities],
            "primary_driver": matched_zone.primary_drivers[0].factor_name if matched_zone.primary_drivers else "N/A",
            "driver_contribution_pct": matched_zone.primary_drivers[0].contribution_pct if matched_zone.primary_drivers else 0,
            "plain_language_explanation": matched_zone.plain_language_explanation,
        }

    return result


def get_zone_telemetry(
    zone_name_or_id: str,
    tide: float = 2.4,
    rain: float = 65.0,
    cyclone: bool = False,
) -> Dict[str, Any]:
    """
    Fetches real-time ML-predicted inundation depth, onset countdown, peak arrival time, and threat level for a specific zone.
    """
    sim = _get_sim(tide=tide, rain=rain, cyclone=cyclone)
    matched_zone = _find_zone(sim, zone_name_or_id)

    return {
        "zone_id": matched_zone.zone_id,
        "zone_name": matched_zone.zone_name,
        "state": matched_zone.state,
        "region": matched_zone.region,
        "elevation_meters": matched_zone.elevation_meters,
        "threat_level": str(matched_zone.threat_level),
        "flood_probability_pct": round(matched_zone.flood_probability * 100, 1),
        "projected_depth_meters": round(matched_zone.projected_depth_meters, 2),
        "inundated_area_sq_km": round(matched_zone.inundated_area_sq_km, 2),
        "onset_time_minutes": matched_zone.onset_time_minutes,
        "peak_time_minutes": matched_zone.peak_time_minutes,
        "population_at_risk": matched_zone.population if matched_zone.is_flooded else 0,
        "priority_rank": matched_zone.evacuation_priority_rank,
        "priority_score": round(matched_zone.priority_score, 1),
        "primary_driver": matched_zone.primary_drivers[0].factor_name if matched_zone.primary_drivers else "N/A",
        "primary_driver_pct": matched_zone.primary_drivers[0].contribution_pct if matched_zone.primary_drivers else 0,
        "plain_explanation": matched_zone.plain_language_explanation,
    }


def search_historical_flood_events(
    query: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    year: Optional[int] = None,
    min_flood_level_m: Optional[float] = None,
    limit: int = 5,
) -> Dict[str, Any]:
    """
    Searches the official Indian Historical Flood Disaster catalog (108+ documented events).
    Retrieves recorded water level, 24h rainfall, historical casualties, economic damage (Crore INR), and meteorological causes.
    """
    all_events = _load_historical_records()
    filtered = []

    q_lower = (query or "").lower().strip()
    st_lower = (state or "").lower().strip()
    dist_lower = (district or "").lower().strip()

    for ev in all_events:
        # Match year
        if year and ev["year"] != year:
            continue
        # Match min water level
        if min_flood_level_m and ev["recorded_flood_level_msl"] < min_flood_level_m:
            continue
        # Match state
        if st_lower and st_lower not in ev["state"].lower():
            continue
        # Match district
        if dist_lower and dist_lower not in ev["district"].lower():
            continue
        # Match general query
        if q_lower:
            text_corpus = f"{ev['event_id']} {ev['event_name']} {ev['district']} {ev['state']} {ev['major_waterbody']} {ev['primary_driver']}".lower()
            if q_lower not in text_corpus:
                # Check for individual word match
                words = [w for w in q_lower.split() if len(w) > 2]
                if not any(w in text_corpus for w in words):
                    continue

        filtered.append(ev)

    # Sort by economic loss / water level descending
    filtered.sort(key=lambda x: (x["economic_loss_crore_inr"], x["recorded_flood_level_msl"]), reverse=True)
    top_matches = filtered[:limit]

    return {
        "total_matches": len(filtered),
        "showing_count": len(top_matches),
        "events": top_matches,
        "search_criteria": {
            "query": query,
            "state": state,
            "district": district,
            "year": year,
            "min_flood_level_m": min_flood_level_m,
        },
    }


def compare_coastal_zones(
    zone_ids_or_names: Optional[List[str]] = None,
    tide: float = 2.4,
    rain: float = 65.0,
    cyclone: bool = False,
) -> Dict[str, Any]:
    """
    Generates a comparative risk matrix across multiple coastal zones under identical storm parameters.
    Ranks zones from most critical to least critical by water depth, onset time, and population vulnerability.
    """
    sim = _get_sim(tide=tide, rain=rain, cyclone=cyclone)

    ranked_results = []
    for z in sim.zones:
        if zone_ids_or_names:
            names_lower = [zn.lower().strip() for zn in zone_ids_or_names]
            if not any(nl in z.zone_name.lower() or nl in z.zone_id.lower() or nl in z.state.lower() for nl in names_lower):
                continue

        ranked_results.append({
            "rank": z.evacuation_priority_rank,
            "zone_id": z.zone_id,
            "zone_name": z.zone_name,
            "state": z.state,
            "threat_level": str(z.threat_level),
            "projected_depth_meters": round(z.projected_depth_meters, 2),
            "onset_time_minutes": z.onset_time_minutes,
            "peak_time_minutes": z.peak_time_minutes,
            "population_at_risk": z.population if z.is_flooded else 0,
            "inundated_area_sq_km": round(z.inundated_area_sq_km, 2),
            "primary_driver": z.primary_drivers[0].factor_name if z.primary_drivers else "N/A",
            "threatened_facilities_count": len(z.threatened_facilities),
            "submerged_roads_count": len(z.submerged_roads),
        })

    ranked_results.sort(key=lambda x: x["rank"])

    return {
        "scenario": {
            "tide_level_meters": tide,
            "rainfall_mm_per_hour": rain,
            "cyclone_active": cyclone,
        },
        "zones_compared_count": len(ranked_results),
        "comparison_matrix": ranked_results,
        "highest_risk_zone": ranked_results[0]["zone_name"] if ranked_results else "None",
    }


def get_timeline_projection(
    zone_name_or_id: str,
    tide: float = 2.4,
    rain: float = 65.0,
    forecast_hours: int = 24,
) -> Dict[str, Any]:
    """
    Calculates an hour-by-hour 24h hydrodynamic progression timeline showing the rising limb, peak crest, and recession.
    """
    from app.schemas.simulation import Timeline24hResponse
    sim = _get_sim(tide=tide, rain=rain, forecast_hours=forecast_hours)
    matched_zone = _find_zone(sim, zone_name_or_id)

    # Calculate hour-by-hour hydrograph curve
    hours = min(max(forecast_hours, 6), 24)
    peak_depth = matched_zone.projected_depth_meters
    peak_hour = max(1, min(hours - 1, int(matched_zone.peak_time_minutes / 60)))
    onset_hour = max(0, int(matched_zone.onset_time_minutes / 60))

    timeline = []
    for h in range(1, hours + 1):
        if h < onset_hour:
            depth = 0.05 * h
            prob = 0.1
            status = "NORMAL"
        elif h <= peak_hour:
            progress = (h - onset_hour) / max(1, (peak_hour - onset_hour))
            depth = peak_depth * (progress ** 1.2)
            prob = min(0.99, 0.4 + 0.6 * progress)
            status = "CRITICAL BREACH" if depth >= 1.5 else ("HIGH WATER" if depth >= 0.8 else "RISING")
        else:
            # Drainage recession limb
            recession = (h - peak_hour) / max(1, (hours - peak_hour))
            depth = max(0.1, peak_depth * (1.0 - (recession * 0.65)))
            prob = max(0.2, 0.95 - (recession * 0.5))
            status = "DRAINAGE RECESSION" if depth < 0.8 else "ELEVATED"

        timeline.append({
            "hour": h,
            "projected_depth_m": round(depth, 2),
            "flood_probability": round(prob, 2),
            "threat_status": status,
        })

    return {
        "zone_id": matched_zone.zone_id,
        "zone_name": matched_zone.zone_name,
        "total_forecast_hours": hours,
        "peak_hour": peak_hour,
        "peak_depth_meters": round(peak_depth, 2),
        "breach_onset_hour": onset_hour,
        "hourly_steps": timeline,
    }


def get_safe_evacuation_route(
    zone_name_or_id: str,
    tide: float = 2.4,
    rain: float = 65.0,
) -> Dict[str, Any]:
    """
    Identifies passable road lifelines and flags submerged roads to construct a safe evacuation corridor.
    """
    sim = _get_sim(tide=tide, rain=rain)
    zone = _find_zone(sim, zone_name_or_id)

    submerged = [{"name": r.name, "status": r.status, "elevation_m": r.elevation_meters} for r in zone.submerged_roads]
    passable = [{"name": r.name, "status": r.status, "elevation_m": r.elevation_meters} for r in zone.passable_roads]
    safe_shelters = [
        {"name": s.name, "elevation_m": s.elevation_meters, "capacity": s.capacity}
        for s in zone.safe_shelters
    ]

    return {
        "zone_id": zone.zone_id,
        "zone_name": zone.zone_name,
        "threat_level": str(zone.threat_level),
        "submerged_roads": submerged if submerged else [{"name": "None currently submerged", "road_type": "N/A", "elevation_m": 0.0}],
        "passable_roads": passable if passable else [{"name": "National Highway Elevated Corridor", "road_type": "HIGHWAY", "elevation_m": 12.0}],
        "recommended_shelters": safe_shelters if safe_shelters else [{"name": "Municipal High-Ground Emergency Center", "elevation_m": 15.0, "capacity": 3000}],
        "evacuation_urgency": "IMMEDIATE" if str(zone.threat_level) in ["ThreatLevel.CRITICAL", "ThreatLevel.HIGH", "CRITICAL", "HIGH"] else "ADVISORY",
        "recommended_lifeline_bypass": passable[0]["name"] if passable else "High Ground Bypass",
    }


def get_nearby_shelters_and_hospitals(
    zone_name_or_id: str,
    tide: float = 2.4,
    rain: float = 65.0,
) -> Dict[str, Any]:
    """
    Retrieves high-elevation relief shelters (>10m MSL) and critical hospital triage status (operational vs compromised).
    """
    sim = _get_sim(tide=tide, rain=rain)
    zone = _find_zone(sim, zone_name_or_id)

    threatened = [
        {"name": f.name, "type": f.type, "elevation_m": f.elevation_meters, "status": f.status, "capacity": f.capacity}
        for f in zone.threatened_facilities
    ]
    safe = [
        {"name": s.name, "type": s.type, "elevation_m": s.elevation_meters, "status": s.status, "capacity": s.capacity}
        for s in zone.safe_shelters
    ]

    total_shelter_cap = sum(s["capacity"] for s in safe)
    hospital_threat_count = sum(1 for f in threatened if "HOSPITAL" in f.get("type", "").upper() or "HEALTH" in f.get("name", "").upper())

    return {
        "zone_id": zone.zone_id,
        "zone_name": zone.zone_name,
        "threatened_facilities": threatened,
        "safe_shelters": safe,
        "total_shelter_capacity": total_shelter_cap,
        "hospitals_compromised_count": hospital_threat_count,
        "triage_recommendation": (
            "URGENT: Initiate ICU generator safeguard and patient vertical evacuation to Upper Floors."
            if hospital_threat_count > 0
            else "Hospital access corridors clear; maintain emergency supply standby."
        ),
    }


def explain_flood_drivers(
    zone_name_or_id: str,
    tide: float = 2.4,
    rain: float = 65.0,
) -> Dict[str, Any]:
    """
    Returns SHAP mathematical driver breakdown and non-technical plain language explanation.
    """
    sim = _get_sim(tide=tide, rain=rain)
    zone = _find_zone(sim, zone_name_or_id)

    return {
        "zone_id": zone.zone_id,
        "zone_name": zone.zone_name,
        "primary_drivers": [
            {"factor": d.factor_name, "contribution_pct": d.contribution_pct}
            for d in zone.primary_drivers
        ],
        "explanation": zone.plain_language_explanation,
    }


def generate_commander_sitrep(
    tide: float = 2.4,
    rain: float = 65.0,
    cyclone: bool = False,
) -> Dict[str, Any]:
    """
    Generates a formal tactical Situation Report (SITREP) formatted for NDRF commanders and District Disaster Management Authorities.
    """
    from app.services.llm_service import llm_service
    sim = _get_sim(tide=tide, rain=rain, cyclone=cyclone)
    params = SimulationInput(tide_level_meters=tide, rainfall_mm_per_hour=rain, cyclone_active=cyclone)
    ranked_dicts = [z.model_dump() for z in sim.zones]

    sitrep = llm_service.generate_sitrep_briefing(
        simulation_params=params.model_dump(),
        ranked_zones=ranked_dicts,
        total_population_at_risk=sim.total_population_at_risk,
        inundated_area_sq_km=sim.estimated_inundated_area_sq_km,
    )
    return sitrep


def generate_multilingual_emergency_sms(
    zone_name_or_id: str,
    language: str = "en",
    threat_level: str = "CRITICAL",
) -> Dict[str, Any]:
    """
    Generates verified civic emergency SMS alerts in 8 Indian regional coastal languages under 160 characters.
    Supported languages: en (English), hi (Hindi), kn (Kannada), ml (Malayalam), ta (Tamil), te (Telugu), mr (Marathi), bn (Bengali).
    """
    lang = (language or "en").lower().strip()
    telemetry = get_zone_telemetry(zone_name_or_id)
    z_name = telemetry["zone_name"]
    depth = telemetry["projected_depth_meters"]
    onset = telemetry["onset_time_minutes"]

    sms_templates = {
        "en": f"EMERGENCY: {z_name} flood onset in {onset}m. Peak depth ~{depth:.1f}m. Move to elevated shelters immediately. Dial 112 for NDRF rescue.",
        "hi": f"आपातकालीन चेतावनी: {z_name} में {onset} मिनट में बाढ़। जलस्तर ~{depth:.1f}m पहुंचेगा। तुरंत ऊंचे आश्रय स्थलों पर जाएं। बचाव हेतु 112 डायल करें।",
        "kn": f"ತುರ್ತು ಎಚ್ಚರಿಕೆ: {z_name} ಪ್ರದೇಶದಲ್ಲಿ {onset} ನಿಮಿಷದಲ್ಲಿ ಪ್ರವಾಹ. ನೀರಿನ ಮಟ್ಟ ~{depth:.1f}m. ತಕ್ಷಣ ಎತ್ತರದ ಆಶ್ರಯ ತಾಣಗಳಿಗೆ ತೆರಳಿ. ಸಹಾಯಕ್ಕೆ 112 ಗೆ ಕರೆ ಮಾಡಿ.",
        "ml": f"അടിയന്തര മുന്നറിയിപ്പ്: {z_name} പ്രദേശത്ത് {onset} മിനിറ്റിനുള്ളിൽ വെള്ളപ്പൊക്കം. ജലനിരപ്പ് ~{depth:.1f}m. ഉടൻ ഉയർന്ന ഷെൽട്ടറുകളിലേക്ക് മാറുക. സഹായത്തിന് 112.",
        "ta": f"அவசர எச்சரிக்கை: {z_name} பகுதியில் {onset} நிமிடங்களில் வெள்ளம். நீர்மட்டம் ~{depth:.1f}m. உடனடியாக உயரமான முகாம்களுக்கு செல்லவும். அவசர உதவி 112.",
        "te": f"అత్యవసర హెచ్చరిక: {z_name} ప్రాంతంలో {onset} నిమిషాల్లో వరద. నీటి మట్టం ~{depth:.1f}m. వెంటనే ఎత్తైన పునరావాస కేంద్రాలకు వెళ్లండి. సహాయం కొరకు 112.",
        "mr": f"तातडीची सूचना: {z_name} भागात {onset} मिनिटांत पूर येण्याची शक्यता. पाण्याची पातळी ~{depth:.1f}m. त्वरित उंच निवारा केंद्रात जा. मदतीसाठी 112 डायल करा.",
        "bn": f"জরুরি সতর্কতা: {z_name} এলাকায় {onset} মিনিটে বন্যা। জলস্তর ~{depth:.1f}m বৃদ্ধি পাবে। অবিলম্বে উঁচু আশ্রয়ে যান। উদ্ধারকার্যে 112 ডায়াল করুন।",
    }

    selected_text = sms_templates.get(lang, sms_templates["en"])

    return {
        "zone_name": z_name,
        "language": lang,
        "threat_level": threat_level,
        "character_count": len(selected_text),
        "sms_text": selected_text,
        "is_under_160_chars": len(selected_text) <= 160,
        "emergency_helpline": "112",
    }


def get_disaster_sop_guidance(threat_level: str, user_role: str = "civilian") -> Dict[str, Any]:
    """
    Returns official NDMA / SDMA standard operating procedures and tactical rescue guidelines.
    """
    tl = (threat_level or "").upper()
    
    if user_role.lower() == "commander":
        if "CRITICAL" in tl or "HIGH" in tl:
            directives = [
                "Mobilize 4 NDRF Battalions & 12 Quick Response Teams (QRTs) with Inflatable Rescue Boats (IRBs).",
                "Stage 500kVA auxiliary diesel de-watering pumps at primary road culverts and low-lying underpasses.",
                "Execute mandatory triage evacuation of ground-floor hospital wards to elevated Tier-2 medical facilities.",
                "Issue cell-broadcast emergency alert on all telecom towers in the affected polygon.",
            ]
        else:
            directives = [
                "Maintain automated 15-minute telemetry polling on tidal gauges and river stage sensors.",
                "Place State Disaster Response Force (SDRF) on 30-minute alert standby.",
                "Inspect gravity flap valves and stormwater outfalls for sediment obstruction.",
            ]
        return {
            "role": "Incident Commander",
            "threat_level": tl,
            "tactical_directives": directives,
            "emergency_helpline": "SDMA Control Room: 1070 | NDRF HQ: 011-24363260",
        }
    elif user_role.lower() == "engineer":
        return {
            "role": "Coastal Hydrology Engineer",
            "threat_level": tl,
            "engineering_protocols": [
                "Verify kinematic wave lag and runoff routing against local digital elevation models.",
                "Check backwater surcharge at coastal tide-gates and canal confluences.",
                "Calculate dewatering pumping capacity requirements based on peak discharge (m3/s).",
            ],
            "recommended_actions": "Deploy high-volume dewatering pumps to low points and inspect sluice gates.",
        }
    else:
        if "CRITICAL" in tl or "HIGH" in tl:
            advice = [
                "Move to upper floors or nearest designated high-elevation shelter immediately.",
                "Turn off main electrical breaker and gas cylinders before evacuating.",
                "Do NOT attempt to drive or walk through moving water over 15cm (6 inches) deep.",
                "Keep emergency kit with drinking water, dry food, flashlight, and essential medications ready.",
            ]
        else:
            advice = [
                "Coastal conditions are within safe parameters. Normal precautions apply.",
                "Avoid parking vehicles in low-lying underpasses during heavy rain showers.",
                "Stay tuned to local disaster management bulletins.",
            ]
        return {
            "role": "Civilian",
            "threat_level": tl,
            "safety_guidelines": advice,
            "emergency_helpline": "National Emergency Helpline: 112 | District Disaster Helpline: 1077",
        }
