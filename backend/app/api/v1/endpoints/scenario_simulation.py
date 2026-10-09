"""
API Endpoint Router for Multi-Scenario 2D Hydrodynamic Flood Simulation.
Supports running custom scenarios, fetching preset families, retrieving stored runs,
and comparing scenario deltas.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.simulation_scenario import (
    ScenarioComparisonRequest,
    ScenarioComparisonResult,
    ScenarioPreset,
    ScenarioRunResult,
    SimulationScenarioConfig,
)
from app.services.terrain.scenario_service import scenario_service

router = APIRouter()


@router.get("/preset-families", response_model=List[ScenarioPreset], summary="Get Preset Scenario Families")
def get_preset_scenario_families(
    domain: str = Query("mumbai", min_length=2, max_length=64, description="Spatial region domain")
):
    """
    Returns standard pre-configured scenario families (e.g. Moderate Rain, Extreme Cloudburst,
    Saturated Runoff, Compound Storm Surge) for comparative testing.
    """
    return scenario_service.get_preset_families(spatial_domain=domain)


@router.post("/run", response_model=ScenarioRunResult, summary="Run 2D Hydrodynamic Scenario Simulation")
def run_scenario_simulation(config: SimulationScenarioConfig):
    """
    Executes a cell-based 2D mass-conservative hydrodynamic flood simulation for the requested scenario.
    Calculates SCS Curve Number infiltration, 2D surface runoff routing, dynamic water depth d(x,y,t),
    inundation extent, and arrival times.
    """
    try:
        return scenario_service.run_scenario(config)
    except KeyError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Simulation failed: {error}") from error


@router.get("/runs/{run_id}", response_model=ScenarioRunResult, summary="Retrieve Stored Scenario Run Result")
def get_stored_scenario_run(run_id: str):
    """
    Retrieves a previously executed and stored scenario run by unique run_id.
    """
    run_result = scenario_service.get_run(run_id)
    if not run_result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scenario run '{run_id}' not found")
    return run_result


@router.post("/compare", response_model=ScenarioComparisonResult, summary="Compare Two Scenario Runs")
def compare_scenarios(request: ScenarioComparisonRequest):
    """
    Computes comparative spatial depth delta analysis ($\Delta d(x,y) = d_{comp} - d_{base}$)
    and parameter difference metrics between a baseline run and counterfactual comparison run.
    """
    try:
        return scenario_service.compare_scenarios(request.baseline_run_id, request.comparison_run_id)
    except KeyError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Comparison failed: {error}") from error
