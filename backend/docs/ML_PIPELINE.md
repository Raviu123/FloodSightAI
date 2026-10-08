# Machine Learning Pipeline & Predictive Models

This document describes the complete ML architecture, dataset formulation, model training, evaluation metrics, and inference service implemented in **FloodShield AI**.

---

## 1. Physics-Informed Dataset Generation

The dataset generator ([`backend/scripts/generate_synthetic_data.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/scripts/generate_synthetic_data.py)) simulates **6,000 realistic Indian coastal storm scenarios** using hydrodynamic principles.

### Input Features Matrix (9 Features)

| Feature | Type | Range | Description |
|---|:---:|:---:|---|
| `tide_level_m` | Float | 0.3m – 4.5m | Astronomical tide + spring surge above Mean Sea Level (MSL) |
| `rainfall_rate_mm_h` | Float | 0.0 – 180.0 mm/h | Instantaneous precipitation intensity |
| `rainfall_accum_6h_mm` | Float | 0.0 – 400.0 mm | Antecedent 6-hour rainfall volume |
| `elevation_m` | Float | 0.3m – 15.0m | Terrain elevation above MSL from Digital Elevation Model (DEM) |
| `dist_to_coast_km` | Float | 0.05km – 10.0km | Distance to open coastline |
| `dist_to_river_km` | Float | 0.02km – 5.0km | Distance to river mouth / estuary confluence |
| `drainage_capacity_pct` | Float | 15.0% – 90.0% | Stormwater network conveyance efficiency |
| `soil_saturation_idx` | Float | 0.2 – 1.0 | Antecedent ground soil moisture & imperviousness ratio |
| `cyclone_wind_kmh` | Float | 10.0 – 150.0 km/h | Cyclonic wind force creating atmospheric storm surge |

### Target Variables (Ground Truth Labels)

1. **`is_flooded`** (Binary `0` or `1`): Flood event occurrence (water depth $>0.15\text{m}$).
2. **`flood_depth_m`** (Float `0.0` to `3.5m`): Peak inundation depth above ground level.
3. **`onset_time_min`** (Integer `15` to `360` mins): Time until water level breaches the critical flood threshold.
4. **`peak_time_min`** (Integer `45` to `720` mins): Time until maximum storm surge and runoff crest.

### Hydrodynamic Physical Formulas Used

1. **Coastal Surge Decay**:
   $$\text{Surge Head} = \left(\text{Tide} + 0.4 \times \left(\frac{\text{Wind}}{100}\right)^{1.5}\right) \times e^{-\frac{\text{Dist}_{\text{Coast}}}{2.5}}$$

2. **Pluvial Runoff Excess**:
   $$\text{Pluvial Excess} = \max\left(0, \text{Rainfall} \times \text{Saturation} - \text{Drainage Rate}\right)$$

3. **Estuary Confluence Backflow Penalty**:
   $$\text{Confluence Backflow} = \max\left(0, \text{Tide} - 2.0\right) \times 0.35 \times e^{-\text{Dist}_{\text{River}}}$$

---

## 2. Model Architectures & Training

The training script ([`backend/scripts/train_models.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/scripts/train_models.py)) splits the 6,000 samples (80% Train, 20% Test) and trains 4 dedicated models:

```
                            ┌────────────────────────────────────────┐
                            │        9 Incoming Zone Features        │
                            └───────────────────┬────────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
  ┌─────────────────────────────┐┌─────────────────────────────┐┌─────────────────────────────┐
  │  Probability Classifier     ││   Inundation Depth Model    ││    Timing Models (2x)       │
  │  RandomForestClassifier     ││  HistGradientBoosting       ││  HistGradientBoosting       │
  │  (n_estimators=100, d=12)   ││  (max_iter=150, d=10)       ││  (max_iter=100, d=8)        │
  │  Output: P(Flood) ∈ [0, 1]  ││  Output: Depth in meters    ││  Output: Onset & Peak Mins  │
  └─────────────────────────────┘└─────────────────────────────┘└─────────────────────────────┘
```

---

## 3. Evaluation Metrics & Validation

The exact validation results logged in [`backend/app/ml/metrics.json`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/ml/metrics.json):

| Model | Metric | Value Achieved | Industry Benchmark |
|---|---|:---:|:---:|
| **Flood Probability Classifier** | **AUC-ROC** | **0.9952** | $>0.90$ |
| | **Accuracy** | **97.17%** | $>85\%$ |
| | **Precision** | **94.51%** | $>80\%$ |
| | **Recall** | **74.78%** | $>70\%$ |
| **Inundation Depth Regressor** | **Mean Absolute Error (MAE)** | **0.024 m** ($2.4\text{ cm}$) | $<0.15\text{ m}$ |
| | **$R^2$ Score** | **0.9369** | $>0.80$ |
| **Onset Time Regressor ($T_{\text{onset}}$)** | **MAE** | **6.43 minutes** | $<30\text{ mins}$ |
| **Peak Time Regressor ($T_{\text{peak}}$)** | **MAE** | **10.99 minutes** | $<45\text{ mins}$ |

---

## 4. Global Feature Importances

Calculated from the Random Forest ensemble:

| Rank | Factor | Importance Percentage |
|:---:|---|:---:|
| 1 | `elevation_m` (Terrain Elevation) | **26.97%** |
| 2 | `tide_level_m` (Tide Level) | **22.50%** |
| 3 | `dist_to_coast_km` (Coastline Distance) | **14.81%** |
| 4 | `rainfall_accum_6h_mm` (6h Rain Accumulation) | **10.05%** |
| 5 | `rainfall_rate_mm_h` (Instant Rain Rate) | **9.57%** |
| 6 | `dist_to_river_km` (River Distance) | **7.57%** |
| 7 | `soil_saturation_idx` (Soil Moisture) | **4.27%** |
| 8 | `cyclone_wind_kmh` (Wind Force) | **2.62%** |
| 9 | `drainage_capacity_pct` (Drainage Efficiency) | **1.64%** |

---

## 5. Inference Service (`MLPredictorService`)

Implemented in [`backend/app/services/ml_predictor.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/services/ml_predictor.py):

- **Inference Latency**: $\approx 2.4\text{ ms}$ per zone.
- **Model Package Size**: $3.0\text{ MB}$ total on disk (`flood_models.joblib`).
- **Memory Footprint**: $< 45\text{ MB}$ RAM resident.
- **Threat Level Mapping**:
  - `CRITICAL`: Depth $\ge 1.2\text{m}$ or $P(\text{Flood}) \ge 0.85$
  - `HIGH`: Depth $\ge 0.5\text{m}$ or $P(\text{Flood}) \ge 0.65$
  - `MEDIUM`: Depth $\ge 0.2\text{m}$ or $P(\text{Flood}) \ge 0.40$
  - `LOW`: $P(\text{Flood}) \ge 0.15$
  - `NO_DANGER`: $P(\text{Flood}) < 0.15$
