# Technical Implementation Plan: Backend Flood Zone Engine & Continental Scaling

## Executive Summary
This document outlines the architecture, database schema, ingestion pipelines, and scaling roadmap to transition FloodShield AI from client-side prototype GeoJSON to a high-throughput, PostGIS-powered backend geospatial engine capable of processing and serving real-time flood hazard zones across the entire Indian coastline (7,516 km).

---

## 1. System Architecture Overview

```
+───────────────────────────────────────────────────────────────────────────────────+
|                           SYSTEM ARCHITECTURE SCHEMATIC                           |
+───────────────────────────────────────────────────────────────────────────────────+
|                                                                                   |
|  [ Ingestion Sources ]                                                            |
|  ├── NASA SRTM / Copernicus DEM 30m GeoTIFFs (Topographic Elevation Baseline)      |
|  ├── INCOIS Real-Time Ocean Buoys & Coastal Tide Gauges (Tidal Surge)              |
|  └── IMD Doppler Weather Radar & GPM Satellite Grid (Precipitation Inflow)        |
|                           │                                                       |
|                           ▼                                                       |
|  [ Backend Geospatial Database (PostgreSQL + PostGIS) ]                           |
|  ├── Spatial Table: `coastal_zones` (Geometries, DEM MSL, Exposure Census)         |
|  ├── Spatial Table: `critical_facilities` (Hospitals, Sub-stations, Shelters)     |
|  ├── Spatial Table: `evacuation_corridors` (Multimodal Transport Networks)        |
|  └── Spatial Indexing: GIST(geom) for sub-millisecond bounding box filtering      |
|                           │                                                       |
|                           ▼                                                       |
|  [ FastAPI Hydrological & Decision Intelligence Engine ]                         |
|  ├── Dynamic Inundation Solver: Surge(t) - DEM(z)                                 |
|  ├── Juve Multi-Criteria Vulnerability Ranking Engine                             |
|  └── Laya Dynamic Evacuation Routing Solver                                       |
|                           │                                                       |
|                           ▼                                                       |
|  [ High-Performance Tile & Stream Caching Layer ]                                 |
|  ├── Redis Spatial In-Memory Cache (Live Simulation State)                        |
|  └── Vector Tile Server (MVT / .pbf Tile Streaming via pg_tileserv or FastAPI)    |
|                           │                                                       |
|                           ▼                                                       |
|  [ Frontend Client: Next.js 16 + MapLibre GL JS ]                                 |
|  ├── Viewport-bounded Vector Tile Streaming (60 FPS WebGL Rendering)             |
|  └── Interactive Defense HUD, Fast-Fly Telemetry, and Symbology Popups            |
|                                                                                   |
+───────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Database Schema Design (PostgreSQL + PostGIS)

### 2.1 Table: `coastal_zones`
Stores all topological flood sectors, elevation contours, and baseline vulnerability parameters.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE coastal_zones (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sector_code VARCHAR(32) NOT NULL,
    region VARCHAR(64) NOT NULL,
    state VARCHAR(64) NOT NULL,
    elevation_msl_meters NUMERIC(5, 2) NOT NULL,     -- Verified NASA SRTM DEM altitude
    distance_to_sea_km NUMERIC(5, 2) NOT NULL,       -- Distance to high tide line
    population_census INTEGER NOT NULL DEFAULT 0,
    critical_facilities_count INTEGER NOT NULL DEFAULT 0,
    evacuation_hub VARCHAR(255) NOT NULL,
    base_risk_level VARCHAR(16) NOT NULL,            -- CRITICAL, HIGH, MEDIUM, LOW, SAFE
    geom GEOMETRY(Polygon, 4326) NOT NULL,           -- WGS84 Spatial Polygon
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial GIST index for bounding-box queries
CREATE INDEX idx_coastal_zones_geom ON coastal_zones USING GIST (geom);
CREATE INDEX idx_coastal_zones_region ON coastal_zones (region);
CREATE INDEX idx_coastal_zones_elevation ON coastal_zones (elevation_msl_meters);
```

### 2.2 Table: `simulation_snapshots`
Stores point-in-time calculation snapshots for scenario replay and historical hazard audits.

```sql
CREATE TABLE simulation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) NOT NULL,
    region VARCHAR(64) NOT NULL,
    tide_surge_meters NUMERIC(4, 2) NOT NULL,
    rainfall_mm_hr NUMERIC(5, 2) NOT NULL,
    forecast_horizon_hours INTEGER NOT NULL,
    calculated_water_level NUMERIC(5, 2) NOT NULL,
    affected_population_total INTEGER NOT NULL,
    critical_zones_count INTEGER NOT NULL,
    payload_geojson JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sim_snapshots_session ON simulation_snapshots (session_id);
```

---

## 3. FastAPI Service & API Specifications

### 3.1 Endpoint: Dynamic BBox Zone Query
- **Route:** `GET /api/v1/zones/`
- **Query Parameters:**
  - `min_lng`, `min_lat`, `max_lng`, `max_lat` (Bounding box coordinates)
  - `tide_level` (float, meters above MSL)
  - `rainfall` (float, mm/h)
- **Response:** Standard GeoJSON `FeatureCollection` with calculated `inundationDepth`, `threatScore`, `riskLevel`, `riskColor`, and `strokeColor`.

### 3.2 Endpoint: Vector Tile Protocol (MVT / Protobuf)
- **Route:** `GET /api/v1/zones/tiles/{z}/{x}/{y}.pbf`
- **Output:** Protobuf vector tile binary stream consumed directly by MapLibre GL JS `vector` source, enabling rendering across thousands of simultaneous polygons.

### 3.3 Endpoint: Scenario Simulation Engine
- **Route:** `POST /api/v1/simulation/run`
- **Payload:**
  ```json
  {
    "regionId": "mangalore",
    "tideSurgeMeters": 3.4,
    "rainfallMmPerHour": 95.0,
    "forecastHours": 6,
    "includeEvacuationRoutes": true
  }
  ```
- **Response:** Calculated zone impact metrics, priority evacuation list (Juve AI ranked), and dynamic route states (Laya AI).

---

## 4. Automated DEM Raster Processing Pipeline

To scale hazard polygon creation from individual test cities to the full coastline:

```
[ Download Copernicus GLO-30 / SRTM 1-ArcSecond GeoTIFFs ]
                           │
                           ▼
[ Python GDAL / Rasterio Contour Slicing Pipeline ]
  - Step 1: Reclassify elevation raster into 4 flood bins (<1.0m, 1.0-2.5m, 2.5-5.0m, >15m)
  - Step 2: Polygonize raster contours into vector polygons (`gdal_polygonize.py`)
  - Step 3: TopoJSON topology smoothing and coordinate simplification (Douglas-Peucker 0.0001)
  - Step 4: Spatial intersection with coastal boundary buffer (10 km inland envelope)
                           │
                           ▼
[ Automated Ingestion into PostGIS `coastal_zones` Table ]
```

---

## 5. Implementation Milestones

### Phase 1: PostGIS Database & Migration Setup
- [ ] Configure PostgreSQL with PostGIS in Docker / Local environment.
- [ ] Implement SQLAlchemy 2.0 + GeoAlchemy2 models in `backend/app/models/zone.py`.
- [ ] Write seed script `backend/scripts/seed_postgis_zones.py` to migrate prototype sectors into PostGIS.

### Phase 2: FastAPI Vector Endpoints & PostGIS Integration
- [ ] Implement spatial query handlers in `backend/app/api/v1/endpoints/zones.py`.
- [ ] Add dynamic BBox and MVT tile generator in FastAPI.
- [ ] Integrate Redis cache for instant tile delivery.

### Phase 3: Frontend Vector Tile Integration
- [ ] Update `frontend/src/components/map/MapLibreMap.tsx` to support both live API GeoJSON and vector tile sources (`type: "vector"`).
- [ ] Implement automatic viewport change listeners (`map.on("moveend")`) to fetch data for active view bounds.

### Phase 4: National Scale DEM Ingestion
- [ ] Implement automated Python GDAL script for all 9 maritime states (Gujarat, Maharashtra, Goa, Karnataka, Kerala, Tamil Nadu, Andhra Pradesh, Odisha, West Bengal).
- [ ] Connect real-time INCOIS tide gauge and IMD Doppler weather radar API feeds.

---

## 6. Design & Code Constraints
- Strict prohibition of unicode emojis in any API response, database seed, frontend component, or log output.
- Monospace telemetry typography and high-contrast dark command center color standards throughout.
- Adherence to WGS84 EPSG:4326 geospatial coordinate standards.
