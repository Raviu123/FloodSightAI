from typing import Dict, Any, List
from datetime import datetime, timezone
from app.core.config import settings
import httpx
import logging

logger = logging.getLogger("floodshield.llm")


class LLMService:
    """
    LLM and rule-grounded service for generating official SITREP briefings,
    civic SMS alerts, and conversational tactical insights.
    """

    @classmethod
    def generate_sms_alert(
        cls,
        zone_name: str,
        threat_level: str,
        onset_min: int,
        peak_min: int,
        submerged_road: str = None,
        shelter_name: str = None,
    ) -> Dict[str, str]:
        """
        Generates SMS broadcast content under 160 characters when possible.
        """
        if threat_level in ["CRITICAL", "HIGH"]:
            headline = f"RED ALERT: Imminent Flood Threat in {zone_name}"
            road_note = f" Avoid {submerged_road}." if submerged_road else ""
            shelter_note = f" Move to {shelter_name} immediately." if shelter_name else " Move to designated high-ground shelters."
            sms = f"EMERGENCY: {zone_name} flood onset in {onset_min}m, peak in {peak_min}m.{road_note}{shelter_note} Dial 112 for rescue."
        elif threat_level == "MEDIUM":
            headline = f"YELLOW ADVISORY: Waterlogging Risk in {zone_name}"
            sms = f"ADVISORY: Moderate flooding expected in {zone_name} in {onset_min}m. Secure lower floors and avoid low-lying roads."
        else:
            headline = f"GREEN ADVISORY: Coastal Conditions Normal for {zone_name}"
            sms = f"INFO: {zone_name} coastal water levels within safe parameters. Normal precautions apply."

        return {
            "headline": headline,
            "sms_text": sms,
        }

    @classmethod
    def generate_sitrep_briefing(
        cls,
        simulation_params: Dict[str, Any],
        ranked_zones: List[Dict[str, Any]],
        total_population_at_risk: int,
        inundated_area_sq_km: float,
    ) -> Dict[str, Any]:
        """
        Generates a comprehensive Situation Report (SITREP) for emergency response command.
        """
        timestamp_str = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M UTC")
        
        tide = simulation_params.get("tide_level_meters", 1.0)
        rain = simulation_params.get("rainfall_mm_per_hour", 0.0)
        cyclone = simulation_params.get("cyclone_active", False)
        
        critical_zones = [z for z in ranked_zones if z.get("threat_level") in ["CRITICAL", "HIGH"]]
        top_priority_zone = ranked_zones[0] if ranked_zones else {}

        # Executive narrative summary
        if critical_zones:
            exec_summary = (
                f"Severe coastal storm surge and pluvial flooding active. Hydrodynamic ML forecasting indicates "
                f"{len(critical_zones)} high-vulnerability coastal zones breached critical flood thresholds. "
                f"Top operational priority is {top_priority_zone.get('zone_name')} due to projected depth of "
                f"{top_priority_zone.get('projected_depth_meters')}m and onset lead time of {top_priority_zone.get('onset_time_minutes')} minutes."
            )
        else:
            exec_summary = (
                f"Coastal monitoring network reports stable hydro-conditions with tidal fluctuations within standard tolerance limits. "
                f"No major critical infrastructure breaches detected."
            )

        tactical_directives = []
        if critical_zones:
            tactical_directives.append(f"Deploy NDRF quick-response teams to {top_priority_zone.get('zone_name')} (Priority Rank 1).")
            tactical_directives.append("Stage high-capacity diesel de-watering pumps at primary road culverts.")
            tactical_directives.append("Issue cell-broadcast emergency SMS alerts to residents in low-lying zones.")
        else:
            tactical_directives.append("Maintain routine automated sensor polling every 15 minutes.")
            tactical_directives.append("Keep coastal relief shelters on standard standby mode.")

        return {
            "incident_name": "OPERATION COASTAL SHIELD",
            "report_type": "OFFICIAL SITUATION REPORT (SITREP)",
            "timestamp": timestamp_str,
            "weather_condition": "CYCLONIC DEPRESSION & SURGE" if cyclone else "MONSOONAL RAINFALL CONVERGENCE",
            "telemetry": {
                "astronomical_tide_surge_m": tide,
                "peak_rainfall_intensity_mm_h": rain,
                "cyclonic_surge_active": cyclone,
            },
            "impact_assessment": {
                "total_zones_evaluated": len(ranked_zones),
                "critical_zones_count": len(critical_zones),
                "total_population_at_risk": total_population_at_risk,
                "estimated_inundation_area_sq_km": inundated_area_sq_km,
            },
            "executive_summary": exec_summary,
            "tactical_directives": tactical_directives,
            "ranked_zone_overview": [
                {
                    "rank": z.get("evacuation_priority_rank"),
                    "zone_name": z.get("zone_name"),
                    "threat_level": z.get("threat_level"),
                    "depth_m": z.get("projected_depth_meters"),
                    "onset_min": z.get("onset_time_minutes"),
                    "action": z.get("recommended_action"),
                }
                for z in ranked_zones
            ],
        }


llm_service = LLMService()
