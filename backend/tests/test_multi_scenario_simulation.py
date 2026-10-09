"""
Automated Unit Tests for Multi-Scenario 2D Hydrodynamic Flood Simulation Engine.
Tests parameter validation, 2D fluid mass conservation, scenario execution,
run persistence, and comparative spatial depth delta analysis.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.simulation_scenario import (
    RainfallPattern,
    ScenarioComparisonRequest,
    SimulationScenarioConfig,
)
from app.services.terrain.scenario_service import scenario_service
from app.services.terrain.simulation_engine import simulation_engine

client = TestClient(app)


def test_scenario_config_validation():
    """Verify scenario parameter bounds, unit constraints, and hypothetical disclaimers."""
    config = SimulationScenarioConfig(
        scenario_id="scen_test_validation",
        name="Validation Test Scenario",
        spatial_domain="mumbai",
        rainfall_intensity_mm_h=100.0,
        rainfall_duration_hours=6.0,
        soil_saturation_index=0.80,
        total_duration_hours=12.0,
    )
    assert config.rainfall_intensity_mm_h == 100.0
    assert config.rainfall_duration_hours == 6.0
    assert "hypothetical" in config.hypothetical_disclaimer.lower()

    # Test invalid duration exception
    with pytest.raises(ValueError, match="cannot exceed total simulation duration"):
        SimulationScenarioConfig(
            scenario_id="scen_invalid",
            name="Invalid Duration Scenario",
            spatial_domain="mumbai",
            rainfall_intensity_mm_h=50.0,
            rainfall_duration_hours=12.0,
            total_duration_hours=6.0,
        )


def test_scs_curve_number_runoff_math():
    """Verify SCS Curve Number infiltration and net surface runoff calculations."""
    # Test dry soil (saturation 0.0 -> low runoff)
    total_p, infil_dry, runoff_dry = simulation_engine.calculate_scs_curve_number_runoff(
        rainfall_intensity_mm_h=50.0,
        duration_h=3.0,
        saturation_idx=0.0,
    )
    assert total_p == 150.0
    assert runoff_dry < total_p

    # Test saturated soil (saturation 1.0 -> high runoff)
    _, infil_sat, runoff_sat = simulation_engine.calculate_scs_curve_number_runoff(
        rainfall_intensity_mm_h=50.0,
        duration_h=3.0,
        saturation_idx=1.0,
    )
    assert runoff_sat > runoff_dry
    assert abs((infil_sat + runoff_sat) - total_p) < 0.1  # Mass conservation


def test_2d_hydro_simulation_engine_run():
    """Verify 2D mass-conservative hydro engine execution and output schema."""
    config = SimulationScenarioConfig(
        scenario_id="scen_test_run",
        name="Engine Test Run",
        spatial_domain="mumbai",
        rainfall_intensity_mm_h=75.0,
        rainfall_duration_hours=3.0,
        soil_saturation_index=0.70,
        total_duration_hours=6.0,
    )

    result = simulation_engine.run_simulation(config)
    assert result.run_id.startswith("run_mumbai_scen_test_run_")
    assert result.model_version == "v2.1-2d-storage-cell-hydro"
    assert result.mass_balance_error_pct <= 15.0
    assert result.inundated_area_sq_km >= 0.0
    assert result.max_water_depth_m >= 0.0
    assert len(result.zone_summaries) == 9
    assert result.geojson_output["type"] == "FeatureCollection"


def test_scenario_run_persistence_and_retrieval():
    """Verify scenario execution run is persisted to SQLite cache and retrievable."""
    config = SimulationScenarioConfig(
        scenario_id="scen_test_persist",
        name="Persistence Test Run",
        spatial_domain="patna",
        rainfall_intensity_mm_h=80.0,
        rainfall_duration_hours=4.0,
        soil_saturation_index=0.85,
        total_duration_hours=8.0,
    )

    result = scenario_service.run_scenario(config)
    retrieved = scenario_service.get_run(result.run_id)

    assert retrieved is not None
    assert retrieved.run_id == result.run_id
    assert retrieved.scenario_config.spatial_domain == "patna"
    assert retrieved.inundated_area_sq_km == result.inundated_area_sq_km


def test_scenario_comparison_and_spatial_deltas():
    """Verify comparative spatial depth delta analysis between two scenario runs."""
    config_base = SimulationScenarioConfig(
        scenario_id="scen_base_50mm",
        name="Baseline Scenario (50mm/h)",
        spatial_domain="mumbai",
        rainfall_intensity_mm_h=50.0,
        rainfall_duration_hours=3.0,
        soil_saturation_index=0.60,
        total_duration_hours=6.0,
    )
    config_comp = SimulationScenarioConfig(
        scenario_id="scen_comp_120mm",
        name="Comparison Scenario (120mm/h)",
        spatial_domain="mumbai",
        rainfall_intensity_mm_h=120.0,
        rainfall_duration_hours=3.0,
        soil_saturation_index=0.60,
        total_duration_hours=6.0,
    )

    base_run = scenario_service.run_scenario(config_base)
    comp_run = scenario_service.run_scenario(config_comp)

    cmp_result = scenario_service.compare_scenarios(base_run.run_id, comp_run.run_id)

    assert cmp_result.spatial_domain == "mumbai"
    assert isinstance(cmp_result.delta_inundated_area_sq_km, float)
    assert cmp_result.delta_max_depth_m > 0.0
    assert cmp_result.parameter_differences["rainfall_intensity_mm_h"]["delta"] == 70.0
    assert cmp_result.geojson_delta_output["type"] == "FeatureCollection"


def test_scenario_api_endpoints():
    """Verify scenario API endpoints (presets, run, get, compare)."""
    # 1. Get Presets
    response = client.get("/api/v1/simulation/scenarios/preset-families?domain=mumbai")
    assert response.status_code == 200
    presets = response.json()
    assert len(presets) >= 4
    assert presets[0]["preset_id"] == "preset_moderate_rain"

    # 2. Run Scenario API
    run_payload = {
        "scenario_id": "scen_api_test",
        "name": "API Test Scenario",
        "spatial_domain": "kochi",
        "rainfall_intensity_mm_h": 60.0,
        "rainfall_duration_hours": 2.0,
        "soil_saturation_index": 0.70,
        "total_duration_hours": 6.0,
        "hypothetical_disclaimer": "API Test Notice",
    }
    res_run = client.post("/api/v1/simulation/scenarios/run", json=run_payload)
    assert res_run.status_code == 200
    data_run = res_run.json()
    run_id = data_run["run_id"]
    assert data_run["scenario_config"]["spatial_domain"] == "kochi"

    # 3. Get Stored Run API
    res_get = client.get(f"/api/v1/simulation/scenarios/runs/{run_id}")
    assert res_get.status_code == 200
    assert res_get.json()["run_id"] == run_id

    # 4. Compare Scenarios API
    res_cmp = client.post(
        "/api/v1/simulation/scenarios/compare",
        json={"baseline_run_id": run_id, "comparison_run_id": run_id},
    )
    assert res_cmp.status_code == 200
    assert res_cmp.json()["spatial_domain"] == "kochi"
