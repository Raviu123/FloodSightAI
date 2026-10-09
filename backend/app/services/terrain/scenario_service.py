"""
Scenario Management, Run Persistence, and Comparative Delta Engine.
Manages scenario definitions, persistent SQLite disk caching for runs,
preset scenario families, and comparative spatial depth delta analysis.
"""

from __future__ import annotations

import json
from pathlib import Path
import sqlite3
import time
from typing import Any, Dict, List, Optional

from app.schemas.simulation_scenario import (
    RainfallPattern,
    ScenarioComparisonResult,
    ScenarioPreset,
    ScenarioRunResult,
    SimulationScenarioConfig,
)
from app.services.terrain.simulation_engine import simulation_engine

REPO_ROOT = Path(__file__).resolve().parents[4]
CACHE_DIR = REPO_ROOT / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = CACHE_DIR / "simulation_runs.db"


def _init_run_database() -> None:
    """Initializes SQLite disk table for scenario runs."""
    try:
        with sqlite3.connect(str(DB_PATH), timeout=10.0) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS simulation_runs (
                    run_id TEXT PRIMARY KEY,
                    scenario_id TEXT NOT NULL,
                    spatial_domain TEXT NOT NULL,
                    scenario_json TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            conn.commit()
    except Exception as err:
        print(f"Warning: Failed to initialize simulation_runs DB: {err}")


_init_run_database()


class ScenarioService:
    """Service layer for running, persisting, listing, and comparing scenario simulations."""

    def get_preset_families(self, spatial_domain: str = "mumbai") -> List[ScenarioPreset]:
        """Returns standard pre-configured scenario families for comparative testing."""
        domain = spatial_domain.lower()
        return [
            ScenarioPreset(
                preset_id="preset_moderate_rain",
                title="Moderate Monsoonal Rain (50 mm/h, 3h)",
                category="Rainfall Intensity",
                description="Standard heavy monsoonal rain episode with baseline soil moisture (60%).",
                config=SimulationScenarioConfig(
                    scenario_id=f"scen_{domain}_moderate_50mm_3h",
                    name="Moderate Monsoonal Rain (50 mm/h)",
                    description="50 mm/h for 3 hours with 60% soil saturation.",
                    spatial_domain=domain,
                    rainfall_intensity_mm_h=50.0,
                    rainfall_duration_hours=3.0,
                    soil_saturation_index=0.60,
                    total_duration_hours=12.0,
                ),
            ),
            ScenarioPreset(
                preset_id="preset_extreme_cloudburst",
                title="Extreme Cloudburst (120 mm/h, 6h)",
                category="Rainfall Intensity",
                description="Severe urban cloudburst episode (120 mm/h for 6 hours).",
                config=SimulationScenarioConfig(
                    scenario_id=f"scen_{domain}_cloudburst_120mm_6h",
                    name="Extreme Cloudburst (120 mm/h)",
                    description="120 mm/h for 6 hours with 75% soil saturation.",
                    spatial_domain=domain,
                    rainfall_intensity_mm_h=120.0,
                    rainfall_duration_hours=6.0,
                    soil_saturation_index=0.75,
                    total_duration_hours=12.0,
                ),
            ),
            ScenarioPreset(
                preset_id="preset_saturated_extreme",
                title="Saturated Extreme Runoff (95% Soil Moisture)",
                category="Soil Saturation",
                description="Extreme cloudburst occurring over fully saturated soil (95% saturation index).",
                config=SimulationScenarioConfig(
                    scenario_id=f"scen_{domain}_saturated_120mm_6h",
                    name="Saturated Extreme Runoff (95% Saturation)",
                    description="120 mm/h for 6 hours with 95% soil saturation index.",
                    spatial_domain=domain,
                    rainfall_intensity_mm_h=120.0,
                    rainfall_duration_hours=6.0,
                    soil_saturation_index=0.95,
                    total_duration_hours=12.0,
                ),
            ),
            ScenarioPreset(
                preset_id="preset_compound_surge",
                title="Compound Flood (Extreme Rain + 2.5m Storm Surge)",
                category="Compound Event",
                description="Extreme rainfall combined with a 2.5m downstream coastal storm surge & river inflow.",
                config=SimulationScenarioConfig(
                    scenario_id=f"scen_{domain}_compound_surge_2.5m",
                    name="Compound Flood (Rain + 2.5m Surge)",
                    description="150 mm/h rain for 6h with 2.5m coastal storm surge stage and 500 m³/s river inflow.",
                    spatial_domain=domain,
                    rainfall_intensity_mm_h=150.0,
                    rainfall_duration_hours=6.0,
                    soil_saturation_index=0.85,
                    coastal_surge_stage_m=2.5,
                    river_inflow_m3_s=500.0,
                    total_duration_hours=12.0,
                ),
            ),
        ]

    def run_scenario(self, config: SimulationScenarioConfig) -> ScenarioRunResult:
        """Executes simulation engine for scenario and persists result to disk database."""
        result = simulation_engine.run_simulation(config)
        self._persist_run(result)
        return result

    def get_run(self, run_id: str) -> Optional[ScenarioRunResult]:
        """Retrieves a stored scenario run by run_id from disk cache."""
        try:
            with sqlite3.connect(str(DB_PATH), timeout=10.0) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT result_json FROM simulation_runs WHERE run_id = ?", (run_id,)
                )
                row = cursor.fetchone()
                if row:
                    data = json.loads(row[0])
                    return ScenarioRunResult(**data)
        except Exception as err:
            print(f"Warning: Failed to fetch run_id '{run_id}': {err}")
        return None

    def _persist_run(self, result: ScenarioRunResult) -> None:
        """Saves a completed ScenarioRunResult to SQLite disk cache."""
        try:
            with sqlite3.connect(str(DB_PATH), timeout=10.0) as conn:
                scen_dict = result.scenario_config.model_dump()
                res_dict = result.model_dump()
                conn.execute(
                    """
                    INSERT OR REPLACE INTO simulation_runs
                    (run_id, scenario_id, spatial_domain, scenario_json, result_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        result.run_id,
                        result.scenario_config.scenario_id,
                        result.scenario_config.spatial_domain,
                        json.dumps(scen_dict),
                        json.dumps(res_dict),
                        time.time(),
                    ),
                )
                conn.commit()
        except Exception as err:
            print(f"Warning: Failed to persist run '{result.run_id}': {err}")

    def compare_scenarios(
        self, baseline_run_id: str, comparison_run_id: str
    ) -> ScenarioComparisonResult:
        """
        Computes spatial depth delta analysis ($\Delta d(x,y) = d_{\text{comp}} - d_{\text{base}}$)
        and comparative metrics between two runs.
        """
        base_run = self.get_run(baseline_run_id)
        comp_run = self.get_run(comparison_run_id)

        if not base_run:
            raise KeyError(f"Baseline run '{baseline_run_id}' was not found")
        if not comp_run:
            raise KeyError(f"Comparison run '{comparison_run_id}' was not found")

        if base_run.scenario_config.spatial_domain != comp_run.scenario_config.spatial_domain:
            raise ValueError(
                f"Cannot compare runs across different spatial domains: "
                f"'{base_run.scenario_config.spatial_domain}' vs '{comp_run.scenario_config.spatial_domain}'"
            )

        domain = base_run.scenario_config.spatial_domain

        # Compute Comparative Parameter Deltas
        param_diffs = {
            "rainfall_intensity_mm_h": {
                "baseline": base_run.scenario_config.rainfall_intensity_mm_h,
                "comparison": comp_run.scenario_config.rainfall_intensity_mm_h,
                "delta": round(
                    comp_run.scenario_config.rainfall_intensity_mm_h
                    - base_run.scenario_config.rainfall_intensity_mm_h,
                    2,
                ),
            },
            "rainfall_duration_hours": {
                "baseline": base_run.scenario_config.rainfall_duration_hours,
                "comparison": comp_run.scenario_config.rainfall_duration_hours,
                "delta": round(
                    comp_run.scenario_config.rainfall_duration_hours
                    - base_run.scenario_config.rainfall_duration_hours,
                    2,
                ),
            },
            "soil_saturation_index": {
                "baseline": base_run.scenario_config.soil_saturation_index,
                "comparison": comp_run.scenario_config.soil_saturation_index,
                "delta": round(
                    comp_run.scenario_config.soil_saturation_index
                    - base_run.scenario_config.soil_saturation_index,
                    2,
                ),
            },
            "coastal_surge_stage_m": {
                "baseline": base_run.scenario_config.coastal_surge_stage_m,
                "comparison": comp_run.scenario_config.coastal_surge_stage_m,
                "delta": round(
                    comp_run.scenario_config.coastal_surge_stage_m
                    - base_run.scenario_config.coastal_surge_stage_m,
                    2,
                ),
            },
        }

        # Spatial GeoJSON Delta Computation
        geojson_delta = self._build_spatial_delta_geojson(
            base_run.geojson_output, comp_run.geojson_output
        )

        delta_area = round(comp_run.inundated_area_sq_km - base_run.inundated_area_sq_km, 2)
        delta_depth = round(comp_run.max_water_depth_m - base_run.max_water_depth_m, 2)
        delta_pop = comp_run.affected_population - base_run.affected_population

        comp_id = f"cmp_{domain}_{int(time.time())}"

        return ScenarioComparisonResult(
            comparison_id=comp_id,
            baseline_run_id=baseline_run_id,
            comparison_run_id=comparison_run_id,
            spatial_domain=domain,
            compared_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            delta_inundated_area_sq_km=delta_area,
            delta_max_depth_m=delta_depth,
            delta_affected_population=delta_pop,
            parameter_differences=param_diffs,
            geojson_delta_output=geojson_delta,
        )

    def _build_spatial_delta_geojson(
        self, base_geojson: Dict[str, Any], comp_geojson: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Constructs spatial depth delta GeoJSON polygons."""
        base_features = base_geojson.get("features", [])
        comp_features = comp_geojson.get("features", [])

        base_map = {}
        for feat in base_features:
            coords = feat.get("geometry", {}).get("coordinates")
            if coords:
                key = str(coords)
                base_map[key] = float(feat.get("properties", {}).get("water_depth_m", 0.0))

        comp_map = {}
        for feat in comp_features:
            coords = feat.get("geometry", {}).get("coordinates")
            if coords:
                key = str(coords)
                comp_map[key] = (feat, float(feat.get("properties", {}).get("water_depth_m", 0.0)))

        delta_features = []
        all_keys = set(base_map.keys()) | set(comp_map.keys())

        for key in all_keys:
            d_base = base_map.get(key, 0.0)
            comp_item = comp_map.get(key)
            d_comp = comp_item[1] if comp_item else 0.0
            delta_d = round(d_comp - d_base, 2)

            if abs(delta_d) < 0.05:
                continue  # Skip negligible deltas

            geom = comp_item[0]["geometry"] if comp_item else None
            if not geom:
                # Find geometry in base features
                for f in base_features:
                    if str(f.get("geometry", {}).get("coordinates")) == key:
                        geom = f["geometry"]
                        break

            if not geom:
                continue

            if delta_d > 0:
                change_type = "INCREASED_INUNDATION"
                color = "#06b6d4"  # Cyan
            else:
                change_type = "REDUCED_INUNDATION"
                color = "#d946ef"  # Magenta

            delta_features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "baseline_depth_m": d_base,
                    "comparison_depth_m": d_comp,
                    "delta_depth_m": delta_d,
                    "change_type": change_type,
                    "fill_color": color,
                },
            })

        return {
            "type": "FeatureCollection",
            "features": delta_features,
            "metadata": {
                "total_delta_features": len(delta_features),
            },
        }


scenario_service = ScenarioService()
