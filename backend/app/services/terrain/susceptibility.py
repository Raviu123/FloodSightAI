"""
Multi-criteria GIS terrain flood susceptibility calculation engine.

Evaluates terrain relative to surrounding terrain and hydrological connectivity:
- Validity and water mask (distinguishes valid land from ocean and permanent water)
- Height Above Nearest Drainage (HND)
- Upstream Drainage Area (UPA / Catchment Accumulation)
- Relative elevation (identifies mountain valleys/hollows)
- Physical geodesic terrain slope & drainage
- Coastal lowland exposure

Continuous Score: terrain_susceptibility in [0.0, 1.0] for valid land cells.
Nodata / Ocean cells receive -9999.0.

UI Symbology Tiers:
- LOWER_SUSCEPTIBILITY (green)
- MODERATE_SUSCEPTIBILITY (yellow)
- HIGHER_SUSCEPTIBILITY (red/orange)
- UNASSESSED / MARINE (transparent / no fill)
"""

from __future__ import annotations

import math
from typing import Any, Dict, Tuple

import numpy as np
from scipy.ndimage import uniform_filter

from app.core.config import settings
from app.services.terrain.validity_mask import (
    MASK_LAND,
    MASK_OCEAN,
    MASK_PERMANENT_WATER,
    MASK_UNASSESSED,
    create_validity_mask,
)


def calculate_local_relative_elevation(elevation_grid: np.ndarray, window_size: int = 15) -> np.ndarray:
    """
    Calculates local relative elevation for each cell relative to its surrounding neighborhood:
        relative_elevation = elevation - local_reference_elevation (local mean)

    This ensures mountain valleys (e.g. Himalayas, Western Ghats) with high flow
    accumulation and low local relative elevation are correctly evaluated as high flood susceptibility.
    """
    finite_mask = np.isfinite(elevation_grid) & (elevation_grid > -9000.0)
    clean_elev = np.where(finite_mask, elevation_grid, 0.0)

    # Compute local reference elevation using uniform moving window filter
    local_ref = uniform_filter(clean_elev, size=window_size, mode="reflect")

    # Relative elevation (positive = ridge/peak, negative = valley/hollow)
    rel_elev = clean_elev - local_ref
    return rel_elev.astype(np.float32)


def calculate_terrain_susceptibility(
    elevation_grid: np.ndarray,
    flow_accumulation: np.ndarray | None = None,
    slopes: np.ndarray | None = None,
    hnd: np.ndarray | None = None,
    upa: np.ndarray | None = None,
    weights: dict[str, float] | None = None,
    window_size: int = 15,
    cell_size_m: float = 90.0,
) -> np.ndarray:
    """
    Computes a continuous multi-criteria GIS terrain flood susceptibility score in [0.0, 1.0]
    using fixed global absolute physical scaling to guarantee spatial seamlessness across region boundaries.

    Ocean and nodata pixels receive -9999.0.
    """
    if weights is None:
        weights = {
            "hnd": 0.35,
            "upa": 0.25,
            "flow_acc": settings.TERRAIN_WEIGHT_FLOW_ACC,
            "relative_elev": settings.TERRAIN_WEIGHT_RELATIVE_ELEV,
            "slope": settings.TERRAIN_WEIGHT_SLOPE,
            "water": settings.TERRAIN_WEIGHT_WATER_PROXIMITY,
            "coast": settings.TERRAIN_WEIGHT_COASTAL_EXPOSURE,
        }

    validity_mask = create_validity_mask(elevation_grid, hnd=hnd, upa=upa)
    land_mask = (validity_mask == MASK_LAND) | (validity_mask == MASK_PERMANENT_WATER)

    if not np.any(land_mask):
        return np.full_like(elevation_grid, -9999.0, dtype=np.float32)

    # 1. Local Relative Elevation Score (Absolute range [-15m, +15m])
    rel_elev = calculate_local_relative_elevation(elevation_grid, window_size=window_size)
    # Valleys (negative rel_elev <= -10m) -> 1.0; Ridges (rel_elev >= +10m) -> 0.0
    rel_elev_score = 1.0 - np.clip((rel_elev - (-10.0)) / 20.0, 0.0, 1.0)

    # 2. Height Above Nearest Drainage (HND) Score (Absolute physical scaling)
    if hnd is not None and hnd.shape == elevation_grid.shape:
        hnd_clean = np.where(land_mask & np.isfinite(hnd) & (hnd >= 0.0), hnd, 100.0)
        hnd_score = 1.0 / (1.0 + (hnd_clean / 5.0) ** 2)
    else:
        hnd_score = rel_elev_score

    hnd_score = np.clip(hnd_score, 0.0, 1.0)

    # 3. Upstream Catchment Area (UPA) / Flow Accumulation Score (Absolute log scaling)
    if upa is not None and upa.shape == elevation_grid.shape:
        upa_clean = np.where(land_mask & np.isfinite(upa) & (upa > 0.0), upa, 0.0)
        log_upa = np.log1p(upa_clean)
        # 1000 km² reference max catchment scale
        max_ref_log = np.log1p(1000.0)
        upa_score = np.clip(log_upa / max_ref_log, 0.0, 1.0)
    elif flow_accumulation is not None and flow_accumulation.shape == elevation_grid.shape:
        fa_clean = np.where(land_mask & np.isfinite(flow_accumulation) & (flow_accumulation > 0.0), flow_accumulation, 0.0)
        log_fa = np.log1p(fa_clean)
        max_ref_log = np.log1p(100_000.0)
        upa_score = np.clip(log_fa / max_ref_log, 0.0, 1.0)
    else:
        upa_score = np.power(rel_elev_score, 1.5)

    upa_score = np.clip(upa_score, 0.0, 1.0)

    # 4. Slope Score (Physical geodesic slope angle in degrees)
    if slopes is not None and slopes.shape == elevation_grid.shape:
        slope_clean = np.where(land_mask & np.isfinite(slopes), slopes, 0.0)
        slope_score = 1.0 - np.clip(slope_clean / 25.0, 0.0, 1.0)
    else:
        # Compute physical dz/dx and dz/dy with geodesic cell spacing in meters
        dy, dx = np.gradient(elevation_grid, cell_size_m, cell_size_m)
        grad_mag = np.sqrt(dx**2 + dy**2)
        slope_deg = np.degrees(np.arctan(grad_mag))
        slope_clean = np.where(land_mask, slope_deg, 0.0)
        slope_score = 1.0 - np.clip(slope_clean / 25.0, 0.0, 1.0)

    slope_score = np.clip(slope_score, 0.0, 1.0)

    # 5. Coastal Lowland Exposure Score (Absolute elevation MSL <= 15m)
    coastal_score = np.where(land_mask, np.clip(1.0 - (elevation_grid / 15.0), 0.0, 1.0), 0.0)

    # 6. Water / River Channel Proximity Score
    water_score = np.clip(rel_elev_score * upa_score, 0.0, 1.0)

    # Combine weighted score
    if hnd is not None and upa is not None:
        score = (
            weights.get("hnd", 0.35) * hnd_score
            + weights.get("upa", 0.25) * upa_score
            + weights.get("relative_elev", 0.20) * rel_elev_score
            + weights.get("slope", 0.10) * slope_score
            + weights.get("coast", 0.10) * coastal_score
        )
    else:
        score = (
            weights.get("flow_acc", 0.40) * upa_score
            + weights.get("relative_elev", 0.30) * rel_elev_score
            + weights.get("slope", 0.15) * slope_score
            + weights.get("water", 0.10) * water_score
            + weights.get("coast", 0.05) * coastal_score
        )

    score = np.clip(score, 0.0, 1.0)

    # Mask non-land / ocean / unassessed cells to -9999.0
    score[~land_mask] = -9999.0
    return score.astype(np.float32)


def classify_susceptibility(
    score_grid: np.ndarray,
    lower_thresh: float = 0.35,
    moderate_thresh: float = 0.60,
) -> Tuple[np.ndarray, Dict[str, str]]:
    """
    Classifies continuous susceptibility score into fixed absolute tiers:
    - LOWER_SUSCEPTIBILITY (green): score < 0.35
    - MODERATE_SUSCEPTIBILITY (yellow): 0.35 <= score < 0.60
    - HIGHER_SUSCEPTIBILITY (red/orange): score >= 0.60
    - UNASSESSED (ocean/nodata): score == -9999.0
    """
    labels = np.full(score_grid.shape, "UNASSESSED", dtype=object)

    land_mask = np.isfinite(score_grid) & (score_grid >= 0.0)
    labels[land_mask & (score_grid < lower_thresh)] = "LOWER_SUSCEPTIBILITY"
    labels[land_mask & (score_grid >= lower_thresh) & (score_grid < moderate_thresh)] = "MODERATE_SUSCEPTIBILITY"
    labels[land_mask & (score_grid >= moderate_thresh)] = "HIGHER_SUSCEPTIBILITY"

    color_map = {
        "LOWER_SUSCEPTIBILITY": "#22c55e",
        "MODERATE_SUSCEPTIBILITY": "#eab308",
        "HIGHER_SUSCEPTIBILITY": "#ef4444",
        "UNASSESSED": "transparent",
    }
    return labels, color_map
