import os
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any
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

        # Compute Hydrodynamic Decoupled Features in Real-Time
        barometric_surge_m = max(0.0, (1013.25 - surface_pressure_hpa) * 0.0104)
        total_sea_height = tide_level_m + barometric_surge_m
        
        # 1. Backwater effect (only impacts low coast & river channels)
        backwater_factor = max(0.0, (total_sea_height - elevation_m)) / (dist_to_coast_km + 0.5)

        # 2. Pluvial runoff (rain exceeding local drainage bottleneck)
        drainage_eff = (drainage_capacity_pct / 100.0) * max(0.2, (1.0 - 0.7 * backwater_factor))
        pluvial_runoff = max(0.0, rainfall_rate_mm_h * (1.0 - drainage_eff) * soil_saturation_idx)

        # 3. Fluvial river overflow
        fluvial_overflow = max(0.0, (river_discharge_m3_s - 400.0)) / (dist_to_river_km * 100.0 + 1.0)

        # 4. Topographic wetness index
        twi = np.log((1000.0 / (dist_to_river_km + 0.1)) / max(0.1, np.tan(np.radians(slope_degrees))))

        cyclone_active = 1 if (cyclone_wind_kmh >= 65.0 or surface_pressure_hpa < 995.0) else 0

        feature_row = {
            "tide_level_m": float(tide_level_m),
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
            "wave_height_m": float(wave_height_m),
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
        pred_depth = max(0.0, round(raw_depth, 2))
        is_flooded = pred_depth >= 0.15

        # 2. Regress Inundated Area (sq km)
        raw_area = float(area_model.predict(df_feats)[0])
        pred_area = max(0.0, round(raw_area, 2)) if is_flooded else 0.0

        # 3. Regress Hydrodynamic Timings (minutes)
        if is_flooded:
            onset_min = int(np.clip(onset_model.predict(df_feats)[0], 10, 360))
            peak_min = int(np.clip(peak_model.predict(df_feats)[0], onset_min + 15, 720))
        else:
            onset_min = 360
            peak_min = 720

        # 4. Classify Threat Level
        threat_str = str(classifier.predict(df_feats)[0]).upper()
        
        # Map string to ThreatLevel enum
        if "CRITICAL" in threat_str or pred_depth >= 1.5:
            threat_level = ThreatLevel.CRITICAL
        elif "HIGH" in threat_str or pred_depth >= 0.6:
            threat_level = ThreatLevel.HIGH
        elif "MEDIUM" in threat_str or pred_depth >= 0.25:
            threat_level = ThreatLevel.MEDIUM
        elif "LOW" in threat_str or is_flooded:
            threat_level = ThreatLevel.LOW
        else:
            threat_level = ThreatLevel.NO_DANGER

        # Class probabilities
        probs = classifier.predict_proba(df_feats)[0]
        prob_classes = list(classifier.classes_)
        prob_critical = float(probs[prob_classes.index("CRITICAL")]) if "CRITICAL" in prob_classes else 0.0
        prob_flooded = float(1.0 - (probs[prob_classes.index("NO_DANGER")] if "NO_DANGER" in prob_classes else 0.0))

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


ml_predictor = MLPredictorService()
