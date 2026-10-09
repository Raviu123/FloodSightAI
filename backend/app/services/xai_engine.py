from typing import Dict, Any, List


class XAIEngine:
    """
    Explainable AI (XAI) engine that computes local factor attributions
    and generates clear, non-technical plain-language driver summaries.
    """

    FACTOR_LABELS = {
        "tide_level_m": "Astronomical Surge & High Tide",
        "rainfall_rate_mm_h": "Intense Precipitation Inflow",
        "rainfall_accum_6h_mm": "Antecedent 6-Hour Water Accumulation",
        "elevation_m": "Low Terrain Ground Elevation",
        "dist_to_coast_km": "Proximity to Open Coastline",
        "dist_to_river_km": "River Channel Overtopping & Backflow",
        "drainage_capacity_pct": "Stormwater Drainage Bottleneck",
        "soil_saturation_idx": "Ground Soil Moisture Saturation",
        "cyclone_wind_kmh": "Cyclonic Wind Surge Force",
        "river_discharge_m3_s": "Upstream River Discharge Head",
    }

    @classmethod
    def explain_prediction(
        cls,
        features: Dict[str, float],
        flood_probability: float,
        projected_depth_m: float,
        zone_name: str,
    ) -> Dict[str, Any]:
        """
        Computes normalized percentage driver attributions for a specific zone scenario.
        """
        tide = features.get("tide_level_m", 1.0)
        rain_rate = features.get("rainfall_rate_mm_h", 10.0)
        rain_6h = features.get("rainfall_accum_6h_mm", 20.0)
        elev = features.get("elevation_m", 2.0)
        dist_coast = features.get("dist_to_coast_km", 2.0)
        dist_river = features.get("dist_to_river_km", 1.0)
        drainage = features.get("drainage_capacity_pct", 50.0)
        saturation = features.get("soil_saturation_idx", 0.5)
        wind = features.get("cyclone_wind_kmh", 20.0)
        discharge = features.get("river_discharge_m3_s", 350.0)

        is_coastal = float(dist_coast) <= 25.0

        # Calculate raw risk factor contributions
        tide_score = max(0.0, (tide / 3.5) * 35.0) if is_coastal else 0.0
        rain_score = max(0.1, (rain_rate / 90.0) * 32.0 + (rain_6h / 200.0) * 12.0)
        elev_score = max(0.1, max(0.0, (4.5 - elev)) * 9.0)
        drainage_score = max(0.1, (100.0 - drainage) * 0.18)
        confluence_score = max(0.1, max(0.0, (2.5 - dist_river)) * 8.0)
        saturation_score = max(0.1, saturation * 15.0)
        wind_score = max(0.0, (wind / 120.0) * 8.0) if is_coastal else 0.0
        discharge_score = max(0.1, (discharge / 3000.0) * 28.0) if not is_coastal else max(0.0, (discharge / 3000.0) * 8.0)

        scores = {
            "rainfall_rate_mm_h": rain_score,
            "elevation_m": elev_score,
            "drainage_capacity_pct": drainage_score,
            "dist_to_river_km": confluence_score,
            "soil_saturation_idx": saturation_score,
        }

        if is_coastal:
            scores["tide_level_m"] = tide_score
            scores["cyclone_wind_kmh"] = wind_score
        else:
            scores["river_discharge_m3_s"] = discharge_score

        total_score = sum(scores.values()) or 1.0
        drivers: List[Dict[str, Any]] = []

        for key, val in sorted(scores.items(), key=lambda item: item[1], reverse=True):
            pct = round((val / total_score) * 100.0, 1)
            drivers.append({
                "factor_key": key,
                "factor_name": cls.FACTOR_LABELS.get(key, key),
                "contribution_pct": pct,
                "raw_value": features.get(key),
            })

        # Generate non-technical plain English summary
        top_driver = drivers[0]["factor_name"]
        second_driver = drivers[1]["factor_name"] if len(drivers) > 1 else "elevated runoff"
        
        if flood_probability >= 0.70 or projected_depth_m >= 0.8:
            explanation = (
                f"Severe flood danger for {zone_name} (Peak Depth {projected_depth_m}m). "
                f"Driven primarily by {top_driver} ({drivers[0]['contribution_pct']}%) combined with "
                f"{second_driver} ({drivers[1]['contribution_pct']}%), causing rapid water accumulation "
                f"beyond local drainage capacity."
            )
        elif flood_probability >= 0.40:
            explanation = (
                f"Moderate waterlogging predicted in low-lying sections of {zone_name}. "
                f"Contributing factors are {top_driver} ({drivers[0]['contribution_pct']}%) and "
                f"ground elevation ({elev}m MSL). Runoff channels are operating near peak capacity."
            )
        else:
            explanation = (
                f"Normal coastal conditions in {zone_name}. Drainage channels and ground elevation ({elev}m MSL) "
                f"are sufficient to absorb current rainfall and tidal flow without significant inundation."
            )

        return {
            "primary_drivers": drivers[:4],  # Top 4 drivers
            "all_drivers": drivers,
            "plain_language_explanation": explanation,
        }


xai_engine = XAIEngine()
