# FloodShield AI — Backend Machine Learning & Decision Intelligence Architecture

## 1. Glossary of Fundamental Terms

| Technical Term | Plain-Language Definition | Practical Application in FloodShield AI |
| :--- | :--- | :--- |
| **DEM (Digital Elevation Model)** | A 3D digital map where every pixel represents the exact vertical ground elevation above sea level. | Used from NASA SRTM & Copernicus datasets to know whether a zone is at 0.4m (extreme risk) or 24m (safe ridge). |
| **MSL (Mean Sea Level)** | The standard baseline reference plane representing average ocean height (0.0m). | All water surges, river stages, and land heights are measured relative to MSL (e.g. +2.5m MSL). |
| **Inundation Depth** | The height of standing water accumulated over normally dry ground, measured in meters. | Calculated by: `Water Surge Level - Ground DEM Altitude`. |
| **Binary Classification** | A machine learning task that predicts one of two outcomes (Yes/No, True/False). | Predicts whether flood water will breach coastal defenses: `is_flooded = True/False`. |
| **Regression Model** | A machine learning task that predicts a continuous numeric value rather than a category. | Predicts exact flood depth (e.g. `1.42m`) and time to flood onset (e.g. `45 minutes`). |
| **Antecedent Rainfall** | Rain that accumulated during the preceding 6 to 24 hours, soaking the ground before the storm peak. | When antecedent rain is high, soil saturation index reaches 1.0, causing 100% of new rain to turn into runoff. |
| **XAI (Explainable AI)** | Algorithmic techniques that quantify and explain the internal reasoning behind an AI prediction. | Breaks down the exact percentage share of risk: `42% High Tide, 31% Low Elevation, 18% Rain, 9% River`. |
| **MCDM (Multi-Criteria Decision Making)** | A mathematical framework to prioritize and rank alternatives across multiple competing factors. | Ranks which flooded ward gets emergency rescue boats first by weighing population, depth, and hospitals. |
| **SITREP (Situation Report)** | A standardized military and disaster response briefing summarizing active threats and directives. | Automatically generated for NDRF/SDRF commanders to coordinate evacuation logistics. |
| **Lead Time / Onset Time** | The time window between issuance of the early warning and the arrival of flood waters. | Provides authorities with an exact evacuation countdown (e.g. `onset in 45m, peak in 180m`). |

---

## 2. End-to-End AI System Architecture

The FloodShield AI backend pipeline processes raw environmental telemetry through four integrated AI/ML stages:

```mermaid
flowchart TD
    subgraph S1["1. Environmental & Terrain Ingestion"]
        A["Ocean Buoys (Tide Surge)"]
        B["Doppler Radar & Rain Gauges"]
        C["NASA SRTM DEM Ground Altitude"]
        D["Municipal Drainage & Soil Sensors"]
    end

    subgraph S2["2. Core ML Ensemble Predictor (ml_predictor.py)"]
        E["Feature Vector Assembly (9 Parameters)"]
        F["Binary Flood Classifier (Random Forest)"]
        G["Depth Regressor (Gradient Boosting)"]
        H["Onset & Peak Regressors (Gradient Boosting)"]
    end

    subgraph S3["3. Explainable AI Engine (xai_engine.py)"]
        I["Factor Attribution Mathematics"]
        J["Plain-Language Driver Summary"]
    end

    subgraph S4["4. Juve Multi-Criteria Prioritizer (decision_engine.py)"]
        K["Facility Exposure (Hospitals & Shelters)"]
        L["Road Network Vulnerability (Passable vs Submerged)"]
        M["Juve Priority Scoring Formula (0-100)"]
        N["Zone Evacuation Priority Ranking (#1, #2, #3)"]
    end

    subgraph S5["5. Laya Solver & Alert Dispatch (llm_service.py)"]
        O["Safe High-Ground Shelter Routing"]
        P["Automated 160-Char SMS Broadcast"]
        Q["Tactical SITREP Command Briefing"]
    end

    A --> E
    B --> E
    C --> E
    D --> E

    E --> F
    E --> G
    E --> H

    F & G & H --> I
    I --> J

    G & H --> K & L
    K & L --> M
    M --> N

    N --> O & P & Q
```

---

## 3. Detailed Component Breakdown

### 3.1. Tabular ML Flood Ensemble (`app/services/ml_predictor.py`)

The core predictive engine uses an ensemble of Scikit-Learn models trained on historical hydrodynamic flood simulations.

```mermaid
flowchart LR
    subgraph Inputs["9-Dimensional Feature Vector"]
        I1["Tide Level (m)"]
        I2["Rainfall Rate (mm/h)"]
        I3["Rain Accumulation 6h (mm)"]
        I4["Ground Elevation MSL (m)"]
        I5["Distance to Coast (km)"]
        I6["Distance to River (km)"]
        I7["Drainage Capacity (%)"]
        I8["Soil Saturation (0-1)"]
        I9["Cyclone Wind (km/h)"]
    end

    subgraph Models["ML Ensemble"]
        M1["Random Forest Classifier"]
        M2["Gradient Boosting Regressor (Depth)"]
        M3["Gradient Boosting Regressor (Onset)"]
        M4["Gradient Boosting Regressor (Peak)"]
    end

    subgraph Outputs["Inference Outputs"]
        O1["Flood Probability: 0.0 - 1.0"]
        O2["Projected Depth: 0.0m - 3.5m"]
        O3["Onset Time: 15m - 360m"]
        O4["Peak Time: 45m - 720m"]
        O5["Threat Level: CRITICAL / HIGH / MEDIUM / LOW"]
    end

    Inputs --> Models
    M1 --> O1
    M2 --> O2
    M3 --> O3
    M4 --> O4
    O1 & O2 --> O5
```

#### Feature Vector Definitions
1. `tide_level_m`: Astronomical tide and sea surge height above Mean Sea Level (MSL).
2. `rainfall_rate_mm_h`: Current precipitation rate.
3. `rainfall_accum_6h_mm`: Prior 6-hour cumulative rainfall causing catchment saturation.
4. `elevation_m`: Ground elevation extracted from NASA SRTM 30m Digital Elevation Model.
5. `dist_to_coast_km`: Geographic distance from the zone centroid to the open coastline.
6. `dist_to_river_km`: Proximity to the nearest river estuary or ingress channel.
7. `drainage_capacity_pct`: Efficiency rating of local municipal stormwater infrastructure (0% to 100%).
8. `soil_saturation_idx`: Soil water-retention fraction (0.0 = completely dry, 1.0 = fully saturated).
9. `cyclone_wind_kmh`: Sustained wind velocity forcing tidal surges inland.

---

### 3.2. Explainable AI Engine (`app/services/xai_engine.py`)

The XAI engine eliminates the "black box" problem by translating model weights into factor contributions and plain-English summaries.

```mermaid
flowchart TD
    subgraph Scoring["Risk Factor Scoring"]
        S1["Tide Contribution Score"]
        S2["Rainfall & Moisture Score"]
        S3["Ground Depression Score"]
        S4["Drainage Bottleneck Score"]
        S5["Estuary Backflow Score"]
    end

    subgraph Normalization["Percentage Normalization"]
        N1["Calculate Total Risk Sum"]
        N2["Compute Factor Contribution %"]
        N3["Sort Drivers Descending"]
    end

    subgraph Output["Explainable Deliverables"]
        D1["Top 4 Primary Drivers Array"]
        D2["Plain-English Natural Language Summary"]
    end

    Scoring --> Normalization --> Output
```

#### Example Output:
- **Primary Driver 1:** Astronomical & Surge High Tide (45.2%)
- **Primary Driver 2:** Low Terrain Ground Elevation (31.8%)
- **Primary Driver 3:** Stormwater Drainage Bottleneck (14.5%)
- **Plain-Language Text:**
  > *"Severe flood danger for Bengre Sand Spit (Peak Depth 1.45m). Driven primarily by Astronomical & Surge High Tide (45.2%) combined with Low Terrain Ground Elevation (31.8%), causing rapid water accumulation beyond local drainage capacity."*

---

### 3.3. Juve Multi-Criteria Decision Framework (`app/services/decision_engine.py`)

When multiple coastal sectors are flooded simultaneously, the Juve Decision Engine computes a composite urgency score to optimize emergency dispatch.

```mermaid
flowchart LR
    subgraph Criteria["Multi-Criteria Inputs"]
        C1["Severity Factor (Projected Depth) [Weight: 35%]"]
        C2["Population Exposure (Census Headcount) [Weight: 25%]"]
        C3["Critical Facility Threat (Hospitals At Risk) [Weight: 25%]"]
        C4["Time Urgency (Lead Time to Onset) [Weight: 15%]"]
    end

    subgraph Calculation["Juve Priority Engine"]
        F1["Priority Score = C1 + C2 + C3 + C4 (Range: 0.0 - 100.0)"]
    end

    subgraph Decision["Tactical Directives"]
        D1["Score >= 65: PRIORITY 1 (Deploy NDRF Rescue Boats & Evacuate Hospitals)"]
        D2["Score 35-64: PRIORITY 2 (Deploy High-Capacity De-Watering Pumps)"]
        D3["Score 15-34: PRIORITY 3 (Issue Public Advisory Bulletins)"]
        D4["Score < 15: ROUTINE (Normal Monitoring)"]
    end

    Criteria --> Calculation --> Decision
```

#### Mathematical Formulation:
$$\text{Priority Score} = \left(\min\left(1.0, \frac{\text{Depth}}{2.0}\right) \times 35\right) + \left(\min\left(1.0, \frac{\text{Population}}{40000}\right) \times 25\right) + \left(\min(1.0, \text{Hospitals} \times 0.5) \times 25\right) + \left(\max\left(0.0, 1.0 - \frac{\text{Onset Time}}{360}\right) \times 15\right)$$

---

### 3.4. Laya Evacuation Router & Alert Service (`app/services/llm_service.py` & `ai_decision.py`)

The Laya engine integrates infrastructure topology to plan evacuation paths and formulate warnings.

```mermaid
sequenceDiagram
    autonumber
    actor Commander as Emergency Command
    participant API as FastAPI Backend
    participant ML as ML Predictor
    participant Juve as Juve Engine
    participant Laya as Laya & LLM Service
    actor Public as Citizen Telecom (SMS)

    Commander->>API: Trigger Live Simulation (Tide=3.4m, Rain=95mm/h)
    API->>ML: Run 9-Feature Predictive Inference
    ML-->>API: Probability (0.92), Depth (1.45m), Onset (45m)
    API->>Juve: Evaluate Infrastructure Impact
    Juve-->>API: Submerged Roads, Threatened Hospitals, Priority Rank #1
    API->>Laya: Solve Evacuation Routes & Generate Alerts
    Laya-->>API: Passable Route to Kadri Shelter & 160-char SMS
    API-->>Public: Broadcast Emergency SMS Alert
    API-->>Commander: Deliver Official Situation Report (SITREP)
```

#### Deliverables:
1. **Infrastructure Status:** Identifies passable roads vs. submerged corridors (`depth_over_road_m`).
2. **Safe Shelter Allocation:** Matches displaced populations to certified shelters with ground altitude $> 10\text{m}$ MSL.
3. **160-Character Civic SMS Alert:**
   > *"EMERGENCY: Bengre Spit flood onset in 45m, peak in 180m. Avoid Bunder Wharf Rd. Move to Kadri Highland Shelter. Dial 112 for rescue."*
4. **Command SITREP Briefing:** Comprehensive operational document containing executive summary, affected census count, and tactical resource directives.

---

## 4. Summary Matrix of Backend Models

| Subsystem | Underlying Technology | Primary Function | Core Output |
| :--- | :--- | :--- | :--- |
| **Predictive Ensemble** | Random Forest + Gradient Boosting | Forecasts physical flood mechanics | Probability, Inundation Depth (m), Onset Time (min), Peak Time (min) |
| **XAI Engine** | Factor Attribution Analytics | Explains causation transparently | Factor Contribution % + Plain-Language Sentence |
| **Juve Engine** | Multi-Criteria Decision Framework | Ranks emergency rescue urgency | Composite Priority Score (0–100) & Zone Rank (#1, #2) |
| **Laya Solver** | Spatial Elevation & Cutoff Graph | Routes civilians away from submerged roads | Verified Passable Roads & High-Ground Shelter Selection |
| **LLM Alert Service** | Structured NLP & SITREP Formatter | Formats warnings for public & military | Civic SMS (<160 chars) & Formal SITREP Documents |
