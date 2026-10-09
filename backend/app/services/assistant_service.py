"""
FloodShield AI — Grounded Conversational AI Disaster Copilot Service
Dynamically orchestrates deterministic domain tools (ML simulation, historical flood archives,
multi-zone comparisons, 24h timelines, road lifelines, hospital triage, SITREPs)
with OpenRouter LLMs and fail-safe deterministic reasoning.
"""

import os
import re
import time
import httpx
import logging
from typing import Dict, Any, List, Optional
from app.services.assistant_tools import (
    run_what_if_simulation,
    get_zone_telemetry,
    search_historical_flood_events,
    compare_coastal_zones,
    get_timeline_projection,
    get_safe_evacuation_route,
    get_nearby_shelters_and_hospitals,
    explain_flood_drivers,
    generate_commander_sitrep,
    get_disaster_sop_guidance,
)

logger = logging.getLogger("floodshield.assistant.service")

# Active Free Instruction-Tuned OpenRouter Models (High Speed & Direct Response)
ACTIVE_OPENROUTER_MODELS = [
    "poolside/laguna-s-2.1:free",
    "poolside/laguna-xs-2.1:free",
    "liquid/lfm-2.5-2.6b:free",
]


def clean_llm_response(text: str) -> Optional[str]:
    """
    Cleans raw LLM outputs by removing emojis, reasoning scratchpads, <think> tags, and markdown metadata.
    Returns None if the response is only internal monologue or thinking scratchpad, triggering fallback.
    """
    if not text:
        return None
    
    # 1. Strip all unicode emojis (Design standard: NO EMOJIS anywhere)
    cleaned = re.sub(r"[\U00010000-\U0010ffff]", "", text).strip()
    
    # 2. Remove <think>...</think> and <thought>...</thought> tags
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()
    cleaned = re.sub(r"<thought>.*?</thought>", "", cleaned, flags=re.DOTALL).strip()
    
    # 3. Check if model dumped thinking process instead of final answer
    scratchpad_keywords = [
        "thinking process", "analyze user", "review grounded", "scan grounded",
        "identify missing", "need to determine", "draft the response", "let me draft",
        "directive #", "role: floodshield", "role instructions"
    ]
    if any(k in cleaned.lower() for k in scratchpad_keywords):
        for sep in ["\n\n---", "\n---", "\n\n**Answer:**", "\n\nAnswer:", "\n\nFinal Answer:", "\n\nConclusion:", "Let me draft:"]:
            if sep in cleaned:
                parts = cleaned.split(sep)
                cleaned = parts[-1].strip()
                break
        else:
            paragraphs = cleaned.split("\n\n")
            valid_paras = []
            for p in paragraphs:
                p_lower = p.lower()
                if any(k in p_lower for k in scratchpad_keywords):
                    continue
                if re.match(r"^\s*[-*0-9.]+\s+(need to|analyze|check|determine|based on facts|scan|format|directive)", p_lower):
                    continue
                valid_paras.append(p)
            cleaned = "\n\n".join(valid_paras).strip()

    if not cleaned or len(cleaned) < 15:
        return None
    if any(k in cleaned.lower() for k in ["thinking process", "scan grounded facts", "let me draft:"]):
        return None

    return cleaned


def extract_parameters_and_intents(message: str, current_zone: Optional[str] = "ZONE-01") -> Dict[str, Any]:
    """
    Extracts numerical parameters, target zones, historical queries, and specific intent flags from user queries.
    Uses strict regex word boundaries to avoid false substring matching.
    """
    text = (message or "").lower()

    # Default parameters
    params = {
        "target_zone": current_zone or "ZONE-01",
        "tide_m": 2.4,
        "rain_mm_h": 65.0,
        "cyclone_active": False,
        "wind_speed_kmh": 45.0,
        "drainage_blocked_pct": 0.0,
        "forecast_hours": 12,
        "is_what_if": False,
        "is_historical": False,
        "is_multi_zone_query": False,
        "is_weather_query": False,
        "is_timeline": False,
        "is_shelter_hospital": False,
        "is_route_evacuation": False,
        "is_sitrep": False,
        "is_xai": False,
        "is_sop": False,
        "historical_year": None,
        "historical_state": None,
        "historical_query": None,
    }

    # 1. Target Zone detection
    zone_lookup = {
        "mangalore": "ZONE-01", "netravati": "ZONE-01", "bolar": "ZONE-01", "jeppu": "ZONE-01", "ixe": "ZONE-01", "zone 1": "ZONE-01", "zone-01": "ZONE-01",
        "udupi": "ZONE-02", "malpe": "ZONE-02", "swarna": "ZONE-02", "zone 2": "ZONE-02", "zone-02": "ZONE-02",
        "kochi": "ZONE-03", "ernakulam": "ZONE-03", "cochin": "ZONE-03", "vembanad": "ZONE-03", "cok": "ZONE-03", "zone 3": "ZONE-03", "zone-03": "ZONE-03",
        "chennai": "ZONE-04", "adyar": "ZONE-04", "marina": "ZONE-04", "maa": "ZONE-04", "zone 4": "ZONE-04", "zone-04": "ZONE-04",
        "mumbai": "ZONE-06", "mithi": "ZONE-06", "bom": "ZONE-06", "zone 6": "ZONE-06", "zone-06": "ZONE-06",
        "kolkata": "ZONE-07", "hooghly": "ZONE-07", "ccu": "ZONE-07", "zone 7": "ZONE-07", "zone-07": "ZONE-07",
        "visakhapatnam": "ZONE-05", "vizag": "ZONE-05", "vtz": "ZONE-05", "zone 5": "ZONE-05", "zone-05": "ZONE-05",
        "puri": "ZONE-08", "odisha": "ZONE-08", "zone 8": "ZONE-08", "zone-08": "ZONE-08",
    }
    for kw, zid in zone_lookup.items():
        if kw in text:
            params["target_zone"] = zid
            break

    # 2. Multi-Zone / Comparison / Status Query detection
    multi_zone_patterns = [
        r"\bwhich zones\b", r"\bwhat zones\b", r"\ball zones\b", r"\bcompare\b", r"\bcomparison\b",
        r"\bhigh alert\b", r"\bcritical alert\b", r"\bwho is at risk\b", r"\bwhich areas\b",
        r"\bmost vulnerable\b", r"\brank zones\b", r"\boverall status\b", r"\bevery zone\b",
        r"\bwhich places\b", r"\bwhich cities\b", r"\bwhich sectors\b"
    ]
    if any(re.search(pat, text) for pat in multi_zone_patterns):
        params["is_multi_zone_query"] = True

    # 3. Weather Query detection
    weather_patterns = [
        r"\bweather\b", r"\bhow is the weather\b", r"\brainfall\b", r"\brain rate\b",
        r"\btide level\b", r"\btide height\b", r"\bwind speed\b", r"\bcyclone status\b",
        r"\bweather conditions\b", r"\bhow much rain\b"
    ]
    if any(re.search(pat, text) for pat in weather_patterns):
        params["is_weather_query"] = True

    # 4. Tide extraction (e.g., "tide of 3.2m", "tide 4.0", "3.5 meter tide")
    tide_match = re.search(r"tide\s*(?:of|is|at|level|height)?\s*([0-9]+\.?[0-9]*)\s*m?", text)
    if tide_match:
        try:
            params["tide_m"] = float(tide_match.group(1))
            params["is_what_if"] = True
        except ValueError:
            pass
    else:
        tide_alt = re.search(r"([0-9]+\.?[0-9]*)\s*m\s*(?:tide|storm surge)", text)
        if tide_alt:
            try:
                params["tide_m"] = float(tide_alt.group(1))
                params["is_what_if"] = True
            except ValueError:
                pass

    # 5. Rainfall extraction (e.g., "120mm rain", "rainfall of 85 mm/h", "rain 100")
    rain_match = re.search(r"rain(?:fall)?\s*(?:of|is|at|rate|intensity)?\s*([0-9]+\.?[0-9]*)\s*(?:mm/h|mm)?", text)
    if rain_match:
        try:
            params["rain_mm_h"] = float(rain_match.group(1))
            params["is_what_if"] = True
        except ValueError:
            pass
    else:
        rain_alt = re.search(r"([0-9]+\.?[0-9]*)\s*(?:mm/h|mm)\s*(?:rain|precipitation|downpour)", text)
        if rain_alt:
            try:
                params["rain_mm_h"] = float(rain_alt.group(1))
                params["is_what_if"] = True
            except ValueError:
                pass

    # 6. Cyclone & Wind speed extraction
    if any(k in text for k in ["cyclone", "cyclonic", "gale", "super cyclone", "storm surge", "depression"]):
        params["cyclone_active"] = True
        params["is_what_if"] = True
    wind_match = re.search(r"wind\s*(?:speed)?\s*(?:of|is|at)?\s*([0-9]+\.?[0-9]*)\s*(?:km/h|kmh|knots)?", text)
    if wind_match:
        try:
            params["wind_speed_kmh"] = float(wind_match.group(1))
            params["is_what_if"] = True
        except ValueError:
            pass

    # 7. Drainage Blockage extraction (e.g., "50% drainage blocked", "drainage blocked 40%")
    drain_match = re.search(r"(?:drainage|drains?)\s*(?:blocked|clogged)?\s*(?:by|at|is)?\s*([0-9]+)\s*%", text)
    if drain_match:
        try:
            params["drainage_blocked_pct"] = float(drain_match.group(1))
            params["is_what_if"] = True
        except ValueError:
            pass

    # 8. Historical Archive Queries
    if any(k in text for k in ["history", "historical", "past flood", "previous flood", "earlier flood", "disaster history"]):
        params["is_historical"] = True
        year_match = re.search(r"\b(19[89][0-9]|20[0-2][0-9])\b", text)
        if year_match:
            params["historical_year"] = int(year_match.group(1))
        for st in ["karnataka", "kerala", "tamil nadu", "maharashtra", "west bengal", "andhra pradesh", "odisha", "assam", "bihar", "gujarat"]:
            if st in text:
                params["historical_state"] = st
                break
        params["historical_query"] = text
    else:
        # Check if a past year is mentioned alone (e.g., "2018 flood in kerala")
        year_match = re.search(r"\b(19[89][0-9]|20[0-2][0-9])\b", text)
        if year_match and ("flood" in text or "disaster" in text or "kerala" in text or "chennai" in text):
            params["is_historical"] = True
            params["historical_year"] = int(year_match.group(1))
            for st in ["karnataka", "kerala", "tamil nadu", "maharashtra", "west bengal", "andhra pradesh", "odisha"]:
                if st in text:
                    params["historical_state"] = st
                    break
            params["historical_query"] = text

    # 9. Timeline / Hydrograph
    if any(k in text for k in ["timeline", "hydrograph", "hour by hour", "24 hour", "hourly", "when will it peak", "peak time", "how long until"]):
        params["is_timeline"] = True

    # 10. Shelters & Hospitals / Triage
    if any(k in text for k in ["shelter", "hospital", "relief center", "relief camp", "triage", "medical", "beds", "icu", "power grid"]):
        params["is_shelter_hospital"] = True

    # 11. Evacuation routes & road closures
    if any(k in text for k in ["evacuat", "route", "road", "highway", "submerged road", "passable", "escape", "flyover", "arterial", "bridge"]):
        params["is_route_evacuation"] = True

    # 12. SITREP briefing
    if any(k in text for k in ["sitrep", "situation report", "briefing", "command report", "ndma report"]):
        params["is_sitrep"] = True

    # 13. XAI / Drivers
    if any(k in text for k in ["why is it flooding", "driver", "factors", "contribution", "shap", "causes", "why "]):
        params["is_xai"] = True

    # 14. Explicit What-If simulation request
    if any(k in text for k in ["what if", "simulate", "forecast with", "run simulation", "scenario"]):
        params["is_what_if"] = True

    return params


class AssistantService:
    @classmethod
    def answer_query(
        cls,
        message: str,
        zone_id: Optional[str] = "ZONE-01",
        user_role: Optional[str] = "civilian",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Dynamically plans, executes relevant deterministic domain tools,
        and synthesizes a grounded, verified disaster intelligence response through LLM.
        """
        parsed = extract_parameters_and_intents(message, current_zone=zone_id)
        target_zone = parsed["target_zone"]
        role = (user_role or "civilian").lower()
        tide = parsed["tide_m"]
        rain = parsed["rain_mm_h"]
        cyclone = parsed["cyclone_active"]

        tools_used = []
        grounded_data = {}
        suggested_actions = []
        referenced_zones = [target_zone]

        # ----------------------------------------------------
        # 1. ALWAYS FETCH LIVE BASE SIMULATION TELEMETRY
        # ----------------------------------------------------
        telemetry = get_zone_telemetry(target_zone, tide=tide, rain=rain, cyclone=cyclone)
        tools_used.append("get_zone_telemetry")
        grounded_data["telemetry"] = telemetry

        # ----------------------------------------------------
        # 2. DYNAMIC TOOL DISPATCH BASED ON QUERY INTENT
        # ----------------------------------------------------

        # Multi-Zone Evaluation (e.g. "which zones are in high alert?")
        if parsed["is_multi_zone_query"]:
            comp_result = compare_coastal_zones(tide=tide, rain=rain, cyclone=cyclone)
            tools_used.append("compare_coastal_zones")
            grounded_data["zone_comparison"] = comp_result
            referenced_zones = [z["zone_name"] for z in comp_result["comparison_matrix"][:4]]

        # What-If Simulation
        if parsed["is_what_if"]:
            sim_result = run_what_if_simulation(
                tide_level_meters=tide,
                rainfall_mm_per_hour=rain,
                cyclone_active=cyclone,
                wind_speed_kmh=parsed["wind_speed_kmh"],
                drainage_blocked_pct=parsed["drainage_blocked_pct"],
                forecast_hours=parsed["forecast_hours"],
                zone_name_or_id=target_zone,
            )
            tools_used.append("run_what_if_simulation")
            grounded_data["what_if_simulation"] = sim_result

        # Historical Disaster Archive
        if parsed["is_historical"]:
            hist_result = search_historical_flood_events(
                query=parsed["historical_query"],
                state=parsed["historical_state"],
                year=parsed["historical_year"],
                limit=4,
            )
            tools_used.append("search_historical_flood_events")
            grounded_data["historical_events"] = hist_result

        # 24h Timeline Hydrograph
        if parsed["is_timeline"]:
            timeline_res = get_timeline_projection(target_zone, tide=tide, rain=rain, forecast_hours=parsed["forecast_hours"])
            tools_used.append("get_timeline_projection")
            grounded_data["timeline"] = timeline_res

        # Evacuation & Road Lifelines
        route_res = get_safe_evacuation_route(target_zone, tide=tide, rain=rain)
        tools_used.append("get_safe_evacuation_route")
        grounded_data["evacuation_corridor"] = route_res

        # Healthcare & Safe Shelters
        shelter_res = get_nearby_shelters_and_hospitals(target_zone, tide=tide, rain=rain)
        tools_used.append("get_nearby_shelters_and_hospitals")
        grounded_data["shelters_and_hospitals"] = shelter_res

        # SITREP Generator (for commander queries)
        if parsed["is_sitrep"] or role == "commander":
            sitrep_res = generate_commander_sitrep(tide=tide, rain=rain, cyclone=cyclone)
            tools_used.append("generate_commander_sitrep")
            grounded_data["sitrep"] = sitrep_res

        # XAI Explainability
        if parsed["is_xai"] or role == "engineer":
            xai_res = explain_flood_drivers(target_zone, tide=tide, rain=rain)
            tools_used.append("explain_flood_drivers")
            grounded_data["flood_drivers"] = xai_res

        # SOP Guidance
        sop_res = get_disaster_sop_guidance(telemetry["threat_level"], user_role=role)
        tools_used.append("get_disaster_sop_guidance")
        grounded_data["sop_guidance"] = sop_res

        # Suggested contextual follow-ups
        if parsed["is_multi_zone_query"]:
            suggested_actions = ["Simulate 3.5m Surge", "Show Mangalore Evacuation Route", "View Highest Risk Zone"]
        elif parsed["is_historical"]:
            suggested_actions = ["Compare with Current Conditions", "Check Shelter Capacities", "What-If 140mm Rain"]
        elif parsed["is_what_if"]:
            suggested_actions = ["View 24h Timeline", "Show Road Closures", "Check Hospital Triage"]
        elif role == "commander":
            suggested_actions = ["Generate Full NDMA SITREP", "Deploy Inflatable Rescue Boats", "View Compromised Roads"]
        else:
            suggested_actions = ["Check Evacuation Lifeline Bypass", "Find Safe High-Ground Shelter", "Emergency Helpline 112"]

        tools_used = list(dict.fromkeys(tools_used))

        # ----------------------------------------------------
        # 3. BUILD HIGH-DENSITY GROUNDED CONTEXT
        # ----------------------------------------------------
        facts_lines = []

        # Multi-Zone Matrix (Critical for "which zones" questions)
        if "zone_comparison" in grounded_data:
            matrix = grounded_data["zone_comparison"].get("comparison_matrix", [])
            facts_lines.append("ALL COASTAL ZONES CURRENT STATUS:")
            for z in matrix:
                t_level = str(z["threat_level"]).replace("ThreatLevel.", "").upper()
                facts_lines.append(f"  - {z['zone_name']} ({z['state']}): Threat Level {t_level} | Water Depth: {z['projected_depth_meters']}m | Onset: {z['onset_time_minutes']} mins | Population at Risk: {z['population_at_risk']:,}")
        else:
            # If not already compared, fetch comparison matrix summary for general context
            comp_auto = compare_coastal_zones(tide=tide, rain=rain, cyclone=cyclone)
            matrix = comp_auto.get("comparison_matrix", [])
            critical_zones = [f"{z['zone_name']} ({str(z['threat_level']).replace('ThreatLevel.', '')}, {z['projected_depth_meters']}m)" for z in matrix if "CRITICAL" in str(z['threat_level']) or "HIGH" in str(z['threat_level'])]
            moderate_zones = [f"{z['zone_name']} ({str(z['threat_level']).replace('ThreatLevel.', '')}, {z['projected_depth_meters']}m)" for z in matrix if "CRITICAL" not in str(z['threat_level']) and "HIGH" not in str(z['threat_level'])]
            facts_lines.append(f"- High Risk / Critical Zones: {', '.join(critical_zones) if critical_zones else 'None'}")
            facts_lines.append(f"- Moderate / Low Risk Zones: {', '.join(moderate_zones) if moderate_zones else 'None'}")

        # Focused Zone Telemetry
        depth = telemetry["projected_depth_meters"]
        onset = telemetry["onset_time_minutes"]
        peak = telemetry["peak_time_minutes"]
        zone_name = telemetry["zone_name"]
        threat_clean = str(telemetry["threat_level"]).replace("ThreatLevel.", "").upper()

        facts_lines.append(f"- Focused Zone: {telemetry['zone_id']} / {zone_name} ({telemetry['state']})")
        facts_lines.append(f"- Current Weather: Tide {tide:.1f}m MSL, Rainfall {rain:.0f}mm/h, Cyclone: {'ACTIVE' if cyclone else 'INACTIVE'}, Wind: {parsed['wind_speed_kmh']}km/h")
        facts_lines.append(f"- Threat Level: {threat_clean} (Safety Status: {'DANGEROUS / NOT SAFE' if threat_clean in ['CRITICAL', 'HIGH'] else 'SAFE / MINOR WATERLOGGING'})")
        facts_lines.append(f"- Projected Depth: {depth:.2f} meters (~{depth*3.28:.1f} feet) | Breach Lead Time: {onset} mins | Peak Surge: {peak} mins")
        facts_lines.append(f"- Population at Risk in Zone: {telemetry['population_at_risk']:,} residents across {telemetry['inundated_area_sq_km']:.2f} sq km")
        facts_lines.append(f"- Primary Driver: {telemetry['primary_driver']} ({telemetry['primary_driver_pct']}% attribution)")

        # Road Lifelines
        if "evacuation_corridor" in grounded_data:
            evac = grounded_data["evacuation_corridor"]
            subm = [r["name"] for r in evac.get("submerged_roads", [])]
            passable = [r["name"] for r in evac.get("passable_roads", [])]
            facts_lines.append(f"- Submerged Impassable Roads: {', '.join(subm)}")
            facts_lines.append(f"- Recommended Safe Passable Roads: {', '.join(passable)}")

        # Shelters & Hospitals
        if "shelters_and_hospitals" in grounded_data:
            sh = grounded_data["shelters_and_hospitals"]
            shelters_list = [f"{s['name']} (Elev: {s['elevation_m']}m, Capacity: {s['capacity']})" for s in sh.get("safe_shelters", [])]
            hospitals_list = [f"{h['name']} ({h['status']})" for h in sh.get("threatened_facilities", [])]
            facts_lines.append(f"- Designated High-Ground Shelters: {', '.join(shelters_list)}")
            facts_lines.append(f"- Hospital Cutoff Status: {', '.join(hospitals_list) if hospitals_list else 'All operational'}")

        # Historical Events
        if "historical_events" in grounded_data:
            events = grounded_data["historical_events"].get("events", [])
            hist_summary = "; ".join([f"{e['year']} {e['event_name']} (Recorded Water: {e['recorded_flood_level_msl']}m MSL, Rainfall: {e['peak_rainfall_24h_mm']}mm/24h, Economic Loss: INR {e['economic_loss_crore_inr']} Cr, Fatalities: {e['casualty_count']})" for e in events[:3]])
            facts_lines.append(f"- Historical Indian Disaster Archive: {hist_summary}")

        # What-If Simulation
        if "what_if_simulation" in grounded_data:
            wif = grounded_data["what_if_simulation"]
            facts_lines.append(f"- Custom What-If Forcing: Tide {wif['simulation_parameters']['tide_level_meters']}m, Rain {wif['simulation_parameters']['rainfall_mm_per_hour']}mm/h, Cyclone {wif['simulation_parameters']['cyclone_active']}, Blocked Drains {wif['simulation_parameters']['drainage_blocked_pct']}%")
            facts_lines.append(f"- What-If Overall Threat Index: {wif['overall_threat_index']}/100 ({wif['overall_risk']})")

        facts_lines.append("- Emergency Contacts: Dial 112 (National Emergency) | 1077 (District Disaster Helpline)")

        # ----------------------------------------------------
        # 4. GUARANTEED LLM SYNTHESIS
        # ----------------------------------------------------
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        llm_reply = None

        system_prompt = (
            "You are FloodShield AI, an intelligent, authoritative coastal flood decision copilot for India.\n"
            "CRITICAL DIRECTIVES:\n"
            "1. Answer the user's specific question DIRECTLY and PRECISELY in 2 to 4 clear, well-structured sentences. Use bolding for numbers, zone names, and road names.\n"
            "2. Base your entire response ONLY on the GROUNDED FACTS below. Do not guess or hallucinate.\n"
            "3. If the user asks 'which zones are in high alert', list the specific zones from the facts with their threat level and depth.\n"
            "4. If the user asks about weather, summarize current tide, rainfall intensity, and storm status.\n"
            "5. If the user asks 'is it safe', give a clear YES or NO, state the projected depth, and name safe shelters and closed roads.\n"
            "6. NO EMOJIS anywhere (Strict design requirement).\n"
            f"7. Address user as: {role.upper()}.\n\n"
            "GROUNDED FACTS:\n" + "\n".join(facts_lines)
        )

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for h in history[-4:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
        messages.append({"role": "user", "content": message or "What is the current safety status and risk assessment?"})

        if api_key:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://floodshield.ai",
                "X-Title": "FloodShield AI",
            }

            for model_name in ACTIVE_OPENROUTER_MODELS:
                try:
                    with httpx.Client(timeout=6.0) as client:
                        resp = client.post(
                            "https://openrouter.ai/api/v1/chat/completions",
                            headers=headers,
                            json={
                                "model": model_name,
                                "messages": messages,
                                "temperature": 0.1,
                                "max_tokens": 500,
                            },
                        )
                        if resp.status_code == 200:
                            msg_obj = resp.json().get("choices", [{}])[0].get("message", {})
                            raw_content = msg_obj.get("content") or ""
                            cleaned = clean_llm_response(raw_content)
                            if cleaned:
                                llm_reply = cleaned
                                break
                except Exception as e:
                    logger.debug(f"OpenRouter model {model_name} failed: {e}")
                    continue

        # ----------------------------------------------------
        # 5. DETERMINISTIC FALLBACK (If LLM is completely offline)
        # ----------------------------------------------------
        if not llm_reply:
            if parsed["is_multi_zone_query"]:
                comp = compare_coastal_zones(tide=tide, rain=rain, cyclone=cyclone)
                matrix = comp.get("comparison_matrix", [])
                high_zones = [z for z in matrix if "CRITICAL" in str(z["threat_level"]) or "HIGH" in str(z["threat_level"])]
                
                lines = []
                for z in high_zones:
                    t_str = str(z['threat_level']).replace('ThreatLevel.', '')
                    lines.append(f"- **{z['zone_name']} ({z['state']})**: **{t_str}** alert with **{z['projected_depth_meters']}m** projected depth ({z['population_at_risk']:,} residents at risk).")
                
                llm_reply = (
                    f"**CURRENT HIGH ALERT COASTAL ZONES**\n\n"
                    f"Under current conditions (Tide **{tide:.1f}m**, Rain **{rain:.0f}mm/h**), the following sectors are on **CRITICAL / HIGH ALERT**:\n\n"
                    + "\n".join(lines) +
                    f"\n\n**Immediate Action**: Residents in these sectors should avoid low-lying roads and move toward high-elevation shelters. Emergency Helpline: **112**."
                )

            elif parsed["is_weather_query"]:
                llm_reply = (
                    f"**CURRENT WEATHER & COASTAL FORCINGS**\n\n"
                    f"- **Astronomical Tide**: **{tide:.1f} meters MSL**\n"
                    f"- **Precipitation Rate**: **{rain:.0f} mm/hour**\n"
                    f"- **Storm Surge / Cyclone**: **{'ACTIVE' if cyclone else 'INACTIVE'}**\n"
                    f"- **Wind Velocity**: **{parsed['wind_speed_kmh']} km/h**\n\n"
                    f"Coastal waters are creating significant estuarine backflow in low-lying deltas."
                )

            elif parsed["is_historical"] and "historical_events" in grounded_data:
                events = grounded_data["historical_events"].get("events", [])
                ev_lines = [f"- **{e['year']} - {e['event_name']} ({e['state']})**: Recorded flood level **{e['recorded_flood_level_msl']}m MSL**, peak 24h rain **{e['peak_rainfall_24h_mm']}mm**, economic damage **INR {e['economic_loss_crore_inr']} Cr**, fatalities: **{e['casualty_count']}**." for e in events[:3]]
                llm_reply = (
                    f"**HISTORICAL DISASTER ARCHIVE RECORDS**\n\n"
                    + "\n".join(ev_lines)
                )

            else:
                evac = grounded_data.get("evacuation_corridor", {})
                subm_str = ", ".join([r["name"] for r in evac.get("submerged_roads", [])]) or "None"
                pass_str = ", ".join([r["name"] for r in evac.get("passable_roads", [])]) or "Elevated Expressway Bypass"
                sh = grounded_data.get("shelters_and_hospitals", {})
                safe_shelter = sh.get("safe_shelters", [{}])[0].get("name", "High-Ground Municipal Shelter")

                if "CRITICAL" in threat_clean or "HIGH" in threat_clean:
                    llm_reply = (
                        f"**EMERGENCY STATUS for {zone_name}**\n\n"
                        f"{zone_name} is currently **NOT SAFE** (Threat Level: **{threat_clean}**). Water is projected to reach **{depth:.2f}m** (~{depth*3.28:.1f} ft) within **{onset} minutes**.\n\n"
                        f"- **Submerged Roads**: Avoid **{subm_str}**.\n"
                        f"- **Passable Corridor**: Take **{pass_str}**.\n"
                        f"- **Safe Shelter**: Move to **{safe_shelter}** immediately.\n"
                        f"- **Emergency Rescue**: Dial **112**."
                    )
                else:
                    llm_reply = (
                        f"**STATUS for {zone_name}**\n\n"
                        f"Coastal conditions in {zone_name} are currently **SAFE** (**{depth:.2f}m** depth). No evacuation required at this time. Stay alert for updates."
                    )

        return {
            "reply": llm_reply,
            "threat_level": telemetry["threat_level"],
            "target_zone": zone_name,
            "grounded_facts": grounded_data,
            "tools_invoked": tools_used,
            "suggested_actions": suggested_actions,
            "referenced_zones": referenced_zones,
        }


assistant_service = AssistantService()
