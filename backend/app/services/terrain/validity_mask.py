"""
Validity & Water Mask Pipeline for MERIT Hydro & Terrain Analysis.

Classifies every raster cell into explicit spatial categories:
- MASK_UNASSESSED (-1): Nodata (-9999.0) or missing elevation/hydrological data.
- MASK_OCEAN (0): Sea / Marine offshore water cells (elv <= 0.0 & HND <= 0.0 & UPA <= 0.1 km²).
- MASK_LAND (1): Valid land cells (elv > 0.0 MSL, OR low-lying below-sea-level land with HND > 0.0 like Kuttanad Kerala).
- MASK_PERMANENT_WATER (2): Inland permanent water channels / lakes (land cells where HND <= 0.1m & UPA > 10.0 km²).
"""

from __future__ import annotations

import numpy as np

# Mask Constants
MASK_UNASSESSED: int = -1
MASK_OCEAN: int = 0
MASK_LAND: int = 1
MASK_PERMANENT_WATER: int = 2


def create_validity_mask(
    elv: np.ndarray,
    hnd: np.ndarray | None = None,
    upa: np.ndarray | None = None,
    sea_level_threshold: float = 0.0,
) -> np.ndarray:
    """
    Constructs an explicit validity and water mask array for a given elevation raster.

    Preserves valid low-lying coastal land and below-sea-level terrain (e.g. Kuttanad Kerala,
    polders) when HND > 0.0 or catchment context exists, avoiding false ocean classification.

    Args:
        elv: Elevation matrix (meters MSL).
        hnd: Height Above Nearest Drainage matrix (meters), optional.
        upa: Upstream Drainage Area matrix (km² or m²), optional.
        sea_level_threshold: Reference cutoff elevation for ocean cells (default 0.0m MSL).

    Returns:
        np.ndarray of int8 values corresponding to MASK_* constants.
    """
    mask = np.full(elv.shape, MASK_UNASSESSED, dtype=np.int8)

    # Valid finite elevation mask (> -9000.0 excludes MERIT nodata -9999.0)
    finite_elv = np.isfinite(elv) & (elv > -9000.0)
    nodata_mask = ~finite_elv

    # Missing / Nodata cells strictly receive MASK_UNASSESSED
    mask[nodata_mask] = MASK_UNASSESSED

    if not np.any(finite_elv):
        return mask

    # 1. Identify Ocean / Marine Offshore Cells
    # Requires elevation <= sea_level_threshold AND HND <= 0.0 AND UPA <= 0.1 km² (offshore sea)
    if hnd is not None and upa is not None:
        finite_hnd = np.isfinite(hnd) & (hnd > -9000.0)
        finite_upa = np.isfinite(upa) & (upa > -9000.0)
        
        ocean_cond = finite_elv & (elv <= sea_level_threshold) & (
            (~finite_hnd) | (hnd <= 0.0)
        ) & (
            (~finite_upa) | (upa <= 0.1)
        )
    elif hnd is not None:
        finite_hnd = np.isfinite(hnd) & (hnd > -9000.0)
        ocean_cond = finite_elv & (elv <= sea_level_threshold) & ((~finite_hnd) | (hnd <= 0.0))
    else:
        # Fallback elevation only: elv <= -2.0m offshore
        ocean_cond = finite_elv & (elv <= (sea_level_threshold - 2.0))

    mask[ocean_cond] = MASK_OCEAN

    # 2. Identify Valid Land Cells
    # Land includes:
    # a) All elevation > 0.0m MSL
    # b) Below-sea-level land (elv <= 0.0m MSL) where HND > 0.0 (e.g. Kuttanad -1.5m MSL) or UPA > 0.1 km²
    land_cond = finite_elv & (~ocean_cond)
    mask[land_cond] = MASK_LAND

    # 3. Identify Inland Permanent Water Channels / Lakes
    if hnd is not None and upa is not None:
        finite_hnd = np.isfinite(hnd) & (hnd > -9000.0)
        finite_upa = np.isfinite(upa) & (upa > -9000.0)
        # Permanent river channels / lakes: land cells with HND <= 0.1m and high upstream area (>10.0 km²)
        water_cond = land_cond & finite_hnd & finite_upa & (hnd <= 0.1) & (upa > 10.0)
        mask[water_cond] = MASK_PERMANENT_WATER

    return mask
