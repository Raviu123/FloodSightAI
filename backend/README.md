# FloodShield AI — FastAPI Backend

Modular, high-performance FastAPI backend service for **FloodShield AI** — powering coastal flood simulation, risk zone intelligence, emergency alert dispatching, and AI decision models (Juve / Laya).

---

## 📁 Backend Architecture

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── health.py        # Health status & API metadata
│   │       │   ├── simulation.py    # Coastal flood simulation engine endpoints
│   │       │   ├── zones.py         # Coastal zones, elevation, & facility data
│   │       │   ├── alerts.py        # Active alerts & emergency SMS broadcast
│   │       │   └── ai_assistant.py  # Conversational flood decision assistant
│   │       └── api.py               # API V1 Router aggregator
│   ├── core/
│   │   └── config.py                # Pydantic Settings & environment variables
│   ├── schemas/
│   │   ├── simulation.py            # Pydantic models for simulation parameters & results
│   │   ├── zone.py                  # Pydantic models for coastal zones & critical facilities
│   │   ├── alert.py                 # Pydantic models for alerts & evacuation notifications
│   │   └── chat.py                  # Pydantic models for conversational assistant
│   ├── services/
│   │   ├── flood_engine.py          # Surge, rainfall, and threat calculations
│   │   └── ai_decision.py           # Multi-criteria decision & route heuristics
│   └── main.py                      # FastAPI app initialization, CORS, and OpenAPI docs
├── requirements.txt                 # Dependencies
├── .env.example                     # Environment template
├── .gitignore
├── run.py                           # Server runner script
└── README.md
```

---

## 🚀 Quick Start

### 1. Create and Activate Virtual Environment

```bash
cd backend
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# On macOS/Linux:
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Backend Server

```bash
python run.py
# Or with uvicorn directly:
uvicorn app.main:app --reload --port 8000
```

The API will be available at:
- **Root**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **ReDoc**: [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc)
- **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health status |
| `POST` | `/api/v1/simulation/run` | Run dynamic flood simulation with tide/rainfall sliders |
| `GET` | `/api/v1/simulation/quick-estimate` | Fast URL query param estimation |
| `GET` | `/api/v1/zones/` | List all monitored coastal regions |
| `GET` | `/api/v1/zones/{zone_id}` | Detailed risk profile and safe evacuation paths |
| `GET` | `/api/v1/alerts/` | List active emergency alerts |
| `POST` | `/api/v1/alerts/broadcast` | Dispatch emergency notifications |
| `POST` | `/api/v1/assistant/query` | Natural language decision intelligence assistant |
