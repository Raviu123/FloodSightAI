# Database Schema & Coastal Test Zone Seeding

This document details the database architecture, SQLAlchemy ORM models, and the coastal test zone profiles seeded in **FloodShield AI**.

---

## 1. Database Architecture & Engine Configuration

Implemented in [`backend/app/core/database.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/core/database.py) and [`backend/app/core/config.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/core/config.py).

- **Primary Database**: PostgreSQL (`postgresql://postgres:postgres@localhost:5432/floodshield`)
- **Resilient Fallback**: SQLite (`sqlite:///./floodshield.db`) — automatically activates when PostgreSQL is not reachable, ensuring zero crashes in offline or test environments.
- **Connection Management**: SQLAlchemy session factory with connection pooling and pre-ping health checks.

---

## 2. SQLAlchemy ORM Models

Implemented in [`backend/app/models/`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/app/models/):

### `Zone` Model (`app/models/zone.py`)
- `id` (String PK): e.g. `ZONE-01`
- `name` (String): e.g. `Mangalore Estuary & Netravati Confluence`
- `state` / `region` (String): e.g. `Karnataka`, `West Coast`
- `latitude` / `longitude` (Float): Center coordinates
- `elevation_meters` (Float): Terrain elevation above MSL (DEM)
- `population` (Integer): Resident population
- `dist_to_coast_km` (Float): Distance to open sea
- `dist_to_river_km` (Float): Distance to river confluence
- `drainage_capacity_pct` (Float): Stormwater capacity (0-100%)
- `polygon_coordinates` (JSON): GeoJSON bounding polygon coordinates

### `CriticalFacility` Model (`app/models/zone.py`)
- `id` (Integer PK)
- `zone_id` (String FK $\rightarrow$ `zones.id`)
- `name` (String): e.g. `Mangalore City Trauma Center`
- `facility_type` (String): `HOSPITAL`, `SHELTER`, `POWER_SUBSTATION`
- `elevation_meters` (Float)
- `capacity` (Integer)
- `is_at_risk` (Boolean)

### `AffectedRoad` Model (`app/models/zone.py`)
- `id` (Integer PK)
- `zone_id` (String FK $\rightarrow$ `zones.id`)
- `name` (String): e.g. `NH-66 Netravati Bridge Lowland Approach`
- `road_type` (String): `HIGHWAY`, `ARTERIAL`, `LOCAL`
- `elevation_meters` (Float)
- `flood_cutoff_depth_m` (Float): Threshold depth where road becomes impassable (default $0.3\text{m}$)
- `status` (String): `CLEAR`, `SUBMERGED`

### `PredictionRecord` Model (`app/models/prediction.py`)
- Stores each historical simulation run with telemetry, ML outputs, primary drivers JSON, explanation text, and priority rank.

### `AlertRecord` Model (`app/models/alert.py`)
- Stores generated SMS broadcast alerts and severity levels.

---

## 3. Seeded Indian Coastal Zone Profiles

Populated via [`backend/scripts/seed_db.py`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/backend/scripts/seed_db.py):

| Zone ID | Zone Name | State | Elevation | Population | Key Hospital / Facility | Safe Highland Shelter |
|---|---|---|:---:|:---:|---|---|
| **`ZONE-01`** | **Mangalore Estuary** | Karnataka | $0.8\text{m}$ | 14,200 | Mangalore City Trauma Center ($1.1\text{m}$) | Netravati Highland Shelter ($14.5\text{m}$) |
| **`ZONE-02`** | **Udupi Malpe Port** | Karnataka | $1.3\text{m}$ | 8,900 | Malpe Harbor Maritime Dispensary ($1.4\text{m}$) | Udupi Cyclone Shelter ($12.0\text{m}$) |
| **`ZONE-03`** | **Kochi Backwaters** | Kerala | $0.5\text{m}$ | 32,000 | General Hospital West Kochi ($0.7\text{m}$) | Ernakulam South Shelter ($16.0\text{m}$) |
| **`ZONE-04`** | **Chennai Adyar Delta** | Tamil Nadu | $2.1\text{m}$ | 45,000 | Adyar Multi-Specialty Health Center ($2.3\text{m}$) | Guindy Safe Shelter ($18.0\text{m}$) |
| **`ZONE-05`** | **Visakhapatnam Harbor** | Andhra Pradesh | $3.4\text{m}$ | 18,000 | Port Trust Central Hospital ($4.1\text{m}$) | Kailasagiri Hilltop Shelter ($35.0\text{m}$) |

---

## 4. How to Re-Seed the Database

Run from project root:
```powershell
backend\.venv\Scripts\python.exe backend/scripts/seed_db.py
```
