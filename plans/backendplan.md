# FloodShield AI — Backend Architecture & System Design (v2)

**Project:** Singularity 2026 Hackathon — Track 1: AI for Coastal Flood Intelligence
**Stack:** FastAPI (Python) + Scikit-Learn + Chroma (RAG) + Supabase PostgreSQL / SQLite fallback
**Frontend:** Next.js + MapLibre GL JS (consumes FastAPI directly — no Next.js API routes)
**Target Region:** India (Coastal Cities)

---

## 0. What Changed in v2

This version incorporates everything discussed in the planning conversation:

- ✅ **RAG layer fully specified** (vector store, embeddings, ingestion, retriever, guardrails, feedback loop)
- ✅ **Geospatial zone generation pipeline** (DEM → AHP → FSI → Jenks → GeoJSON)
- ✅ **Data sources & mocking strategy** with explicit `source` flags
- ✅ **Simulation engine internals** (sliders → time-series → WebSocket push)
- ✅ **Map / GeoJSON contract** for MapLibre
- ✅ **Tide + weather API integration** (Open-Meteo, INCOIS, IMD)
- ✅ **Earthquake / tsunami scenario inputs**
- ✅ **FastAPI-only** (no Next.js API routes anywhere)
- ✅ **Testing & validation strategy**

---

## 1. High-Level Architecture Diagram

```
                                  ┌──────────────────────────────────────────────┐
                                  │         NEXT.JS FRONTEND (Client)            │
                                  │  MapLibre GL + React-Map-GL + Chat Panel     │
                                  │  Simulation Sliders + Alert Dashboard        │
                                  └──────────────────────┬───────────────────────┘
                                                         │ REST + WebSocket
                                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              FASTAPI APPLICATION SERVER (`app/`)                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                REST API ROUTING LAYER                                                  │
│   • /simulation  • /sitrep  • /decision  • /zones  • /alerts  • /ai_assistant  • /geo  • /health                      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                  CORE AI & ML PIPELINE                                                 │
│                                                                                                                        │
│   ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────────┐  │
│   │  1. TABULAR ML ENGINE  │ │  2. XAI ENGINE         │ │  3. JUVE DECISION      │ │  4. RAG / LLM ASSISTANT      │  │
│   │  • RandomForest (P)    │ │  • Feature attribution │ │  • Multi-criteria      │ │  • Vector store (Chroma)     │  │
│   │  • HistGBR (Depth)     │ │  • % driver breakdown  │ │    priority score      │ │  • Embeddings (MiniLM)       │  │
│   │  • HistGBR (Onset)     │ │  • Plain-English       │ │  • Road impact         │ │  • Retriever + reranker      │  │
│   │  • HistGBR (Peak)      │ │    synthesis           │ │  • Hospital threat     │ │  • Guardrails + citations    │  │
│   │                        │ │                        │ │  • SITREP generator    │ │  • Feedback loop             │  │
│   └────────────────────────┘ └────────────────────────┘ └────────────────────────┘ └──────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                          GEOSPATIAL & SIMULATION LAYER                                                │
│                                                                                                                        │
│   ┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────────┐  │
│   │  ZONE GENERATION       │ │  SIMULATION ENGINE     │ │  WEATHER / TIDE APIs   │ │  SEISMIC SCENARIO            │  │
│   │  • DEM preprocessing   │ │  • Slider → features   │ │  • Open-Meteo (real)   │ │  • Earthquake (mag, epi)     │  │
│   │  • AHP weights         │ │  • Time-series predict │ │  • INCOIS (mock)       │ │  • Tsunami (wave, ETA)       │  │
│   │  • FSI + Jenks         │ │  • WebSocket stream    │ │  • IMD (mock)          │ │  • Amplification model       │  │
│   │  • GeoJSON export      │ │  • Mock fallback       │ │  • Mock JSON fallback  │ │                              │  │
│   └────────────────────────┘ └────────────────────────┘ └────────────────────────┘ └──────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                              HYBRID DATA PERSISTENCE LAYER                                             │
│                                                                                                                        │
│            ┌───────────────────────────────────────────┐         ┌───────────────────────────────────────────┐         │
│            │       PRIMARY: SUPABASE POSTGRESQL        │         │          FALLBACK: LOCAL SQLITE           │         │
│            │   • `postgresql+asyncpg://...` (Async)    │   OR    │   • `sqlite:///./floodshield.db` (Sync)   │         │
│            │   • `postgresql://...` (Sync Session)     │         │   • Zero-config offline execution         │         │
│            └───────────────────────────────────────────┘         └───────────────────────────────────────────┘         │
│                                                                                                                        │
│   Database Entities:                                                                                                   │
│   • `Zone` (Geometries, DEM elevation, drainage capacity, population, FSI score)                                      │
│   • `CriticalFacility` (Hospitals, high-ground shelters, power substations)                                           │
│   • `AffectedRoad` (Coastal highways, arterial link roads, elevation thresholds)                                       │
│   • `PredictionRecord` (Persisted simulation runs and telemetry logs)                                                  │
│   • `AlertRecord` (Issued civic SMS warnings and broadcast statuses)                                                   │
│   • `RAGDocument` (Vector store metadata — chunk id, source, embedding ref)                                            │
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
│   │       ├── api.py                    # Master router combining all sub-routers
│   │       └── endpoints/
│   │           ├── simulation.py         # POST /run, GET /quick-estimate, WS /stream
│   │           ├── sitrep.py             # POST /generate
│   │           ├── decision.py           # POST /priority-queue
│   │           ├── zones.py              # GET /, GET /{zone_id}, GET /geojson
│   │           ├── alerts.py             # GET /, POST /broadcast
│   │           ├── ai_assistant.py       # POST /query (RAG), POST /feedback
│   │           ├── geo.py                # GET /layers, GET /facilities, GET /roads
│   │           ├── scenario.py           # POST /earthquake, POST /tsunami
│   │           └── health.py             # GET / (service + DB + RAG status)
│   │
│   ├── core/
│   │   ├── config.py                     # Pydantic BaseSettings (DB URLs, API keys, CORS, feature flags)
│   │   ├── logging.py                    # Structured logging setup
│   │   └── database.py                   # Re-exports unified DB session
│   │
│   ├── db/
│   │   ├── __init__.py                   # Unified exports (Base, get_db, get_async_db, models)
│   │   ├── base.py                       # SQLAlchemy 2.0 DeclarativeBase
│   │   ├── session.py                    # Hybrid engine (Supabase Postgres + SQLite failover)
│   │   └── models/
│   │       ├── __init__.py
│   │       ├── zone.py                   # Zone, CriticalFacility, AffectedRoad
│   │       ├── prediction.py             # PredictionRecord
│   │       ├── alert.py                  # AlertRecord
│   │       ├── rag_document.py           # RAGDocument metadata
│   │       └── connection_test.py        # Supabase connection verification
│   │
│   ├── ml/
│   │   ├── flood_models.joblib           # Serialized Scikit-Learn model package
│   │   └── metrics.json                  # Validation benchmarks
│   │
│   ├── schemas/                          # Pydantic v2 contracts
│   │   ├── simulation.py                 # SimulationInput, ZoneResult, SimulationResponse
│   │   ├── zone.py                       # CoastalZone, Facility, Road, ZoneDetailResponse
│   │   ├── alert.py                      # EmergencyAlert, BroadcastRequest/Response
│   │   ├── chat.py                       # ChatRequest, ChatResponse, Source, MapAction
│   │   ├── scenario.py                   # EarthquakeInput, TsunamiInput
│   │   └── geo.py                        # LayerInfo, GeoJSONResponse
│   │
│   ├── services/
│   │   ├── flood_engine.py               # Master orchestration
│   │   ├── ml_predictor.py               # ML inference
│   │   ├── xai_engine.py                 # Feature attribution + plain-English synthesis
│   │   ├── decision_engine.py            # Juve multi-criteria prioritizer
│   │   ├── llm_service.py                # SITREP + SMS generation
│   │   ├── simulation_engine.py          # Slider → time-series → WebSocket
│   │   ├── weather_service.py            # Open-Meteo + INCOIS + IMD integration
│   │   ├── seismic_service.py            # Earthquake + tsunami impact model
│   │   ├── geo_service.py                # Zone GeoJSON, tile URLs, facility queries
│   │   └── alert_service.py              # Alert generation + broadcast (mock/real)
│   │
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── vector_store.py               # Chroma wrapper (or pgvector)
│   │   ├── embeddings.py                 # sentence-transformers wrapper
│   │   ├── chunker.py                    # 200-token chunking
│   │   ├── ingest.py                     # Load zones/facilities/predictions into vector store
│   │   ├── retriever.py                  # Top-k similarity + metadata filter
│   │   ├── prompt_builder.py             # System prompt + few-shot + context
│   │   ├── guardrails.py                 # Off-topic rejection, citation enforcement
│   │   └── feedback.py                   # Thumbs up/down logging
│   │
│   └── utils/
│       ├── geo.py                        # Haversine, bbox, polygon helpers
│       └── physics.py                    # Storm surge, tsunami amplification formulas
│
├── data/
│   ├── raw/                              # Downloaded DEM, OSM, WorldPop, etc.
│   ├── processed/                        # slope.tif, twi.tif, zones.geojson
│   ├── mock/                             # weather_<city>.json, tide_<city>.json
│   └── coastal_flood_training_data.csv   # Physics-informed synthetic dataset (6,000 scenarios)
│
├── docs/
│   ├── README.md
│   ├── ML_PIPELINE.md
│   ├── XAI_AND_DECISION_ENGINE.md
│   ├── RAG_ARCHITECTURE.md
│   ├── GEOSPATIAL_PIPELINE.md
│   ├── DATA_SOURCES_AND_MOCKING.md
│   ├── SIMULATION_ENGINE.md
│   ├── MAP_CONTRACT.md
│   ├── DATABASE_AND_SEEDING.md
│   └── API_REFERENCE.md
│
├── scripts/
│   ├── download_data.py                  # Fetch DEM, OSM, WorldPop, LULC
│   ├── preprocess_dem.py                 # Slope, flow accumulation, TWI
│   ├── build_zones.py                    # AHP + FSI + Jenks → zones.geojson
│   ├── generate_synthetic_data.py        # Physics hydrodynamic synthesizer
│   ├── train_models.py                   # Train + serialize ML models
│   ├── seed_db.py                        # Initialize DB with Indian coastal zones
│   ├── seed_rag.py                       # Ingest zones/facilities into vector store
│   └── rag_cli.py                        # CLI: ingest, query, stats, rebuild
│
├── tests/
│   ├── test_ml_predictor.py
│   ├── test_xai_engine.py
│   ├── test_decision_engine.py
│   ├── test_rag.py
│   ├── test_simulation.py
│   └── test_api.py
│
├── requirements.txt
├── .env.example
├── docker-compose.yml
└── run.py                                # Uvicorn launcher
```

---

## 3. The 4 Core AI & Computational Pillars

### Pillar 1: Tabular Predictive ML Engine (`app/services/ml_predictor.py`)

**Answers:** *Where, when, and how severely will flooding hit?*

- **Feature Vector (9 attributes):**
  `[tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm, elevation_m, dist_to_coast_km, dist_to_river_km, drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh]`
- **Models:**
  - `RandomForestClassifier` → Flood Probability $P \in [0,1]$
  - `HistGradientBoostingRegressor` → Depth (m)
  - `HistGradientBoostingRegressor` → Onset time (mins)
  - `HistGradientBoostingRegressor` → Peak time (mins)
- **Validation Metrics:**
  - AUC-ROC: **0.9952**
  - Accuracy: **97.17%**
  - Depth MAE: **0.024 m**
  - Onset MAE: **6.43 mins**
  - Peak MAE: **10.99 mins**

### Pillar 2: Explainable AI (XAI) Engine (`app/services/xai_engine.py`)

**Answers:** *Why does the AI believe what it believes?*

- Normalizes physical contributions into percentage drivers per zone:
  - High Astronomical Tide (%)
  - Torrential Rain Intensity (%)
  - Low Terrain Elevation (%)
  - Estuary Confluence Backflow (%)
  - Soil Saturation (%)
- Compiles plain-English summaries for non-technical incident commanders.

### Pillar 3: Juve Multi-Criteria Decision Framework (`app/services/decision_engine.py`)

**Answers:** *Which zones and facilities need emergency response first?*

$$\text{Priority Score} = w_d \cdot \text{Depth} + w_p \cdot \text{Population} + w_h \cdot \text{Hospitals Threatened} + w_t \cdot \text{Onset Speed}$$

- Detects submerged vs passable road corridors (e.g., NH-66).
- Flags critical healthcare infrastructure at risk vs designated high-elevation safe shelters.

### Pillar 4: RAG / LLM Assistant (`app/rag/` + `app/services/llm_service.py`)

**Answers:** *What is the actionable tactical briefing, and what does the user want to know?*

Two distinct responsibilities:

1. **SITREP + SMS generation** (`llm_service.py`) — templated, deterministic, with LLM polish.
2. **Conversational RAG** (`app/rag/`) — user-facing chat that answers questions about zones, predictions, facilities, and recommendations.

---

## 4. RAG & Conversational AI Layer (`app/rag/`)

### 4.1 Architecture

```
User Query
    │
    ▼
┌──────────────────┐
│ Query Embedder   │  sentence-transformers/all-MiniLM-L6-v2
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Vector Store     │  Chroma (local) or pgvector (Supabase)
│ + Metadata filter│  { city, risk_level, zone_id, type }
└────────┬─────────┘
         │ top-k (k=5)
         ▼
┌──────────────────┐
│ Reranker         │  Cross-encoder (optional)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Prompt Builder   │  System prompt + retrieved context + user query
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ LLM              │  Ollama (Llama 3 8B) or GPT-4o-mini
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Response Parser  │  Extract citations + map_actions
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Guardrails       │  Off-topic rejection, citation enforcement
└──────────────────┘
```

### 4.2 Vector Store Schema

```python
{
  "id": "zone-CHN-B-042",
  "text": "Zone CHN-B-042 in Chennai has High flood risk. Elevation 3.2m, population 12,400, near Cooum river. Drivers: low elevation, high tide, poor drainage.",
  "metadata": {
    "type": "zone",           # zone | facility | road | prediction | sitrep
    "city": "chennai",
    "risk_level": "High",
    "zone_id": "CHN-B-042",
    "source": "computed"
  },
  "embedding": [0.12, -0.34, ...]
}
```

### 4.3 Ingestion Pipeline (`app/rag/ingest.py`)

- Load `Zone`, `CriticalFacility`, `AffectedRoad` from DB.
- Convert each row into a natural-language paragraph.
- Chunk into 200-token segments.
- Embed with MiniLM.
- Upsert into Chroma with metadata.
- Run via `python scripts/seed_rag.py` or `python scripts/rag_cli.py ingest --city chennai`.

### 4.4 Retriever (`app/rag/retriever.py`)

- Top-k similarity search (k=5).
- Metadata filter: `city`, `risk_level`, `zone_id`, `type`.
- Optional cross-encoder reranking.

### 4.5 Prompt Builder (`app/rag/prompt_builder.py`)

```
SYSTEM:
You are FloodShield AI, an emergency response copilot for Indian coastal cities.
Answer using ONLY the provided context. Always cite sources as [Zone ID] or [Facility ID].
If the answer is not in the context, say "I don't have that information."
Never invent flood depths, times, or facility names.

CONTEXT:
{retrieved_chunks}

USER:
{query}
```

### 4.6 Guardrails (`app/rag/guardrails.py`)

- Reject off-topic queries (weather trivia, politics, etc.).
- Enforce citation of at least one source.
- Reject answers with no context match.
- Log all rejections for review.

### 4.7 Feedback Loop (`app/rag/feedback.py`)

- Endpoint: `POST /api/v1/ai_assistant/feedback`
- Payload: `{ conversation_id, message_id, rating: "up" | "down", comment? }`
- Stored in DB for future fine-tuning.

### 4.8 Internal RAG CLI (`scripts/rag_cli.py`)

```bash
python scripts/rag_cli.py ingest --city chennai
python scripts/rag_cli.py query "Which zones are at highest risk?"
python scripts/rag_cli.py stats
python scripts/rag_cli.py rebuild
python scripts/rag_cli.py eval --queries tests/rag_queries.json
```

### 4.9 LLM Provider Options

| Provider | Pros | Cons | Use |
|---|---|---|---|
| **Ollama + Llama 3 8B** | Free, local, private | Needs ~8GB RAM | ✅ Default |
| **GPT-4o-mini** | Fast, cheap, reliable | API key, cost | Backup |
| **Gemini 1.5 Flash** | Free tier | API key | Backup |

Controlled by `LLM_PROVIDER` env var.

---

## 5. Geospatial Zone Generation Pipeline

### 5.1 Purpose

Produce the **danger zone GeoJSON** that MapLibre draws on the map.

### 5.2 Data Sources

| Layer | Source | Resolution |
|---|---|---|
| DEM | FABDEM / SRTM | 30 m |
| Land use | ESA WorldCover | 10 m |
| Population | WorldPop | 100 m |
| Rivers | OSM / India-WRIS | Vector |
| Rainfall | IMD / CHRS | 0.25° |

### 5.3 Preprocessing (`scripts/preprocess_dem.py`)

- Load DEM → compute:
  - **Slope** (gradient)
  - **Flow accumulation** (D8, `pysheds`)
  - **TWI** = ln(a / tanβ)
  - **Distance to river** (Euclidean)
  - **Distance to coast**
- Save all as GeoTIFF in `data/processed/`.

### 5.4 AHP Weighted Overlay (`scripts/build_zones.py`)

Weights (from Indian coastal literature):

| Factor | Weight | Direction |
|---|---|---|
| Elevation | 0.30 | Lower = higher risk |
| Slope | 0.20 | Flatter = higher risk |
| Rainfall | 0.20 | Higher = higher risk |
| Distance to river | 0.20 | Closer = higher risk |
| Land use | 0.10 | Built-up = higher risk |

Compute **Flood Susceptibility Index (FSI)** per pixel.

### 5.5 Classification & Vectorization

- **Jenks natural breaks** → 4 classes: None, Low, Medium, High
- Vectorize with `rasterio.features.shapes`
- Export to `data/processed/zones.geojson`
- Enrich each feature with:
  - Population (from WorldPop)
  - Nearest facilities (from OSM)
  - Drivers (top-3 factors by contribution)
  - `source: "computed"`

### 5.6 Seeding

`scripts/seed_db.py` loads `zones.geojson` into the `Zone` table.

---

## 6. Data Sources & Mocking Strategy

**Rule:** Every API response includes a `source` field with one of: `real`, `derived`, `mock`.

| Data | Source | Type | Notes |
|---|---|---|---|
| Elevation | FABDEM / SRTM | Real | Downloaded once |
| Slope | Derived from DEM | Derived | Preprocessed |
| Rainfall (historical) | Open-Meteo Archive | Real | 1940–present |
| Rainfall (forecast) | Open-Meteo Forecast | Real | 16 days |
| Tide | Open-Meteo Marine | Real | Hourly sea level |
| Tide (gauge) | INCOIS | Mock | Access request pending |
| Storm surge | Physics formula | Derived | CEM formula |
| Land use | ESA WorldCover | Real | 10 m |
| Population | WorldPop | Real | 100 m |
| Admin boundaries | DataMeet India | Real | GeoJSON |
| Roads / buildings | OSM (Geofabrik) | Real | PBF → GeoJSON |
| Critical facilities | OSM Overpass | Real | Hospitals, shelters |
| Satellite imagery | Sentinel-1 SAR | Mock | Pre-downloaded samples |
| Earthquake | Manual scenario | Mock | User-controlled |
| Tsunami | Manual scenario | Mock | User-controlled |
| SMS delivery | Simulated | Mock | Log + in-app notification |

**Mock files live in `data/mock/`** and are used when:
- The live API is unreachable.
- `USE_MOCK_DATA=true` in `.env`.
- The demo needs deterministic output.

---

## 7. Simulation Engine (`app/services/simulation_engine.py`)

### 7.1 Input (Sliders)

```json
{
  "city": "chennai",
  "params": {
    "rainfall_multiplier": 1.8,
    "tide_offset_m": 0.5,
    "surge_m": 0.3,
    "wind_kmh": 65,
    "soil_saturation_idx": 0.7,
    "duration_hr": 12,
    "start_time": "2026-01-15T12:00:00Z",
    "earthquake": null,
    "tsunami": null
  }
}
```

### 7.2 Pipeline

1. Fetch baseline weather/tide from Open-Meteo Archive (or mock JSON).
2. Apply multipliers/offsets from user input.
3. For each timestep (hourly) and each zone:
   - Build 9-feature vector.
   - Run ML predictor → probability, depth, onset, peak.
4. Aggregate into timeline array.
5. Push real-time updates via **WebSocket** `/api/v1/simulation/stream`.
6. Trigger alerts when depth exceeds threshold.

### 7.3 Response

```json
{
  "timeline": [
    { "t": "...", "zones": { "CHN-B-042": { "depth": 0.2, "risk": "Low" } } },
    { "t": "...", "zones": { "CHN-B-042": { "depth": 0.8, "risk": "High" } } }
  ],
  "peak": { "t": "...", "max_depth": 1.4 },
  "alerts_triggered": ["CHN-B-042", "CHN-B-045"],
  "source": "simulation"
}
```

---

## 8. Seismic & Tsunami Scenario Inputs

### 8.1 Earthquake (`POST /api/v1/scenario/earthquake`)

```json
{
  "magnitude": 7.2,
  "epicenter": { "lat": 13.1, "lng": 80.3 },
  "depth_km": 15,
  "city": "chennai"
}
```

Impact model: simplified amplification factor on coastal zones based on distance from epicenter and local soil type. Clearly labeled `source: "mock"`.

### 8.2 Tsunami (`POST /api/v1/scenario/tsunami`)

```json
{
  "wave_height_m": 4.5,
  "arrival_time": "2026-01-15T14:00:00Z",
  "direction_deg": 270,
  "city": "chennai"
}
```

Impact model: wave height + arrival time + direction → surge overlay on top of existing tide/rain predictions.

---

## 9. Weather & Tide API Integration (`app/services/weather_service.py`)

| API | Endpoint | Purpose |
|---|---|---|
| **Open-Meteo Forecast** | `api.open-meteo.com/v1/forecast` | 16-day forecast |
| **Open-Meteo Archive** | `archive-api.open-meteo.com/v1/archive` | Historical baseline |
| **Open-Meteo Marine** | `marine-api.open-meteo.com/v1/marine` | Sea level, waves |
| **INCOIS** | TBD (access request) | Real tide gauge |
| **IMD** | TBD (registration) | Official rainfall |

**Fallback chain:** Live API → cached response → `data/mock/weather_<city>.json`.

---

## 10. Map / GeoJSON Contract

### 10.1 Zone GeoJSON (`GET /api/v1/zones/geojson?city=chennai`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "zone_id": "CHN-B-042",
        "risk_level": "High",
        "fsi_score": 0.82,
        "elevation_m": 3.2,
        "population": 12400,
        "drivers": ["low_elevation", "near_river", "high_tide"],
        "source": "computed"
      },
      "geometry": { "type": "Polygon", "coordinates": [...] }
    }
  ],
  "metadata": {
    "city": "chennai",
    "generated_at": "...",
    "model_version": "fsi-v1.2"
  }
}
```

### 10.2 Other Layers

| Endpoint | Returns |
|---|---|
| `GET /api/v1/geo/layers/satellite` | Tile URL template |
| `GET /api/v1/geo/layers/terrain` | Raster-DEM tile URL |
| `GET /api/v1/geo/facilities?city=` | GeoJSON Points |
| `GET /api/v1/geo/roads?city=&risk=high` | GeoJSON Lines |

### 10.3 MapLibre Consumption

Frontend uses `<Source>` + `<Layer>` to render zones, color by `risk_level`, and toggle modes.

---

## 11. Hybrid Database & Persistence Layer

Implemented in `app/db/session.py`:

| Mode | Database | Driver / URL | Use Case |
|---|---|---|---|
| **Production** | Supabase PostgreSQL | `postgresql+asyncpg://` & `postgresql://` | Cloud, multi-user |
| **Offline** | SQLite | `sqlite:///./floodshield.db` | Zero-config demo |

- **Automatic failover:** If `DATABASE_URL` missing or unreachable → log notice → switch to SQLite.

### Entities

- `Zone` — geometry, elevation, drainage, population, FSI
- `CriticalFacility` — hospitals, shelters, substations
- `AffectedRoad` — highways, link roads, elevation thresholds
- `PredictionRecord` — simulation runs
- `AlertRecord` — issued SMS warnings
- `RAGDocument` — vector store metadata
- `ConnectionTest` — Supabase health

---

## 12. API Endpoints Map

| Endpoint | Method | Tag | Description |
|---|:---:|---|---|
| `/api/v1/simulation/run` | POST | Simulation | Full ML + XAI + infra impact |
| `/api/v1/simulation/quick-estimate` | GET | Simulation | Fast scenario estimate |
| `/api/v1/simulation/stream` | WS | Simulation | Real-time updates |
| `/api/v1/sitrep/generate` | POST | SITREP | NDRF situation report |
| `/api/v1/decision/priority-queue` | POST | Decision | Juve ranked queue |
| `/api/v1/zones` | GET | Zones | List zones |
| `/api/v1/zones/{zone_id}` | GET | Zones | Zone detail |
| `/api/v1/zones/geojson` | GET | Zones | GeoJSON for MapLibre |
| `/api/v1/geo/layers/{name}` | GET | Geo | Tile URL for a layer |
| `/api/v1/geo/facilities` | GET | Geo | Facilities GeoJSON |
| `/api/v1/geo/roads` | GET | Geo | Roads GeoJSON |
| `/api/v1/alerts` | GET | Alerts | Active alerts |
| `/api/v1/alerts/broadcast` | POST | Alerts | Simulate SMS dispatch |
| `/api/v1/ai_assistant/query` | POST | AI Assistant | RAG chat |
| `/api/v1/ai_assistant/feedback` | POST | AI Assistant | Thumbs up/down |
| `/api/v1/scenario/earthquake` | POST | Scenario | Earthquake input |
| `/api/v1/scenario/tsunami` | POST | Scenario | Tsunami input |
| `/api/v1/health` | GET | Health | Service + DB + RAG status |

---

## 13. Testing & Validation Strategy

| Test | Method | Target |
|---|---|---|
| Zone accuracy | Compare with Bhuvan flood extent | IoU > 0.6 |
| Depth prediction | 80/20 split | MAE < 0.05 m |
| Onset time | 80/20 split | MAE < 10 mins |
| RAG relevance | 20 hand-labeled queries | > 80% correct |
| RAG hallucination | Manual review | 0 fabricated facts |
| API latency | Load test | p95 < 500 ms |
| Simulation FPS | Frontend | > 30 fps with 100 zones |
| DB failover | Kill Supabase, verify SQLite | No crash |

Tests live in `tests/` and run via `pytest`.

---

## 14. Environment Variables (`.env.example`)

```bash
# APIs
OPEN_METEO_BASE=https://api.open-meteo.com/v1
OPEN_METEO_ARCHIVE=https://archive-api.open-meteo.com/v1
OPEN_METEO_MARINE=https://marine-api.open-meteo.com/v1

# LLM
LLM_PROVIDER=ollama          # ollama | openai | gemini
OLLAMA_BASE=http://localhost:11434
OLLAMA_MODEL=llama3:8b
OPENAI_API_KEY=
GEMINI_API_KEY=

# RAG
CHROMA_PATH=./rag/vector_store
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
RAG_TOP_K=5

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres
FALLBACK_SQLITE_URL=sqlite:///./floodshield.db

# Feature Flags
USE_MOCK_DATA=true
ENABLE_SMS=false
ENABLE_EARTHQUAKE=true
ENABLE_TSUNAMI=true

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 15. How to Run and Verify

1. **Install dependencies:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate       # Windows
   pip install -r requirements.txt
   ```

2. **Download + preprocess data:**
   ```bash
   python scripts/download_data.py --city chennai
   python scripts/preprocess_dem.py --city chennai
   python scripts/build_zones.py --city chennai
   ```

3. **Train ML models:**
   ```bash
   python scripts/generate_synthetic_data.py
   python scripts/train_models.py
   ```

4. **Seed DB + RAG:**
   ```bash
   python scripts/seed_db.py
   python scripts/seed_rag.py
   ```

5. **Start the server:**
   ```bash
   python run.py
   ```

6. **Verify:**
   - Swagger: `http://127.0.0.1:8000/docs`
   - Health: `http://127.0.0.1:8000/api/v1/health`
   - Zones GeoJSON: `http://127.0.0.1:8000/api/v1/zones/geojson?city=chennai`

---

## 16. Build Order (Recommended)

| Phase | Task | Duration |
|---|---|---|
| 1 | Repo setup + download DEM/OSM for Chennai | 4h |
| 2 | Preprocess DEM → slope, flow, TWI | 3h |
| 3 | AHP + Jenks → `zones.geojson` | 3h |
| 4 | Build `/zones` + `/zones/geojson` endpoints | 2h |
| 5 | Open-Meteo integration + mock fallback | 2h |
| 6 | Train RF + HistGBR models | 4h |
| 7 | Build `/simulation/run` + WebSocket stream | 4h |
| 8 | Set up Chroma + ingest zones/facilities | 3h |
| 9 | Build `/ai_assistant/query` with Ollama | 4h |
| 10 | Juve decision engine + SITREP | 3