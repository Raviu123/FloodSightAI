# Automated DEM Flood Polygon Generation from Historical Event Points

## Executive Summary
This technical document specifies the end-to-end engineering pipeline to collect historical Indian flood event records and digital elevation models, ingest anchor points from CSV/Excel registries, query 30-meter NASA SRTM / Copernicus Digital Elevation Models (DEM), apply hydrologically-connected flood-fill algorithms, and extract exact GeoJSON boundary coordinate rings for frontend mapping and geospatial database persistence.

---

## 1. Data Collection Strategy & Sources

To ensure physical precision across all coastal zones and river deltas, data collection is split into two primary streams: **(1) Historical Flood Event Data** and **(2) High-Resolution Topographic DEM Elevation Data**.

```
+─────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    DATA COLLECTION STREAMS                                      |
+───────────────────────────────────────────+─────────────────────────────────────────────────────+
| Stream 1: Historical Flood Event Data     | Stream 2: Topographic DEM Elevation Data            |
+───────────────────────────────────────────+─────────────────────────────────────────────────────+
| • Global Flood Database (GFD / DFO)       | • NASA SRTM 30m (1-ArcSecond Global DEM)           |
| • CWC India Flood Forecasting Network     | • Copernicus GLO-30 (European Space Agency COGs)    |
| • ISRO Bhuvan NRSC Disaster Records       | • OpenTopography & Open-Elevation REST APIs         |
| • IMD Historical Precipitation Bulletins  | • Survey of India Coastal Benchmark Geodetics       |
| • DesInventar / EM-DAT Disaster Registry  |                                                     |
+───────────────────────────────────────────+─────────────────────────────────────────────────────+
```

---

### 1.1. Collecting Historical Flood Event Data

Historical flood data provides the physical parameters (event dates, peak water levels, geographic centers, and recorded inundated surface area):

#### A. Global Flood Database (GFD / Dartmouth Flood Observatory — Cloud to Street)
* **What is Collected:** 20+ years (2000–present) of high-resolution satellite-observed flood inundation footprints (MODIS, Sentinel-1 SAR).
* **Key Fields Extracted:** `event_id`, `start_date`, `end_date`, `centroid_lat`, `centroid_lng`, `inundated_area_sqkm`, `main_cause` (monsoon, tropical cyclone, dam spill).
* **Collection Method:** 
  * Bulk download of the global shapefile/CSV archive from the [Global Flood Database Open Data Portal](https://global-flood-database.cloudtostreet.ai/).
  * Python script filters bounding coordinates for India's spatial envelope (`lat: 8.0° to 37.0° N`, `lng: 68.0° to 97.5° E`).

#### B. Central Water Commission (CWC) Flood Portal & River Gauges
* **What is Collected:** Official Indian government gauge level observations across 300+ coastal and river monitoring stations.
* **Key Fields Extracted:** `river_basin`, `gauge_station_name`, `warning_level_m_msl`, `danger_level_m_msl`, `high_flood_level_hfl_m_msl`, `peak_discharge_cumecs`.
* **Collection Method:** 
  * Scraping daily flood bulletins and annual flood reports from the [CWC Flood Forecast Portal](https://ffs.india-water.gov.in/).
  * Correlating HFL breaches with corresponding coastal river mouth coordinates.

#### C. ISRO Bhuvan Disaster Management Support (NRSC)
* **What is Collected:** Radar-derived flood extent maps (Sentinel-1 SAR and RISAT-1) captured during active Indian cyclone and monsoon emergencies.
* **Key Fields Extracted:** District-wise cumulative inundated area (sq. km), flood frequency classification, and historical flood inundation vectors.
* **Collection Method:** 
  * Ingesting published Flood Hazard Zonation Atlases (Karnataka, Kerala, Tamil Nadu, Maharashtra, Odisha, Andhra Pradesh, West Bengal).

#### D. India Meteorological Department (IMD) & DesInventar Sendai Registry
* **What is Collected:** 24-hour peak station rainfall (mm), cyclonic track landfall coordinates, and municipal damage inventories.
* **Collection Method:** Aggregated from IMD Monsoon Season End Reports and the United Nations DesInventar India Disaster database.

---

### 1.2. Collecting Topographical DEM Elevation Data

To calculate where water flows, high-resolution Digital Elevation Models (DEM) measuring terrain height above Mean Sea Level (MSL) are collected:

#### A. NASA SRTM 30-Meter (1-ArcSecond) DEM
* **What is Collected:** NASA Shuttle Radar Topography Mission (SRTM) global elevation raster tiles at $30\text{m} \times 30\text{m}$ spatial resolution.
* **Vertical Accuracy:** $\pm 1.0\text{m}$ relative vertical accuracy across coastal floodplains.
* **Collection Method:**
  * **Option 1 (Automated Python Ingestion):** Using the Python `elevation` and `rasterio` libraries to download HGT elevation tiles on-demand:
    ```bash
    eio clip -o mangalore_dem.tif --bounds 74.80 12.80 74.90 12.95
    ```
  * **Option 2 (AWS Open Data S3):** Stream directly from `s3://elevation-tiles-prod/geotiff/` without local storage overhead.

#### B. Copernicus GLO-30 DEM (ESA 30m Global Model)
* **What is Collected:** 2020-baseline radar altimetry from European Space Agency satellites. Provides superior artifact correction over coastal wetlands, dense mangrove belts, and urban harbor structures.
* **Collection Method:** Accessed via Cloud-Optimized GeoTIFFs (COG) using STAC API or AWS Open Data registry (`s3://copernicus-dem-30m/`).

#### C. Open-Elevation / OpenTopography REST APIs
* **What is Collected:** On-demand point and grid elevation queries over HTTP for instant prototyping.
* **Collection Method:**
  ```python
  import httpx

  async def get_elevation_grid(lats: list, lngs: list):
      payload = {"locations": [{"latitude": lat, "longitude": lng} for lat, lng in zip(lats, lngs)]}
      response = await httpx.post("https://api.open-elevation.com/api/v1/lookup", json=payload)
      return response.json()["results"]
  ```

---

## 2. Automated Data Ingestion & Cleaning Pipeline

```
[ Step 1: Raw Data Harvesting ]
├── Run `backend/scripts/download_historical_flood_data.py` (GFD, CWC, IMD)
└── Run `backend/scripts/fetch_dem_tiles.py` (NASA SRTM 30m / Copernicus COGs)
                           │
                           ▼
[ Step 2: Quality Filtering & Schema Normalization ]
├── Filter records with verified Water Level (m MSL) and GPS Coordinates
├── Remove duplicates & reconcile multiple gauge reports for identical events
└── Compile into standardized `backend/data/historical_flood_records.csv`
                           │
                           ▼
[ Step 3: Topographic DEM Polygonizer Engine ]
├── Run `backend/scripts/dem_flood_polygonizer.py`
└── Execute connected flood-fill, Marching Squares contouring, and Douglas-Peucker simplification
                           │
                           ▼
[ Step 4: Storage & Visualization ]
├── Export `backend/data/historical_flood_zones.geojson`
├── Ingest into PostGIS table: `coastal_zones`
└── Render on Next.js 16 + MapLibre GL JS frontend dashboard
```

---

## 3. Detailed Data Schemas

### 3.1. Standardized Historical CSV Format (`backend/data/historical_flood_records.csv`)

```csv
event_id,location_name,district,state,latitude,longitude,recorded_flood_level_msl,historical_area_sqkm,major_river_or_sea,year
FLD-IXE-2018,Mangalore Netravati Estuary,Dakshina Kannada,Karnataka,12.8552,74.8384,2.80,14.5,Netravati River & Arabian Sea,2018
FLD-COK-2018,Kochi Vembanad Lowlands,Ernakulam,Kerala,9.9650,76.2650,3.20,28.4,Periyar River & Vembanad Backwaters,2018
FLD-MAA-2015,Chennai Adyar Delta,Chennai,Tamil Nadu,13.0150,80.2550,3.40,31.0,Adyar River & Bay of Bengal,2015
FLD-BOM-2005,Mumbai Mithi River Basin,Mumbai Suburban,Maharashtra,19.0350,72.8450,4.50,42.0,Mithi River & Mahim Bay,2005
FLD-UDU-2020,Udupi Malpe Lowland Strip,Udupi,Karnataka,13.3512,74.7042,2.40,8.9,Malpe Estuary & Arabian Sea,2020
```

---

### 3.2. Automated Python Polygonizer Algorithm (`backend/scripts/dem_flood_polygonizer.py`)

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

## 5. Execution Summary

1. **Automated Collection:** Python harvesting scripts extract historical disaster benchmarks from Global Flood Database, CWC, and IMD into `historical_flood_records.csv`.
2. **DEM Ingestion:** 30m NASA SRTM / Copernicus elevation grids are sampled across bounding envelopes.
3. **Physical Accuracy:** Connected morphological flood-fill ensures zero floating artifacts over elevated terrain.
4. **Instant Visualization:** Generates lightweight GeoJSON coordinate polygons ready for 60 FPS rendering in MapLibre GL JS.
