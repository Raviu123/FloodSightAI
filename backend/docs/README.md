# Backend Implementation & Architecture Overview

This directory contains complete technical documentation and specifications for all implemented backend modules, ML models, Explainable AI (XAI) services, decision frameworks, and database architecture in **FloodShield AI**.

---

## Directory Index

| Document | Description |
|---|---|
| [ML Pipeline & Models](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/docs/ML_PIPELINE.md) | Details on physics-informed synthetic data, Scikit-Learn classifiers/regressors, training metrics, and model serialization. |
| [XAI & Decision Engine](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/docs/XAI_AND_DECISION_ENGINE.md) | Feature attribution mechanisms, plain-language translation, and Juve Multi-Criteria zone prioritization. |
| [Database & Seeding](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/docs/DATABASE_AND_SEEDING.md) | PostgreSQL / SQLite schema, SQLAlchemy ORM models, and Indian coastal test zone profiles. |
| [API Reference](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/docs/API_REFERENCE.md) | REST API endpoints, request schemas, response examples, and verification commands. |

---

## High-Level System Architecture

```
                       ┌────────────────────────────────────────────────────────┐
                       │                   INPUT TELEMETRY                      │
                       │  (Tide, Rainfall Rate, 6h Accumulation, Wind, Saturation) │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             AI CORE ENGINE (`app/services`)                                      │
├─────────────────────────────────────┬────────────────────────────────────┬───────────────────────────────────────┤
│        1. ML PREDICTOR              │         2. XAI ENGINE              │       3. DECISION & SITREP            │
│  • RandomForest Classifier          │  • Tree Feature Attributions       │  • Juve Multi-Criteria Prioritizer    │
│    (P(Flood) ∈ [0, 1])              │  • % Driver Breakdown              │  • Submerged Road Evaluator           │
│  • HistGradientBoosting Regressors  │  • Plain-Language Narrative        │  • Hospital Threat Flagging           │
│    (Depth, Onset Time, Peak Time)   │    Summary                         │  • NDRF SITREP & SMS Generator        │
└─────────────────────────────────────┴────────────────────────────────────┴───────────────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │          DATABASE LAYER & FASTAPI REST OUTPUT          │
                       │  • Models: Zone, CriticalFacility, AffectedRoad,       │
                       │            PredictionRecord, AlertRecord               │
                       │  • Endpoints: /simulation/run, /sitrep/generate,       │
                       │               /decision/priority-queue, /zones         │
                       └────────────────────────────────────────────────────────┘
```

---

## Key Backend File Locations

- **Trained Model Artifacts**: [`backend/app/ml/flood_models.joblib`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/ml/flood_models.joblib)
- **Model Validation Metrics**: [`backend/app/ml/metrics.json`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/ml/metrics.json)
- **Dataset Generation Script**: [`backend/scripts/generate_synthetic_data.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/scripts/generate_synthetic_data.py)
- **Model Training Script**: [`backend/scripts/train_models.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/scripts/train_models.py)
- **Database Seeding Script**: [`backend/scripts/seed_db.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/scripts/seed_db.py)
- **FastAPI Application Entry**: [`backend/run.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/run.py)
