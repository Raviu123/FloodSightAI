import os
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
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
            with open(METRICS_PATH, "r") as f:
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
    ) -> Dict[str, Any]:
        """
        Runs vector inference across trained Random Forest and Gradient Boosting models.
        """
        if not self.model_package:
            self._load_models()

        row = {
            "tide_level_m": float(tide_level_m),
            "rainfall_rate_mm_h": float(rainfall_rate_mm_h),
            "rainfall_accum_6h_mm": float(rainfall_accum_6h_mm),
            "elevation_m": float(elevation_m),
            "dist_to_coast_km": float(dist_to_coast_km),
            "dist_to_river_km": float(dist_to_river_km),
            "drainage_capacity_pct": float(drainage_capacity_pct),
            "soil_saturation_idx": float(soil_saturation_idx),
            "cyclone_wind_kmh": float(cyclone_wind_kmh),
        }
        df = pd.DataFrame([row])[self.model_package["features"]]

        clf = self.model_package["classifier"]
        reg_depth = self.model_package["reg_depth"]
        reg_onset = self.model_package["reg_onset"]
        reg_peak = self.model_package["reg_peak"]

        # 1. Flood Probability & Binary Decision
        prob = float(clf.predict_proba(df)[0, 1])
        is_flooded = bool(prob >= 0.45)

        # 2. Inundation Depth
        pred_depth = float(reg_depth.predict(df)[0])
        if not is_flooded:
            pred_depth = max(0.0, min(pred_depth, 0.12))
        else:
            pred_depth = max(0.20, pred_depth)
        pred_depth = round(pred_depth, 2)

        # 3. Timing
        if is_flooded:
            onset_min = int(np.clip(reg_onset.predict(df)[0], 15, 360))
            peak_min = int(np.clip(reg_peak.predict(df)[0], onset_min + 20, 720))
        else:
            onset_min = 360
            peak_min = 720

        # 4. Threat Level Classification
        if pred_depth >= 1.2 or prob >= 0.85:
            threat_level = ThreatLevel.CRITICAL
        elif pred_depth >= 0.5 or prob >= 0.65:
            threat_level = ThreatLevel.HIGH
        elif pred_depth >= 0.2 or prob >= 0.40:
            threat_level = ThreatLevel.MEDIUM
        elif prob >= 0.15:
            threat_level = ThreatLevel.LOW
        else:
            threat_level = ThreatLevel.NO_DANGER

        return {
            "flood_probability": round(prob, 3),
            "is_flooded": is_flooded,
            "projected_depth_meters": pred_depth,
            "onset_time_minutes": onset_min,
            "peak_time_minutes": peak_min,
            "threat_level": threat_level,
            "features_used": row,
        }

    def get_metrics_summary(self) -> Dict[str, Any]:
        return self.metrics


ml_predictor = MLPredictorService()
