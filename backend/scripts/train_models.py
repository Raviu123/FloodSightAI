import os
import sys
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingRegressor
from sklearn.metrics import (
    roc_auc_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    mean_absolute_error,
    r2_score,
)

FEATURE_COLS = [
    "tide_level_m",
    "rainfall_rate_mm_h",
    "rainfall_accum_6h_mm",
    "elevation_m",
    "dist_to_coast_km",
    "dist_to_river_km",
    "drainage_capacity_pct",
    "soil_saturation_idx",
    "cyclone_wind_kmh",
]


def train_flood_models():
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "coastal_flood_training_data.csv"))
    if not os.path.exists(data_path):
        print("Training data not found. Generating now...")
        from generate_synthetic_data import generate_coastal_flood_dataset
        df = generate_coastal_flood_dataset(6000)
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        df.to_csv(data_path, index=False)
    else:
        df = pd.read_csv(data_path)

    print(f"Loaded {len(df)} training scenarios. Splitting Train/Test (80/20)...")
    X = df[FEATURE_COLS]
    y_cls = df["is_flooded"]
    y_depth = df["flood_depth_m"]
    y_onset = df["onset_time_min"]
    y_peak = df["peak_time_min"]

    X_train, X_test, y_cls_train, y_cls_test, y_d_train, y_d_test, y_on_train, y_on_test, y_pk_train, y_pk_test = train_test_split(
        X, y_cls, y_depth, y_onset, y_peak, test_size=0.2, random_state=42, stratify=y_cls
    )

    # 1. Train Flood Probability Classifier
    print("Training Flood Probability Classifier (Random Forest)...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_cls_train)

    cls_preds = clf.predict(X_test)
    cls_probs = clf.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_cls_test, cls_probs)
    acc = accuracy_score(y_cls_test, cls_preds)
    prec = precision_score(y_cls_test, cls_preds)
    rec = recall_score(y_cls_test, cls_preds)
    f1 = f1_score(y_cls_test, cls_preds)

    print(f"  [Classifier] AUC-ROC: {auc:.4f} | Accuracy: {acc*100:.2f}% | Precision: {prec*100:.2f}% | Recall: {rec*100:.2f}%")

    # 2. Train Flood Depth Regressor
    print("Training Inundation Depth Regressor (HistGradientBoosting)...")
    reg_depth = HistGradientBoostingRegressor(max_iter=150, max_depth=10, random_state=42)
    reg_depth.fit(X_train, y_d_train)
    depth_preds = reg_depth.predict(X_test)
    depth_mae = mean_absolute_error(y_d_test, depth_preds)
    depth_r2 = r2_score(y_d_test, depth_preds)
    print(f"  [Depth Regressor] MAE: {depth_mae:.3f}m | R^2: {depth_r2:.4f}")

    # 3. Train Timing Regressors (Onset & Peak)
    # Train onset regressor only on flooded samples for higher physical precision
    flooded_train_idx = y_cls_train == 1
    flooded_test_idx = y_cls_test == 1

    print("Training Onset Time Regressor (HistGradientBoosting)...")
    reg_onset = HistGradientBoostingRegressor(max_iter=100, max_depth=8, random_state=42)
    reg_onset.fit(X_train[flooded_train_idx], y_on_train[flooded_train_idx])
    onset_preds = reg_onset.predict(X_test[flooded_test_idx])
    onset_mae = mean_absolute_error(y_on_test[flooded_test_idx], onset_preds)
    print(f"  [Onset Time Regressor] MAE: {onset_mae:.2f} minutes")

    print("Training Peak Time Regressor (HistGradientBoosting)...")
    reg_peak = HistGradientBoostingRegressor(max_iter=100, max_depth=8, random_state=42)
    reg_peak.fit(X_train[flooded_train_idx], y_pk_train[flooded_train_idx])
    peak_preds = reg_peak.predict(X_test[flooded_test_idx])
    peak_mae = mean_absolute_error(y_pk_test[flooded_test_idx], peak_preds)
    print(f"  [Peak Time Regressor] MAE: {peak_mae:.2f} minutes")

    # Feature Importance extraction
    importances = clf.feature_importances_
    feature_importance_dict = {
        feat: round(float(imp) * 100, 2)
        for feat, imp in sorted(zip(FEATURE_COLS, importances), key=lambda x: x[1], reverse=True)
    }

    # Save artifacts
    ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "ml"))
    os.makedirs(ml_dir, exist_ok=True)

    model_package = {
        "features": FEATURE_COLS,
        "classifier": clf,
        "reg_depth": reg_depth,
        "reg_onset": reg_onset,
        "reg_peak": reg_peak,
        "feature_importances": feature_importance_dict,
    }

    model_file = os.path.join(ml_dir, "flood_models.joblib")
    joblib.dump(model_package, model_file)
    print(f"[SUCCESS] Serialized ML model package to {model_file} (Size: {os.path.getsize(model_file)/1024:.1f} KB)")

    metrics_payload = {
        "model_version": "1.0.0",
        "training_samples": len(df),
        "metrics": {
            "roc_auc": round(float(auc), 4),
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4),
            "depth_mae_meters": round(float(depth_mae), 3),
            "depth_r2": round(float(depth_r2), 4),
            "onset_time_mae_minutes": round(float(onset_mae), 2),
            "peak_time_mae_minutes": round(float(peak_mae), 2),
        },
        "global_feature_importances_pct": feature_importance_dict,
    }

    metrics_file = os.path.join(ml_dir, "metrics.json")
    with open(metrics_file, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"[SUCCESS] Saved model metrics report to {metrics_file}")


if __name__ == "__main__":
    train_flood_models()
