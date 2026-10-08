# FloodShield AI

AI-Powered Coastal Flood Intelligence, Simulation, and Early Warning System for India.

---

## 📁 Repository Structure

```text
FloodShieldAi/
├── context/               # Project specification, problem statement, and architecture ideas
├── frontend/              # Next.js 16 (App Router) + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── app/           # Pages: Overview, Simulation, Alerts, Analytics
│   │   ├── components/    # Reusable UI (Button, Card, Badge) & Layout (Navbar, Footer)
│   │   ├── lib/           # Utility helpers (cn)
│   │   └── types/         # Domain TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── backend/               # FastAPI Python Backend
│   ├── app/
│   │   ├── api/v1/        # Endpoints: simulation, zones, alerts, ai_assistant, health
│   │   ├── core/          # Pydantic settings & CORS configuration
│   │   ├── schemas/       # Pydantic data validation models
│   │   ├── services/      # Simulation computation engine & AI decision logic
│   │   └── main.py        # FastAPI application factory & routes
│   ├── requirements.txt   # Python dependencies
│   ├── run.py             # Server starter script
│   └── .env.example
└── README.md
```

---

## 🚀 Quick Start

### 1. Start Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```
Accessible at: [http://localhost:3000](http://localhost:3000)

### 2. Start Backend (FastAPI)

```bash
cd backend
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```
- API Root: [http://localhost:8000](http://localhost:8000)
- Interactive Swagger Docs: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
