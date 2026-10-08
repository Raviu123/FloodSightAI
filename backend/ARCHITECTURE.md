# FloodShield AI — Backend Architecture & System Design

This document provides a comprehensive overview of the **FloodShield AI** backend system architecture, data pipelines, Machine Learning engine, Explainable AI (XAI) modules, hybrid database layer (Supabase PostgreSQL + SQLite fallback), and REST API design.

---

## 1. High-Level Architecture Diagram

```
                                  ┌──────────────────────────────────────────────┐
                                  │            INPUT SIMULATION CLIENT           │
                                  │  (Tide, Rainfall, Wind, Saturation, Timeline)│
                                  └──────────────────────┬───────────────────────┘
                                                         │ HTTP POST /api/v1/simulation/run
                                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              FASTAPI APPLICATION SERVER (`app/`)                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                REST API ROUTING LAYER                                                  │
│   • /simulation (ML Simulation)  • /sitrep (NDRF Briefing)  • /decision (Juve Queue)  • /zones (GIS & Infrastructure)  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                  CORE AI & ML PIPELINE                                                 │
│                                                                                                                        │
│   ┌────────────────────────────────┐ ┌────────────────────────────────┐ ┌──────────────────────────────────────────┐   │
│   │     1. TABULAR ML PREDICTOR    │ │    2. EXPLAINABLE AI (XAI)     │ │    3. JUVE & LAYA DECISION ENGINE        │   │
│   │  • RandomForestClassifier      │ │  • Dynamic factor attribution  │ │  • Multi-Criteria Zone Prioritizer       │   │
│   │    (Flood Probability P ∈ [0,1]) │ • % Driver decomposition:      │ │  • Composite Urgency Score               │   │
│   │  • HistGradientBoosting Depth  │ │    - Rain rate & accumulation  │ │  • Submerged Road Classifier             │   │
│   │    (Depth in meters MSL)       │ │    - High astronomical tide    │ │  • Hospital Threat Flagging              │   │
│   │  • HistGradientBoosting Timing │ │    - Ground terrain elevation  │ │  • Automated SITREP Generator            │   │
│   │    (T_onset & T_peak in mins)  │ │  • Plain-English synthesis     │ │  • Civic SMS Alert Formatter             │   │
│   └────────────────────────────────┘ └────────────────────────────────┘ └──────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                              HYBRID DATA PERSISTENCE LAYER                                             │
│                                                                                                                        │
│            ┌───────────────────────────────────────────┐         ┌───────────────────────────────────────────┐         │
│            │       PRIMARY: SUPABASE POSTGRESQL        │         │          FALLBACK: LOCAL SQLITE           │         │
│            │   • `postgresql+asyncpg://...` (Async)    │   OR    │   • `sqlite:///./floodshield.db` (Sync)   │         │
│            │   • `postgresql://...` (Sync Session)     │         │   • Instant zero-crash offline execution  │         │
│            └───────────────────────────────────────────┘         └───────────────────────────────────────────┘         │
│                                                                                                                        │
│   Database Entities:                                                                                                   │
│   • `Zone` (Geometries, DEM elevation, drainage capacity, population)                                                 │
│   • `CriticalFacility` (Hospitals, high-ground shelters, power substations)                                           │
│   • `AffectedRoad` (Coastal highways, arterial link roads, elevation thresholds)                                       │
│   • `PredictionRecord` (Persisted simulation runs and telemetry logs)                                                  │
│   • `AlertRecord` (Issued civic SMS warnings and broadcast statuses)                                                   │
│   • `ConnectionTest` (Supabase connectivity verification)                                                              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory & Component Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── api.py                    # Master API router combining all sub-routers
│   │       └── endpoints/
│   │           ├── simulation.py         # POST /run & GET /quick-estimate (ML pipeline)
│   │           ├── sitrep.py             # POST /generate (Official NDRF disaster report)
│   │           ├── decision.py           # POST /priority-queue (Juve ranked response)
│   │           ├── zones.py              # GET / (List zones & infrastructure)
│   │           ├── alerts.py             # GET / & POST /broadcast (Emergency alerts)
│   │           ├── ai_assistant.py       # POST /query (Conversational AI copilot)
│   │           └── health.py             # GET / (Service & DB health verification)
│   ├── core/
│   │   ├── config.py                     # Pydantic BaseSettings (DB URLs, API Keys, CORS)
│   │   └── database.py                   # Re-exports unified DB session from app.db
│   ├── db/
│   │   ├── __init__.py                   # Unified exports (Base, get_db, get_async_db, models)
│   │   ├── base.py                       # SQLAlchemy 2.0 DeclarativeBase
│   │   ├── session.py                    # Hybrid engine (Supabase Postgres + SQLite failover)
│   │   └── models/
│   │       ├── __init__.py               # Master models export
│   │       ├── zone.py                   # Zone, CriticalFacility, AffectedRoad ORM models
│   │       ├── prediction.py             # PredictionRecord ORM model
│   │       ├── alert.py                  # AlertRecord ORM model
│   │       └── connection_test.py        # Supabase connection verification model
│   ├── ml/
│   │   ├── flood_models.joblib           # Trained serialized Scikit-Learn model package (3.0 MB)
│   │   └── metrics.json                  # Model validation performance benchmarks
│   ├── schemas/                          # Pydantic v2 validation contracts
│   │   ├── simulation.py                 # SimulationInput, EnhancedZoneResult, SimulationResponse
│   │   ├── zone.py                       # CoastalZone, CriticalFacility, ZoneDetailResponse
│   │   ├── alert.py                      # EmergencyAlert, BroadcastRequest, BroadcastResponse
│   │   └── chat.py                       # ChatRequest, ChatResponse, ChatMessage
│   └── services/
│       ├── flood_engine.py               # Master orchestration service
│       ├── ml_predictor.py               # Real-time ML vector inference (< 3ms latency)
│       ├── xai_engine.py                 # Feature attribution & plain-English driver synthesis
│       ├── decision_engine.py            # Juve multi-criteria prioritizer & road impact evaluator
│       └── llm_service.py                # SITREP emergency briefings & civic SMS generator
├── data/
│   └── coastal_flood_training_data.csv   # Physics-informed synthetic dataset (6,000 scenarios)
├── docs/                                 # Detailed module specifications & API documentation
│   ├── README.md
│   ├── ML_PIPELINE.md
│   ├── XAI_AND_DECISION_ENGINE.md
│   ├── DATABASE_AND_SEEDING.md
│   └── API_REFERENCE.md
├── scripts/
│   ├── generate_synthetic_data.py        # Physics hydrodynamic coastal data synthesizer
│   ├── train_models.py                   # Model training and metrics serialization pipeline
│   └── seed_db.py                        # Database initialization & Indian coastal seed data
├── requirements.txt                      # Production backend dependencies
└── run.py                                # Application entrypoint (Uvicorn launcher)
```

---

## 3. The 4 Core AI & Computational Pillars

### Pillar 1: Tabular Predictive ML Engine (`app/services/ml_predictor.py`)
Predicts: **Where, when, and how severely will flooding hit?**
- **Feature Vector**: 9 continuous environmental and geospatial attributes:
  `[tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm, elevation_m, dist_to_coast_km, dist_to_river_km, drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh]`
- **Models Used**:
  - `RandomForestClassifier`: Predicts Flood Probability ($P(\text{Flood}) \in [0.0, 1.0]$).
  - `HistGradientBoostingRegressor` (Depth): Predicts maximum water depth ($m$) above ground.
  - `HistGradientBoostingRegressor` (Onset): Predicts minutes until critical water threshold ($>0.3\text{m}$).
  - `HistGradientBoostingRegressor` (Peak): Predicts minutes until maximum storm surge crest.
- **Validation Metrics**:
  - `AUC-ROC`: **`0.9952`**
  - `Accuracy`: **`97.17%`**
  - `Inundation Depth MAE`: **`0.024 m`** ($2.4\text{ cm}$)
  - `Onset Time MAE`: **`6.43 mins`**
  - `Peak Time MAE`: **`10.99 mins`**

### Pillar 2: Explainable AI (XAI) Engine (`app/services/xai_engine.py`)
Answers: **Why does the AI believe what it believes?**
- Normalizes physical contribution scores into percentage drivers per zone:
  - High Astronomical Tide ($\%$)
  - Torrential Rain Intensity ($\%$)
  - Low Terrain Elevation ($\%$)
  - Estuary Confluence Backflow ($\%$)
  - Soil Saturation ($\%$)
- Automatically compiles human-readable summaries for non-technical incident commanders.

### Pillar 3: Juve Multi-Criteria Decision Framework (`app/services/decision_engine.py`)
Answers: **Which zones and facilities need emergency response first?**
- Computes composite evacuation urgency score:
  $$\text{Priority Score} = w_{\text{depth}} \cdot \text{Depth} + w_{\text{pop}} \cdot \text{Population} + w_{\text{hosp}} \cdot \text{Hospitals Threatened} + w_{\text{time}} \cdot \text{Onset Speed}$$
- Detects submerged vs passable road corridors (e.g., NH-66).
- Flags critical healthcare infrastructure at risk vs designated high-elevation safe shelters.

### Pillar 4: Automated SITREP & SMS Generator (`app/services/llm_service.py`)
Answers: **What is the actionable tactical briefing?**
- Auto-generates formal Situation Reports (SITREP) formatted for NDRF / District Disaster Management Authorities.
- Formats cell-broadcast SMS alerts citing the exact inundated road to avoid and safe shelter to evacuate to.

---

## 4. Hybrid Database & Persistence Layer

Implemented in [`backend/app/db/session.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/db/session.py):

| Mode | Database | Driver / URL | Use Case |
|---|---|---|---|
| **Production / Cloud** | **Supabase PostgreSQL** | `postgresql+asyncpg://` & `postgresql://` | Full persistence, multi-user concurrency, cloud deployment |
| **Offline / Local Dev** | **SQLite** | `sqlite:///./floodshield.db` | Zero-configuration fallback, testing, offline demonstrations |

- **Automatic Failover**: If `DATABASE_URL` is missing or the remote Postgres server is unreachable, the backend logs a notice and switches to SQLite without failing.

---

## 5. API Endpoints Map

| Endpoint | Method | Tag | Description |
|---|:---:|---|---|
| `/api/v1/simulation/run` | `POST` | AI Simulation | Executes complete ML prediction, XAI driver attribution, and infrastructure impact analysis. |
| `/api/v1/simulation/quick-estimate` | `GET` | AI Simulation | Fast query-parameter endpoint for rapid scenario estimation. |
| `/api/v1/sitrep/generate` | `POST` | SITREP Briefing | Generates an official NDRF Situation Report. |
| `/api/v1/decision/priority-queue` | `POST` | Juve Decision | Returns the mathematically ranked emergency dispatch queue. |
| `/api/v1/zones` | `GET` | Coastal Zones | Lists all monitored coastal zones with hospitals, shelters, and roads. |
| `/api/v1/zones/{zone_id}` | `GET` | Coastal Zones | Returns detailed GIS profile for a single zone. |
| `/api/v1/alerts` | `GET` | Alerts | Returns active civic flood alerts. |
| `/api/v1/alerts/broadcast` | `POST` | Alerts | Simulates cellular SMS alert dispatch. |
| `/api/v1/health` | `GET` | Health | Health and database status check. |

---

## 6. How to Run and Verify

1. **Seed the Database**:
   ```powershell
   backend\.venv\Scripts\python.exe backend/scripts/seed_db.py
   ```

2. **Start the Backend Server**:
   ```powershell
   backend\.venv\Scripts\python.exe backend/run.py
   ```

3. **Open Interactive Swagger Documentation**:
   - URL: `http://127.0.0.1:8000/docs`
