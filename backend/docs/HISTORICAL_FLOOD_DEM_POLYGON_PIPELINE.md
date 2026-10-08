# Automated DEM Flood Polygon Generation from Historical Event Points

## Executive Summary
This technical document specifies the automated engineering pipeline to ingest historical flood event anchor points from CSV/Excel spreadsheets, query surrounding 30-meter NASA SRTM / Copernicus Digital Elevation Models (DEM), apply hydrologically-connected flood-fill algorithms, and extract exact GeoJSON boundary coordinate rings for frontend mapping and geospatial database persistence.

---

## 1. Problem Statement & Method Evaluation

### Objective
Given a list of historical flood occurrences (containing location names, GPS center coordinates, recorded water levels above Mean Sea Level, and affected areas), automatically determine the surrounding low-lying terrain footprint and extract the exact exterior boundary polygon coordinates for map rendering.

### Method Comparison

| Method | Mechanism | Accuracy & Failure Modes | Recommendation |
| :--- | :--- | :--- | :--- |
| **1. Radial Distance Buffer** | Draws a circular radius around the center point. | **Critical Failure:** Floods elevated hills and ignores natural river valleys. | Rejected |
| **2. Global Elevation Thresholding** | Selects all pixels below recorded flood height in a bounding box. | **Sub-optimal:** Floods isolated inland sinks with no physical water connection. | Rejected |
| **3. Hydrologically-Connected DEM Flood-Fill + Contour Vectorization** | Samples 30m DEM grid, executes connected-component flood-fill from water source, and vectorizes outer perimeter. | **High Precision:** Accurately conforms to natural riverbeds, estuaries, and low-lying coastal contours. | **Selected (Optimal)** |

---

## 2. End-to-End Pipeline Architecture

```
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                         HISTORICAL FLOOD DEM POLYGON GENERATION PIPELINE                        |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                 |
|  [ 1. Input Historical CSV / Excel ]                                                            |
|  ├── Event ID, Location Name, District, State                                                   |
|  └── Center Coordinates [Lat, Lng], Recorded Water Level (m MSL), Historical Area (km²)         |
|                           │                                                                     |
|                           ▼                                                                     |
|  [ 2. 30m Digital Elevation Model (DEM) Grid Ingestion ]                                        |
|  ├── Generate Region of Interest (ROI) Bounding Box (e.g., 8 km x 8 km)                         |
|  └── Query NASA SRTM 30m / Copernicus GLO-30 Ground Altitude Matrix [z(x, y)]                  |
|                           │                                                                     |
|                           ▼                                                                     |
|  [ 3. Hydrodynamic Connectivity & Inundation Matrix ]                                           |
|  ├── Calculate Depth Matrix: d(x, y) = max(0, Water Surface Elevation - z(x, y))               |
|  └── Run Morphological 8-Neighbor Flood-Fill from primary water body ingress                    |
|                           │                                                                     |
|                           ▼                                                                     |
|  [ 4. Polygon Boundary Extraction & Vectorization ]                                             |
|  ├── Extract Exterior Coordinate Rings via Marching Squares / Shapely                           |
|  ├── Simplify vertices using Douglas-Peucker Algorithm (0.0001° tolerance)                      |
|  └── Calculate Geodesic Area (km²) and assign Google Flood Hub Severity Colors                  |
|                           │                                                                     |
|                           ▼                                                                     |
|  [ 5. Storage & Delivery ]                                                                      |
|  ├── Save to `backend/data/historical_flood_zones.geojson`                                      |
|  ├── Insert into PostGIS `coastal_zones` database table                                         |
|  └── Stream to Frontend MapLibre GL JS Client                                                   |
|                                                                                                 |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Detailed Data Schemas

### 3.1. Input CSV Schema (`backend/data/historical_flood_records.csv`)

```csv
event_id,location_name,district,state,latitude,longitude,recorded_flood_level_msl,historical_area_sqkm,major_river_or_sea,year
FLD-IXE-2018,Mangalore Netravati Estuary,Dakshina Kannada,Karnataka,12.8552,74.8384,2.80,14.5,Netravati River & Arabian Sea,2018
FLD-COK-2018,Kochi Vembanad Lowlands,Ernakulam,Kerala,9.9650,76.2650,3.20,28.4,Periyar River & Vembanad Backwaters,2018
FLD-MAA-2015,Chennai Adyar Delta,Chennai,Tamil Nadu,13.0150,80.2550,3.40,31.0,Adyar River & Bay of Bengal,2015
FLD-BOM-2005,Mumbai Mithi River Basin,Mumbai Suburban,Maharashtra,19.0350,72.8450,4.50,42.0,Mithi River & Mahim Bay,2005
FLD-UDU-2020,Udupi Malpe Lowland Strip,Udupi,Karnataka,13.3512,74.7042,2.40,8.9,Malpe Estuary & Arabian Sea,2020
```

---

### 3.2. Automated Python Generator Workflow (`backend/scripts/dem_flood_polygonizer.py`)

The extraction script executes the following mathematical workflow:

#### Step A: Bounding Box Calculation
For any anchor coordinate $(\text{lat}_c, \text{lng}_c)$ and radius $R = 4\text{ km}$:
$$\Delta \text{lat} = \frac{R}{111.32}, \quad \Delta \text{lng} = \frac{R}{111.32 \times \cos(\text{lat}_c)}$$
$$\text{BBox} = [\text{lng}_c - \Delta \text{lng}, \text{lat}_c - \Delta \text{lat}, \text{lng}_c + \Delta \text{lng}, \text{lat}_c + \Delta \text{lat}]$$

#### Step B: Connected Inundation Mask
Given ground altitude $z(x, y)$ and Water Surface Elevation $\text{WSE}$:
$$\text{Raw Inundation}(x, y) = \begin{cases} 1 & \text{if } z(x, y) \le \text{WSE} \\ 0 & \text{otherwise} \end{cases}$$
$$\text{Connected Mask} = \text{BinaryFloodFill}(\text{Raw Inundation}, \text{Seed}=(\text{lng}_{\text{water}}, \text{lat}_{\text{water}}))$$

#### Step C: Vector Polygonization & Coordinate Formatting
The binary grid is converted into vector geometries using `rasterio.features.shapes` and simplified with `shapely.geometry.polygon.Polygon.simplify`.

---

### 3.3. Output GeoJSON Schema (`backend/data/historical_flood_zones.geojson`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "eventId": "FLD-IXE-2018",
        "name": "Mangalore Netravati Estuary & Spit Lowlands",
        "district": "Dakshina Kannada",
        "state": "Karnataka",
        "year": 2018,
        "recordedWaterLevelM": 2.80,
        "calculatedFloodedAreaSqKm": 14.12,
        "riskTier": "CRITICAL",
        "riskColor": "#dc2626",
        "strokeColor": "#991b1b",
        "fillOpacity": 0.75,
        "strokeWidth": 3.5
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [74.8152, 12.8751],
            [74.8284, 12.8720],
            [74.8540, 12.8402],
            [74.8621, 12.8180],
            [74.8450, 12.8020],
            [74.8220, 12.8105],
            [74.8152, 12.8751]
          ]
        ]
      }
    }
  ]
}
```

---

## 4. MapLibre GL JS Frontend Integration

The generated GeoJSON coordinates are added directly to the client map component ([`frontend/src/components/map/MapLibreMap.tsx`](file:///C:/Users/Ravinarayana%20U/projects/FloodShieldAi/frontend/src/components/map/MapLibreMap.tsx)):

```typescript
// Add Historical Flood Polygon Vector Source
map.addSource("historical-floods-source", {
  type: "geojson",
  data: "/api/v1/zones/historical-geojson",
});

// Translucent Inundation Fill Layer
map.addLayer({
  id: "historical-floods-fill",
  type: "fill",
  source: "historical-floods-source",
  paint: {
    "fill-color": ["get", "riskColor"],
    "fill-opacity": ["get", "fillOpacity"],
  },
});

// Contour Stroke Border
map.addLayer({
  id: "historical-floods-stroke",
  type: "line",
  source: "historical-floods-source",
  paint: {
    "line-color": ["get", "strokeColor"],
    "line-width": ["get", "strokeWidth"],
  },
});
```

---

## 5. Execution Roadmap

1. **Step 1: Input Dataset Provision:** Populate `backend/data/historical_flood_records.csv` with historical flood event coordinates and water heights.
2. **Step 2: Automated Extraction Run:** Execute `python backend/scripts/dem_flood_polygonizer.py` to sample NASA SRTM DEM elevations, calculate connected inundation, and generate `historical_flood_zones.geojson`.
3. **Step 3: Database & API Binding:** Ingest GeoJSON into PostgreSQL PostGIS tables and expose via FastAPI `GET /api/v1/zones/historical`.
4. **Step 4: Interactive Frontend Layer:** Display historical flood boundary layers on the map with telemetry popups showing recorded water depth and inundated square kilometers.
