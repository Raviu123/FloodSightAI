"""
FloodShield AI — Grounded Conversational AI Copilot Service
Integrates OpenRouter Free LLM Models with deterministic tool execution and grounded telemetry.
"""

import os
import re
import httpx
from typing import Dict, Any, List, Optional
from app.services.assistant_tools import (
    get_zone_telemetry,
    get_safe_evacuation_route,
    get_nearby_shelters_and_hospitals,
    explain_flood_drivers,
    get_disaster_sop_guidance,
)

# Prioritized List of Direct Instruction-Tuned Free OpenRouter Models
FREE_OPENROUTER_MODELS = [
    "liquid/lfm-2.5-2.6b:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "poolside/laguna-s-2.1:free",
    "poolside/laguna-xs-2.1:free",
    "apodex/apodex-1.1-mini:free",
    "nvidia/nemotron-3.5-lightning:free",
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
    if "thinking process" in cleaned.lower() or "analyze user input" in cleaned.lower():
        # Check for explicit separators
        for sep in ["\n\n---", "\n---", "\n\n**Answer:**", "\n\nAnswer:", "\n\nFinal Answer:", "\n\nConclusion:"]:
            if sep in cleaned:
                parts = cleaned.split(sep)
                cleaned = parts[-1].strip()
                break
        else:
            # Filter out reasoning monologue paragraphs
            paragraphs = cleaned.split("\n\n")
            valid_paras = []
            for p in paragraphs:
                p_lower = p.lower()
                if any(k in p_lower for k in [
                    "thinking process", "analyze user", "review grounded", 
                    "identify missing", "need to determine", "draft the response", 
                    "role: floodshield", "role instructions"
                ]):
                    continue
                if re.match(r"^\s*[-*]\s+(need to|analyze|check|determine|based on facts)", p_lower):
                    continue
                valid_paras.append(p)
            cleaned = "\n\n".join(valid_paras).strip()

    # 4. Final verification: reject if empty, too short, or still looks like thinking notes
    if not cleaned or len(cleaned) < 20:
        return None
    if "thinking process" in cleaned.lower() or cleaned.startswith("- Need to determine") or cleaned.startswith("1. Analyze"):
        return None

    return cleaned


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
        Synthesizes a verified grounded response using deterministic tools and OpenRouter LLM.
        """
        msg_lower = (message or "").lower()
        tools_used = []
        grounded_data = {}

        # 1. Determine zone context
        target_zone = zone_id or "ZONE-01"
        if "mangalore" in msg_lower or "netravati" in msg_lower or "zone 1" in msg_lower or "zone-01" in msg_lower or "zone 01" in msg_lower:
            target_zone = "ZONE-01"
        elif "udupi" in msg_lower or "malpe" in msg_lower or "zone 2" in msg_lower or "zone-02" in msg_lower or "zone 02" in msg_lower:
            target_zone = "ZONE-02"
        elif "kochi" in msg_lower or "ernakulam" in msg_lower or "zone 3" in msg_lower or "zone-03" in msg_lower or "zone 03" in msg_lower:
            target_zone = "ZONE-03"
        elif "chennai" in msg_lower or "adyar" in msg_lower or "zone 4" in msg_lower or "zone-04" in msg_lower or "zone 04" in msg_lower:
            target_zone = "ZONE-04"
        elif "vizag" in msg_lower or "visakhapatnam" in msg_lower or "zone 5" in msg_lower or "zone-05" in msg_lower or "zone 05" in msg_lower:
            target_zone = "ZONE-05"
        elif "mumbai" in msg_lower or "mithi" in msg_lower or "zone 6" in msg_lower or "zone-06" in msg_lower or "zone 06" in msg_lower:
            target_zone = "ZONE-06"
        elif "kolkata" in msg_lower or "zone 7" in msg_lower or "zone-07" in msg_lower or "zone 07" in msg_lower:
            target_zone = "ZONE-07"
        elif "puri" in msg_lower or "zone 8" in msg_lower or "zone-08" in msg_lower or "zone 08" in msg_lower:
            target_zone = "ZONE-08"

        # Always fetch live telemetry
        telemetry = get_zone_telemetry(target_zone)
        tools_used.append("get_zone_telemetry")
        grounded_data["telemetry"] = telemetry

        # 2. Check for route / road / evacuation intent
        route_info = get_safe_evacuation_route(target_zone)
        tools_used.append("get_safe_evacuation_route")
        grounded_data["evacuation_route"] = route_info

        # 3. Check for hospital / shelter intent
        shelters = get_nearby_shelters_and_hospitals(target_zone)
        tools_used.append("get_nearby_shelters_and_hospitals")
        grounded_data["shelters_and_hospitals"] = shelters

        # 4. Check for explanation intent
        drivers = explain_flood_drivers(target_zone)
        tools_used.append("explain_flood_drivers")
        grounded_data["flood_drivers"] = drivers

        # 5. Fetch SOP guidance
        sop = get_disaster_sop_guidance(telemetry["threat_level"], user_role=user_role or "civilian")
        tools_used.append("get_disaster_sop_guidance")
        grounded_data["sop_guidance"] = sop

        depth = telemetry["projected_depth_meters"]
        onset = telemetry["onset_time_minutes"]
        peak = telemetry["peak_time_minutes"]
        zone_name = telemetry["zone_name"]
        threat = telemetry["threat_level"]
        threat_clean = str(threat).replace("ThreatLevel.", "").upper()

        # 6. Try OpenRouter LLM Generation with Grounded Context
        api_key = os.getenv("OPENROUTER_API_KEY", "")
        llm_reply = None

        if api_key:
            system_prompt = (
                f"You are FloodShield AI, an intelligent coastal flood intelligence copilot for India.\n"
                f"CRITICAL RULE: Answer DIRECTLY in 2 to 4 sentences. Do NOT output any internal thinking process, reasoning steps, or notes.\n\n"
                f"VERIFIED GROUNDED FACTS:\n"
                f"- Zone Identifier: {telemetry['zone_id']} / {zone_name} ({telemetry['state']})\n"
                f"- Current Threat Level: {threat_clean}\n"
                f"- Projected Water Depth: {depth:.2f} meters\n"
                f"- Onset Countdown: {onset} minutes to breach | Peak Flood Stage: {peak} minutes\n"
                f"- Population at Risk: {telemetry['population_at_risk']:,} residents across {telemetry['inundated_area_sq_km']:.2f} sq km\n"
                f"- Primary Driver: {telemetry['primary_driver']} ({telemetry['primary_driver_pct']}% contribution)\n"
                f"- Submerged Impassable Roads: {', '.join(route_info['submerged_impassable_roads'])}\n"
                f"- Recommended Safe Roads: {', '.join(route_info['passable_recommended_roads'])}\n"
                f"- Safe Shelters: {', '.join([s['name'] + ' (Elev: ' + str(s['elevation_m']) + 'm)' for s in shelters['available_shelters']])}\n"
                f"- Threatened Hospitals: {', '.join([h['name'] + ' (' + h['status'] + ')' for h in shelters['threatened_hospitals']]) if shelters['threatened_hospitals'] else 'All operational'}\n"
                f"- Emergency Contacts: 112 / District Disaster Helpline: 1077\n\n"
                f"ROLE INSTRUCTIONS:\n"
                f"- User Persona: {user_role.upper()}\n"
                f"- If CIVILIAN: State clearly whether the zone is safe. Give exact road closures and safe shelters in plain language.\n"
                f"- If COMMANDER: Provide a concise tactical directive with resource deployment, boat requirements, and hospital triage.\n"
                f"NO EMOJIS. Use clean Markdown formatting."
            )

            messages = [{"role": "system", "content": system_prompt}]
            if history:
                for h in history[-4:]:
                    messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
            messages.append({"role": "user", "content": message or "What is the current safety status of this zone?"})

            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://floodshield.ai",
                "X-Title": "FloodShield AI",
            }

            for model_name in FREE_OPENROUTER_MODELS:
                try:
                    with httpx.Client(timeout=12.0) as client:
                        resp = client.post(
                            "https://openrouter.ai/api/v1/chat/completions",
                            headers=headers,
                            json={
                                "model": model_name,
                                "messages": messages,
                                "temperature": 0.1,
                                "max_tokens": 600,
                            },
                        )
                        if resp.status_code == 200:
                            msg_obj = resp.json().get("choices", [{}])[0].get("message", {})
                            raw_content = msg_obj.get("content") or ""
                            cleaned = clean_llm_response(raw_content)
                            if cleaned:
                                llm_reply = cleaned
                                break
                except Exception:
                    continue

        # 7. Fallback Deterministic Synthesis if LLM is offline or returned thinking monologue
        if not llm_reply:
            if user_role == "commander":
                llm_reply = (
                    f"**SITREP DIRECTIVE [{threat_clean} THREAT LEVEL] - {zone_name}**\n\n"
                    f"- **Telemetry**: Peak Depth: **{depth:.2f}m** | Onset Lead Time: **{onset} mins** | Peak Arrival: **{peak} mins**\n"
                    f"- **Population at Risk**: **{telemetry['population_at_risk']:,}** residents across **{telemetry['inundated_area_sq_km']:.2f} sq km**\n"
                    f"- **Primary Driver**: {telemetry['primary_driver']} ({telemetry['primary_driver_pct']}% contribution)\n"
                    f"- **Submerged Road Lifelines**: {', '.join(route_info['submerged_impassable_roads'])}\n"
                    f"- **Passable Access Corridors**: {', '.join(route_info['passable_recommended_roads'])}\n"
                    f"- **Critical Facilities**: {', '.join([h['name'] for h in shelters['threatened_hospitals']]) if shelters['threatened_hospitals'] else 'All operational'}\n"
                    f"- **Tactical SOP Action**: {sop['tactical_directives'][0]}"
                )
            elif user_role == "engineer":
                llm_reply = (
                    f"**HYDRODYNAMIC DIAGNOSTIC - {zone_name}**\n\n"
                    f"- **Water Surface Elevation**: **{depth:.2f}m** above ground datum.\n"
                    f"- **Kinematic Wave Lag**: **{onset} minutes** to breach | Peak Flood Stage: **{peak} minutes**.\n"
                    f"- **Topographic Drivers**: {telemetry['primary_driver']} ({telemetry['primary_driver_pct']}%), causing gravity drainage backflow.\n"
                    f"- **Inundated Area**: **{telemetry['inundated_area_sq_km']:.2f} sq km**.\n"
                    f"- **Engineering Intervention**: Deploy high-volume de-watering pumps to compromised culverts and close tidal flap gates."
                )
            else:
                if "CRITICAL" in threat_clean or "HIGH" in threat_clean:
                    shelter_str = shelters['available_shelters'][0]['name'] if shelters['available_shelters'] else "High-Ground Relief Shelter"
                    llm_reply = (
                        f"**EMERGENCY WARNING for {zone_name} ({target_zone})**\n\n"
                        f"No, {zone_name} is **NOT safe**. Water levels are rising rapidly and projected to reach **{depth:.2f}m** within **{onset} minutes** (Peak flooding in ~{peak//60}h {peak%60}m).\n\n"
                        f"- **ROAD CLOSURES**: Avoid **{', '.join(route_info['submerged_impassable_roads'])}** (submerged). Use **{', '.join(route_info['passable_recommended_roads'])}**.\n"
                        f"- **SAFE SHELTER**: Move immediately to **{shelter_str}**.\n"
                        f"- **SAFETY GUIDELINE**: {sop['safety_guidelines'][0]}\n\n"
                        f"In an emergency, call **112** or District Disaster Control: **1077**."
                    )
                else:
                    llm_reply = (
                        f"**STATUS for {zone_name} ({target_zone})**\n\n"
                        f"Yes, coastal water levels in {zone_name} are currently within safe parameters (**{depth:.2f}m**). "
                        f"No immediate evacuation is necessary. Stay tuned to official weather advisories."
                    )

        return {
            "reply": llm_reply,
            "threat_level": threat,
            "target_zone": zone_name,
            "grounded_facts": grounded_data,
            "tools_invoked": tools_used,
        }


assistant_service = AssistantService()
