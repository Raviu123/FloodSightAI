# FastAPI Backend API Reference

This document provides complete endpoint documentation, request payloads, response structures, and test commands for the **FloodShield AI** API.

Base URL: `http://127.0.0.1:8000/api/v1`  
Interactive Swagger UI: `http://127.0.0.1:8000/docs`

---

## Endpoints Index

| Endpoint                                                             | Method | Tag                            | Description                                                                                     |
| -------------------------------------------------------------------- | :----: | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`/simulation/run`](#1-post-apiv1simulationrun)                      | `POST` | AI Simulation Engine           | Runs the full ML prediction pipeline and returns risk levels, XAI drivers, and affected assets. |
| [`/simulation/quick-estimate`](#2-get-apiv1simulationquick-estimate) | `GET`  | AI Simulation Engine           | Quick GET endpoint for URL query-based simulation estimates.                                    |
| [`/sitrep/generate`](#3-post-apiv1sitrepgenerate)                    | `POST` | Automated SITREP Briefing      | Generates an official NDRF Situation Report (SITREP) based on current telemetry.                |
| [`/decision/priority-queue`](#4-post-apiv1decisionpriority-queue)    | `POST` | Juve Decision Framework        | Returns the Juve-ranked emergency response queue.                                               |
| [`/zones`](#5-get-apiv1zones)                                        | `GET`  | Coastal Zones & Infrastructure | Lists all monitored coastal zones with hospitals, shelters, and roads.                          |
| [`/zones/{zone_id}`](#6-get-apiv1zoneszone_id)                       | `GET`  | Coastal Zones & Infrastructure | Returns detailed profile for a specific coastal zone.                                           |
| [`/health`](#7-get-apiv1health)                                      | `GET`  | Health                         | Server and database health status check.                                                        |
| [`/terrain/elevation-safety`](#8-get-apiv1terrainelevation-safety)   | `GET`  | Terrain Analysis               | Returns filtered, contiguous relative-elevation regions for a selected region.                  |

## 8. `GET /api/v1/terrain/elevation-safety`

This endpoint analyzes elevation only. It does not use tide, rainfall, surge, flood probability, flood depth, drainage, or distance-to-water inputs.

Example:

```text
/api/v1/terrain/elevation-safety?region_id=mangalore
```

The response is a GeoJSON `FeatureCollection` with `danger`, `neutral`, and `safe` relative terrain polygons. Defaults use the 33rd and 67th elevation percentiles, a 20 m minimum feature width, and a 400 m² minimum hotspot area. The DEM provider and zoom are configured by `DEM_TILE_URL` and `DEM_TILE_ZOOM`.

---

## 1. `POST /api/v1/simulation/run`

### Request Payload

```json
{
    "tide_level_meters": 3.2,
    "rainfall_mm_per_hour": 85.0,
    "forecast_hours": 6,
    "wind_speed_kmh": 45.0,
    "cyclone_active": true,
    "soil_saturation": 0.85
}
```

### Response Example (Truncated to Single Zone)

```json
{
    "threat_index": 82.1,
    "overall_risk": "CRITICAL",
    "simulation_params": {
        "tide_level_meters": 3.2,
        "rainfall_mm_per_hour": 85.0,
        "forecast_hours": 6,
        "wind_speed_kmh": 45.0,
        "cyclone_active": true,
        "soil_saturation": 0.85
    },
    "estimated_inundated_area_sq_km": 20.8,
    "total_population_at_risk": 100100,
    "critical_zones_count": 3,
    "zones": [
        {
            "zone_id": "ZONE-03",
            "zone_name": "Kochi Backwaters & Canal Network",
            "state": "Kerala",
            "region": "South-West Coast",
            "elevation_meters": 0.5,
            "population": 32000,
            "dist_to_coast_km": 1.1,
            "dist_to_river_km": 0.02,
            "drainage_capacity_pct": 28.0,
            "latitude": 9.9674,
            "longitude": 76.244,
            "flood_probability": 0.94,
            "is_flooded": true,
            "projected_depth_meters": 1.77,
            "onset_time_minutes": 22,
            "peak_time_minutes": 308,
            "threat_level": "CRITICAL",
            "primary_drivers": [
                {
                    "factor_key": "rainfall_rate_mm_h",
                    "factor_name": "Torrential Rainfall Rate",
                    "contribution_pct": 30.0
                },
                {
                    "factor_key": "tide_level_m",
                    "factor_name": "Astronomical & Surge High Tide",
                    "contribution_pct": 24.9
                },
                {
                    "factor_key": "elevation_m",
                    "factor_name": "Low Terrain Ground Elevation",
                    "contribution_pct": 18.2
                },
                {
                    "factor_key": "dist_to_river_km",
                    "factor_name": "Estuary & River Confluence Backflow",
                    "contribution_pct": 14.5
                }
            ],
            "plain_language_explanation": "Severe flood danger for Kochi Backwaters & Canal Network (Peak Depth 1.77m). Driven primarily by Torrential Rainfall Rate (30.0%) combined with Astronomical & Surge High Tide (24.9%), causing rapid water accumulation beyond local drainage capacity.",
            "priority_score": 87.2,
            "evacuation_priority_rank": 1,
            "threatened_facilities": [
                {
                    "name": "General Hospital West Kochi",
                    "type": "HOSPITAL",
                    "elevation_meters": 0.7,
                    "capacity": 600,
                    "status": "AT_RISK"
                }
            ],
            "safe_shelters": [
                {
                    "name": "Ernakulam South High-Ground Relief Center",
                    "type": "SHELTER",
                    "elevation_meters": 16.0,
                    "capacity": 4500,
                    "status": "SAFE_OPERATIONAL"
                }
            ],
            "submerged_roads": [
                {
                    "name": "Mattancherry Low Canal Ring Road",
                    "elevation_meters": 0.4,
                    "status": "SUBMERGED_IMPASSABLE",
                    "depth_over_road_m": 1.37
                }
            ],
            "recommended_action": "PRIORITY 1: Dispatch NDRF flood-rescue craft. Evacuate hospital ground floors to safe shelter.",
            "alert_headline": "RED ALERT: Imminent Flood Threat in Kochi Backwaters & Canal Network",
            "sms_text": "EMERGENCY: Kochi Backwaters & Canal Network flood onset in 22m, peak in 308m. Avoid Mattancherry Low Canal Ring Road. Move to Ernakulam South High-Ground Relief Center immediately. Dial 112 for rescue."
        }
    ],
    "recommendation": "RED ALERT: Immediate evacuation of Tier-1 coastal lowlands required. Issue mobile broadcasts & mobilize NDRF units.",
    "ai_validation_metrics": {
        "roc_auc": 0.9952,
        "accuracy": 0.9717,
        "precision": 0.9451,
        "depth_mae_meters": 0.024,
        "onset_time_mae_minutes": 6.43,
        "peak_time_mae_minutes": 10.99
    }
}
```

---

## 2. `POST /api/v1/sitrep/generate`

### Request Payload

Same as `/simulation/run`.

### Response Example

```json
{
    "incident_name": "OPERATION COASTAL SHIELD",
    "report_type": "OFFICIAL SITUATION REPORT (SITREP)",
    "timestamp": "08-Oct-2026 12:46 UTC",
    "weather_condition": "CYCLONIC DEPRESSION & SURGE",
    "telemetry": {
        "astronomical_tide_surge_m": 3.2,
        "peak_rainfall_intensity_mm_h": 85.0,
        "cyclonic_surge_active": true
    },
    "impact_assessment": {
        "total_zones_evaluated": 5,
        "critical_zones_count": 3,
        "total_population_at_risk": 100100,
        "estimated_inundation_area_sq_km": 20.8
    },
    "executive_summary": "Severe coastal storm surge and pluvial flooding active. Hydrodynamic ML forecasting indicates 3 high-vulnerability coastal zones breached critical flood thresholds. Top operational priority is Kochi Backwaters & Canal Network due to projected depth of 1.77m and onset lead time of 22 minutes.",
    "tactical_directives": [
        "Deploy NDRF quick-response teams to Kochi Backwaters & Canal Network (Priority Rank 1).",
        "Stage high-capacity diesel de-watering pumps at primary road culverts.",
        "Issue cell-broadcast emergency SMS alerts to residents in low-lying zones."
    ],
    "ranked_zone_overview": [
        {
            "rank": 1,
            "zone_name": "Kochi Backwaters & Canal Network",
            "threat_level": "CRITICAL",
            "depth_m": 1.77,
            "onset_min": 22
        },
        {
            "rank": 2,
            "zone_name": "Mangalore Estuary & Netravati Confluence",
            "threat_level": "CRITICAL",
            "depth_m": 1.94,
            "onset_min": 23
        },
        {
            "rank": 3,
            "zone_name": "Udupi Lowland Swamps & Malpe Port Area",
            "threat_level": "CRITICAL",
            "depth_m": 1.24,
            "onset_min": 34
        }
    ]
}
```

---

## 3. How to Test Endpoints Locally

Start the backend server:

```powershell
backend\.venv\Scripts\python.exe backend/run.py
```

Test simulation in PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/simulation/run" -ContentType "application/json" -Body '{"tide_level_meters": 3.2, "rainfall_mm_per_hour": 85.0, "cyclone_active": true}'
```

Test SITREP briefing:

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/sitrep/generate" -ContentType "application/json" -Body '{"tide_level_meters": 3.2, "rainfall_mm_per_hour": 85.0, "cyclone_active": true}'
```
