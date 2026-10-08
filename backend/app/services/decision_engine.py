from typing import List, Dict, Any


class DecisionEngine:
    """
    Juve Multi-Criteria Decision Framework & Infrastructure Impact Evaluator.
    Ranks zones by urgency and flags threatened hospitals, shelters, and roads.
    """

    @staticmethod
    def _get_val(obj: Any, key: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    @classmethod
    def evaluate_zone_impact(
        cls,
        zone_id: str,
        zone_name: str,
        population: int,
        projected_depth_m: float,
        flood_probability: float,
        onset_time_min: int,
        facilities: List[Any],
        roads: List[Any],
    ) -> Dict[str, Any]:
        """
        Evaluates facility exposure, road transit viability, and composite priority score.
        """
        threatened_facilities = []
        safe_shelters = []
        submerged_roads = []
        passable_roads = []

        # 1. Facility Impact Analysis
        hospital_threat_count = 0
        for fac in facilities:
            fac_elev = cls._get_val(fac, "elevation_meters", 1.0)
            fac_type = cls._get_val(fac, "facility_type", "SHELTER")
            fac_name = cls._get_val(fac, "name", "Facility")
            fac_capacity = cls._get_val(fac, "capacity", 0)

            if projected_depth_m > 0.2 and fac_elev < (projected_depth_m + 0.5):
                threatened_facilities.append({
                    "name": fac_name,
                    "type": fac_type,
                    "elevation_meters": fac_elev,
                    "capacity": fac_capacity,
                    "status": "AT_RISK" if fac_type == "HOSPITAL" else "COMPROMISED",
                })
                if fac_type == "HOSPITAL":
                    hospital_threat_count += 1
            elif fac_type == "SHELTER" and fac_elev > 10.0:
                safe_shelters.append({
                    "name": fac_name,
                    "type": fac_type,
                    "elevation_meters": fac_elev,
                    "capacity": fac_capacity,
                    "status": "SAFE_OPERATIONAL",
                })

        # 2. Road Network Vulnerability Analysis
        for rd in roads:
            rd_elev = cls._get_val(rd, "elevation_meters", 1.0)
            rd_name = cls._get_val(rd, "name", "Road")
            cutoff_depth = cls._get_val(rd, "flood_cutoff_depth_m", 0.3)

            if projected_depth_m >= cutoff_depth and rd_elev < 3.0:
                submerged_roads.append({
                    "name": rd_name,
                    "elevation_meters": rd_elev,
                    "status": "SUBMERGED_IMPASSABLE",
                    "depth_over_road_m": round(max(0.0, projected_depth_m - rd_elev), 2),
                })
            else:
                passable_roads.append({
                    "name": rd_name,
                    "elevation_meters": rd_elev,
                    "status": "PASSABLE",
                })

        # 3. Juve Multi-Criteria Urgency Priority Score
        severity_factor = min(1.0, projected_depth_m / 2.0) * 35.0
        population_factor = min(1.0, population / 40000.0) * 25.0
        hospital_factor = min(1.0, hospital_threat_count * 0.5) * 25.0
        time_urgency = max(0.0, (1.0 - (onset_time_min / 360.0))) * 15.0 if projected_depth_m > 0.2 else 0.0

        priority_score = round(severity_factor + population_factor + hospital_factor + time_urgency, 1)

        # Recommended immediate action
        if priority_score >= 65.0:
            recommended_action = "PRIORITY 1: Dispatch NDRF flood-rescue craft. Evacuate hospital ground floors to safe shelter."
        elif priority_score >= 35.0:
            recommended_action = "PRIORITY 2: Place drainage pumps on active surge lines. Divert traffic away from low-elevation corridors."
        elif priority_score >= 15.0:
            recommended_action = "PRIORITY 3: Issue advisory bulletins to local residents and maintain continuous tidal monitoring."
        else:
            recommended_action = "ROUTINE: Normal operations. No emergency intervention required."

        return {
            "priority_score": priority_score,
            "threatened_facilities": threatened_facilities,
            "safe_shelters": safe_shelters,
            "submerged_roads": submerged_roads,
            "passable_roads": passable_roads,
            "recommended_action": recommended_action,
        }

    @classmethod
    def rank_zones(cls, zone_evaluations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        sorted_zones = sorted(zone_evaluations, key=lambda x: x["priority_score"], reverse=True)
        for rank, z in enumerate(sorted_zones, start=1):
            z["evacuation_priority_rank"] = rank
        return sorted_zones


decision_engine = DecisionEngine()
