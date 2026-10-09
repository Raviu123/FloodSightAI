import os
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from app.schemas.simulation import ThreatLevel

MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml", "flood_models.joblib"))
METRICS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml", "metrics.json"))


class MLPredictorService:
    def __init__(self):
        self.model_package = None
        self.metrics = {}
        self._load_models()

    def _load_models(self):
        if os.path.exists(MODEL_PATH):
            self.model_package = joblib.load(MODEL_PATH)
        if os.path.exists(METRICS_PATH):
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                self.metrics = json.load(f)

    def predict_zone(
        self,
        tide_level_m: float,
        rainfall_rate_mm_h: float,
        rainfall_accum_6h_mm: float,
        elevation_m: float,
        dist_to_coast_km: float,
        dist_to_river_km: float,
        drainage_capacity_pct: float,
        soil_saturation_idx: float,
        cyclone_wind_kmh: float,
        surface_pressure_hpa: float = 1013.0,
        river_discharge_m3_s: float = 350.0,
        slope_degrees: float = 1.0,
        wind_gust_kmh: float = 30.0,
        wave_height_m: float = 1.2,
    ) -> Dict[str, Any]:
        """
        Executes decoupled hydrodynamic vector inference across trained Gradient Boosted
        regressors and calibrated multi-class Random Forest classifier.
        """
        if not self.model_package:
            self._load_models()

        # Decouple Astronomical Tide for Inland/Riverine Basins
        is_coastal_reach = float(dist_to_coast_km) <= 25.0
        effective_tide = float(tide_level_m) * max(0.0, 1.0 - (float(dist_to_coast_km) / 25.0)) if is_coastal_reach else 0.0

        # Compute Hydrodynamic Decoupled Features in Real-Time
        barometric_surge_m = max(0.0, (1013.25 - surface_pressure_hpa) * 0.0104) if is_coastal_reach else 0.0
        total_sea_height = effective_tide + barometric_surge_m
        
        # 1. Backwater effect (only impacts coastal estuary & tidal inlets)
        backwater_factor = max(0.0, (total_sea_height - elevation_m)) / (dist_to_coast_km + 0.5) if is_coastal_reach else 0.0

        # 2. Pluvial runoff (rain exceeding local drainage bottleneck)
        drainage_eff = (drainage_capacity_pct / 100.0) * max(0.2, (1.0 - 0.7 * backwater_factor))
        pluvial_runoff = max(0.0, rainfall_rate_mm_h * (1.0 - drainage_eff) * soil_saturation_idx)

        # 3. Fluvial river overflow (governed by upstream discharge and proximity to river channel)
        fluvial_overflow = max(0.0, (river_discharge_m3_s - 300.0)) / (dist_to_river_km * 10.0 + 1.0)

        # 4. Topographic wetness index
        twi = np.log((1000.0 / (dist_to_river_km + 0.1)) / max(0.1, np.tan(np.radians(slope_degrees))))

        cyclone_active = 1 if (cyclone_wind_kmh >= 65.0 or surface_pressure_hpa < 995.0) else 0

        feature_row = {
            "tide_level_m": float(effective_tide),
            "rainfall_rate_mm_h": float(rainfall_rate_mm_h),
            "rainfall_accum_6h_mm": float(rainfall_accum_6h_mm),
            "rainfall_accum_24h_mm": float(rainfall_accum_6h_mm * 1.8),
            "surface_pressure_hpa": float(surface_pressure_hpa),
            "wind_speed_kmh": float(cyclone_wind_kmh),
            "wind_gust_kmh": float(wind_gust_kmh),
            "cyclone_active": cyclone_active,
            "soil_saturation_idx": float(soil_saturation_idx),
            "elevation_m": float(elevation_m),
            "dist_to_coast_km": float(dist_to_coast_km),
            "dist_to_river_km": float(dist_to_river_km),
            "drainage_capacity_pct": float(drainage_capacity_pct),
            "river_discharge_m3_s": float(river_discharge_m3_s),
            "wave_height_m": float(wave_height_m if is_coastal_reach else 0.0),
            "backwater_factor": float(backwater_factor),
            "pluvial_runoff": float(pluvial_runoff),
            "fluvial_overflow": float(fluvial_overflow),
            "barometric_surge_m": float(barometric_surge_m),
            "topographic_wetness_index": float(twi),
        }

        feature_cols = self.model_package["feature_columns"]
        df_feats = pd.DataFrame([feature_row])[feature_cols]

        depth_model = self.model_package["depth_model"]
        area_model = self.model_package["area_model"]
        onset_model = self.model_package["onset_model"]
        peak_model = self.model_package["peak_model"]
        classifier = self.model_package["classifier"]

        # 1. Regress Inundation Depth (meters)
        raw_depth = float(depth_model.predict(df_feats)[0])
        
        # Hydraulic continuity calibration
        coastal_surge_head = max(0.0, (effective_tide + barometric_surge_m - elevation_m)) * np.exp(-dist_to_coast_km / 10.0) if is_coastal_reach else 0.0
        pluvial_inflow_m = (rainfall_rate_mm_h * (1.0 - drainage_eff) * soil_saturation_idx / 75.0) * 0.75
        fluvial_inflow_m = max(0.0, (river_discharge_m3_s - 320.0) / 1100.0) / (dist_to_river_km + 0.4)
        
        hydraulic_depth = coastal_surge_head + pluvial_inflow_m + fluvial_inflow_m
        pred_depth = max(0.0, round(float(0.4 * raw_depth + 0.6 * hydraulic_depth), 2))
        is_flooded = pred_depth >= 0.12

        # 2. Dynamic Inundated Area (sq km)
        raw_area = float(area_model.predict(df_feats)[0])
        phys_area = round(float(pred_depth * (8.5 + pluvial_runoff * 0.08)), 2)
        pred_area = max(0.0, round(float(0.35 * raw_area + 0.65 * phys_area), 2)) if is_flooded else 0.0

        # 3. Regress Hydrodynamic Timings (minutes)
        if is_flooded:
            onset_min = int(np.clip(onset_model.predict(df_feats)[0], 10, 360))
            peak_min = int(np.clip(peak_model.predict(df_feats)[0], onset_min + 15, 720))
        else:
            onset_min = 360
            peak_min = 720

        # 4. Classify Threat Level
        threat_str = str(classifier.predict(df_feats)[0]).upper()
        
        # Calibrated ThreatLevel Assignment
        if pred_depth >= 1.25 or (is_flooded and "CRITICAL" in threat_str):
            threat_level = ThreatLevel.CRITICAL
        elif pred_depth >= 0.55 or (is_flooded and "HIGH" in threat_str):
            threat_level = ThreatLevel.HIGH
        elif pred_depth >= 0.20 or (is_flooded and "MEDIUM" in threat_str):
            threat_level = ThreatLevel.MEDIUM
        elif pred_depth >= 0.08 or is_flooded:
            threat_level = ThreatLevel.LOW
        else:
            threat_level = ThreatLevel.NO_DANGER

        # Class probabilities
        probs = classifier.predict_proba(df_feats)[0]
        prob_classes = list(classifier.classes_)
        prob_critical = float(probs[prob_classes.index("CRITICAL")]) if "CRITICAL" in prob_classes else 0.0
        prob_flooded = min(1.0, max(0.05, float(1.0 - (probs[prob_classes.index("NO_DANGER")] if "NO_DANGER" in prob_classes else 0.0)) + (pred_depth * 0.25)))

        return {
            "flood_probability": round(prob_flooded, 3),
            "is_flooded": is_flooded,
            "projected_depth_meters": pred_depth,
            "inundated_area_sq_km": pred_area,
            "onset_time_minutes": onset_min,
            "peak_time_minutes": peak_min,
            "threat_level": threat_level,
            "prob_critical": round(prob_critical, 3),
            "features_used": feature_row,
        }

    def predict_batch(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Executes high-throughput batch vector inference across multiple zones/timesteps simultaneously in <20ms.
        """
        if not self.model_package:
            self._load_models()

        if not items:
            return []

        feature_rows = []
        metadata_list = []

        for item in items:
            tide_level_m = float(item.get("tide_level_m", 0.0))
            rainfall_rate_mm_h = float(item.get("rainfall_rate_mm_h", 0.0))
            rainfall_accum_6h_mm = float(item.get("rainfall_accum_6h_mm", 0.0))
            elevation_m = float(item.get("elevation_m", 5.0))
            dist_to_coast_km = float(item.get("dist_to_coast_km", 10.0))
            dist_to_river_km = float(item.get("dist_to_river_km", 2.0))
            drainage_capacity_pct = float(item.get("drainage_capacity_pct", 70.0))
            soil_saturation_idx = float(item.get("soil_saturation_idx", 0.75))
            cyclone_wind_kmh = float(item.get("cyclone_wind_kmh", 35.0))
            surface_pressure_hpa = float(item.get("surface_pressure_hpa", 1013.0))
            river_discharge_m3_s = float(item.get("river_discharge_m3_s", 350.0))
            slope_degrees = float(item.get("slope_degrees", 1.0))
            wind_gust_kmh = float(item.get("wind_gust_kmh", 30.0))
            wave_height_m = float(item.get("wave_height_m", 1.2))

            is_coastal_reach = dist_to_coast_km <= 25.0
            effective_tide = tide_level_m * max(0.0, 1.0 - (dist_to_coast_km / 25.0)) if is_coastal_reach else 0.0
            barometric_surge_m = max(0.0, (1013.25 - surface_pressure_hpa) * 0.0104) if is_coastal_reach else 0.0
            total_sea_height = effective_tide + barometric_surge_m

            backwater_factor = max(0.0, (total_sea_height - elevation_m)) / (dist_to_coast_km + 0.5) if is_coastal_reach else 0.0
            drainage_eff = (drainage_capacity_pct / 100.0) * max(0.2, (1.0 - 0.7 * backwater_factor))
            pluvial_runoff = max(0.0, rainfall_rate_mm_h * (1.0 - drainage_eff) * soil_saturation_idx)
            fluvial_overflow = max(0.0, (river_discharge_m3_s - 300.0)) / (dist_to_river_km * 10.0 + 1.0)
            twi = np.log((1000.0 / (dist_to_river_km + 0.1)) / max(0.1, np.tan(np.radians(slope_degrees))))
            cyclone_active = 1 if (cyclone_wind_kmh >= 65.0 or surface_pressure_hpa < 995.0) else 0

            feature_row = {
                "tide_level_m": float(effective_tide),
                "rainfall_rate_mm_h": float(rainfall_rate_mm_h),
                "rainfall_accum_6h_mm": float(rainfall_accum_6h_mm),
                "rainfall_accum_24h_mm": float(rainfall_accum_6h_mm * 1.8),
                "surface_pressure_hpa": float(surface_pressure_hpa),
                "wind_speed_kmh": float(cyclone_wind_kmh),
                "wind_gust_kmh": float(wind_gust_kmh),
                "cyclone_active": cyclone_active,
                "soil_saturation_idx": float(soil_saturation_idx),
                "elevation_m": float(elevation_m),
                "dist_to_coast_km": float(dist_to_coast_km),
                "dist_to_river_km": float(dist_to_river_km),
                "drainage_capacity_pct": float(drainage_capacity_pct),
                "river_discharge_m3_s": float(river_discharge_m3_s),
                "wave_height_m": float(wave_height_m if is_coastal_reach else 0.0),
                "backwater_factor": float(backwater_factor),
                "pluvial_runoff": float(pluvial_runoff),
                "fluvial_overflow": float(fluvial_overflow),
                "barometric_surge_m": float(barometric_surge_m),
                "topographic_wetness_index": float(twi),
            }
            feature_rows.append(feature_row)
            metadata_list.append({
                "is_coastal_reach": is_coastal_reach,
                "effective_tide": effective_tide,
                "barometric_surge_m": barometric_surge_m,
                "elevation_m": elevation_m,
                "dist_to_coast_km": dist_to_coast_km,
                "dist_to_river_km": dist_to_river_km,
                "rainfall_rate_mm_h": rainfall_rate_mm_h,
                "drainage_eff": drainage_eff,
                "soil_saturation_idx": soil_saturation_idx,
                "river_discharge_m3_s": river_discharge_m3_s,
                "pluvial_runoff": pluvial_runoff,
            })

        feature_cols = self.model_package["feature_columns"]
        df_feats = pd.DataFrame(feature_rows)[feature_cols]

        depth_model = self.model_package["depth_model"]
        area_model = self.model_package["area_model"]

        raw_depths = depth_model.predict(df_feats)
        raw_areas = area_model.predict(df_feats)

        results = []
        for i in range(len(items)):
            meta = metadata_list[i]
            r_depth = float(raw_depths[i])
            r_area = float(raw_areas[i])

            coastal_surge_head = max(0.0, (meta["effective_tide"] + meta["barometric_surge_m"] - meta["elevation_m"])) * np.exp(-meta["dist_to_coast_km"] / 10.0) if meta["is_coastal_reach"] else 0.0
            pluvial_inflow_m = (meta["rainfall_rate_mm_h"] * (1.0 - meta["drainage_eff"]) * meta["soil_saturation_idx"] / 75.0) * 0.75
            fluvial_inflow_m = max(0.0, (meta["river_discharge_m3_s"] - 320.0) / 1100.0) / (meta["dist_to_river_km"] + 0.4)
            hydraulic_depth = coastal_surge_head + pluvial_inflow_m + fluvial_inflow_m

            pred_depth = max(0.0, round(float(0.4 * r_depth + 0.6 * hydraulic_depth), 2))
            is_flooded = pred_depth >= 0.12
            phys_area = round(float(pred_depth * (8.5 + meta["pluvial_runoff"] * 0.08)), 2)
            pred_area = max(0.0, round(float(0.35 * r_area + 0.65 * phys_area), 2)) if is_flooded else 0.0

            if pred_depth >= 1.25:
                threat_level = ThreatLevel.CRITICAL
            elif pred_depth >= 0.55:
                threat_level = ThreatLevel.HIGH
            elif pred_depth >= 0.20:
                threat_level = ThreatLevel.MEDIUM
            elif pred_depth >= 0.08 or is_flooded:
                threat_level = ThreatLevel.LOW
            else:
                threat_level = ThreatLevel.NO_DANGER

            results.append({
                "projected_depth_meters": pred_depth,
                "inundated_area_sq_km": pred_area,
                "is_flooded": is_flooded,
                "threat_level": threat_level,
            })

        return results


ml_predictor = MLPredictorService()
