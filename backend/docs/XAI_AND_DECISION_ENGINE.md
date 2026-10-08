# Explainable AI (XAI) & Decision Intelligence

This document details the **Explainable AI (XAI) Engine**, the **Juve Multi-Criteria Decision Framework**, and the **Automated Situation Report (SITREP) Generator** in **FloodShield AI**.

---

## 1. Explainable AI (XAI) Engine (`XAIEngine`)

Implemented in [`backend/app/services/xai_engine.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/services/xai_engine.py).

### Purpose
To answer the core challenge in the problem statement:
> *"Say why the AI believes what it believes, in words a non-technical person understands."*

### Feature Attribution Breakdown
For any zone, the engine normalizes physical contribution scores into exact percentages:

```json
[
  { "factor_key": "rainfall_rate_mm_h", "factor_name": "Torrential Rainfall Rate", "contribution_pct": 30.0 },
  { "factor_key": "tide_level_m", "factor_name": "Astronomical & Surge High Tide", "contribution_pct": 24.9 },
  { "factor_key": "elevation_m", "factor_name": "Low Terrain Ground Elevation", "contribution_pct": 18.2 },
  { "factor_key": "dist_to_river_km", "factor_name": "Estuary & River Confluence Backflow", "contribution_pct": 14.5 }
]
```

### Plain-Language Translation Logic
The engine dynamically generates clear, human-readable explanations based on threat level and top drivers:

- **Critical Threat Example**:
  > *"Severe flood danger for Kochi Backwaters & Canal Network (Peak Depth 1.77m). Driven primarily by Torrential Rainfall Rate (30.0%) combined with Astronomical & Surge High Tide (24.9%), causing rapid water accumulation beyond local drainage capacity."*
- **Advisory Example**:
  > *"Moderate waterlogging predicted in low-lying sections of Chennai Marina Lowlands. Contributing factors are Astronomical & Surge High Tide (28.4%) and ground elevation (2.1m MSL)."*

---

## 2. Juve Multi-Criteria Decision Framework (`DecisionEngine`)

Implemented in [`backend/app/services/decision_engine.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/services/decision_engine.py).

### Purpose
To provide emergency dispatchers (NDRF, District Collectors) with a defensible, mathematically ranked response priority list.

### Composite Priority Score Formula
$$\text{Priority Score} = w_{\text{severity}} \cdot S + w_{\text{population}} \cdot P + w_{\text{hospital}} \cdot H + w_{\text{time}} \cdot T$$

Where:
- **Severity Factor ($S \in [0, 35]$)**: Based on predicted water depth above ground level ($m$).
- **Population Density ($P \in [0, 25]$)**: Scaled by zone census population.
- **Hospital/Facility Exposure ($H \in [0, 25]$)**: Scaled by number of threatened healthcare centers and power stations.
- **Time Urgency ($T \in [0, 15]$)**: Inversely proportional to lead time to flood onset ($T_{\text{onset}}$).

### Priority Thresholds & Action Directives

| Priority Score | Dispatch Level | Tactical Directive |
|:---:|:---:|---|
| $\ge 65.0$ | **Priority 1** | Immediate NDRF flood-rescue deployment. Evacuate hospital ground floors to designated high-ground shelters. |
| $35.0 - 64.9$ | **Priority 2** | Stage high-capacity diesel de-watering pumps. Divert traffic away from low-elevation corridors. |
| $15.0 - 34.9$ | **Priority 3** | Issue advisory bulletins to local residents and maintain continuous tidal monitoring. |
| $< 15.0$ | **Routine** | Normal coastal monitoring operations. |

---

## 3. Infrastructure Exposure Assessment

The decision engine cross-references predicted flood depth against specific infrastructure in the zone:

1. **Hospitals**: Flagged as `AT_RISK` if flood depth $> 0.2\text{m}$ and hospital elevation $< \text{Depth} + 0.5\text{m}$ (e.g. *General Hospital West Kochi*).
2. **Safe Shelters**: Verified as `SAFE_OPERATIONAL` if elevation $> 10.0\text{m}$ MSL (e.g. *Ernakulam South High-Ground Relief Center*).
3. **Road Segments**: Categorized into:
   - `SUBMERGED_IMPASSABLE`: Water depth over road $> 0.3\text{m}$ (e.g. *Mattancherry Low Canal Ring Road*).
   - `PASSABLE`: Elevated flyovers and highway ridges (e.g. *MG Road Elevated Transit Flyover*).

---

## 4. Automated SITREP & SMS Generator (`LLMService`)

Implemented in [`backend/app/services/llm_service.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/services/llm_service.py).

### Situation Report (SITREP) Schema Output
- **Incident Name**: `OPERATION COASTAL SHIELD`
- **Timestamp**: UTC formatted issuance time
- **Weather Condition**: `CYCLONIC DEPRESSION & SURGE` / `MONSOONAL CONVERGENCE`
- **Impact Metrics**: Total population at risk, estimated inundation area ($\text{km}^2$), critical zone count
- **Executive Summary**: Narrative briefing for high-level command
- **Tactical Directives**: Specific action items for response units
- **Ranked Zone Overview**: Table of all monitored zones by priority rank

### Civic SMS Alerts
Formatted to deliver actionable warnings under standard SMS limits:
> *"EMERGENCY: Kochi Backwaters flood onset in 22m, peak in 308m. Avoid Mattancherry Low Canal Ring Road. Move to Ernakulam South High-Ground Relief Center immediately. Dial 112 for rescue."*
