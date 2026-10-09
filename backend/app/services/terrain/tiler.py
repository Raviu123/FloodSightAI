"""
Web Mercator Tile Renderer for Terrain Flood Susceptibility Map ({z}/{x}/{y}.png).
Generates 256x256 RGBA PNG tiles dynamically for MapLibre GL raster layers.
"""

from __future__ import annotations

import io
import math
from typing import Tuple

import numpy as np
from PIL import Image

from app.services.terrain.sources.hydrosheds import HydroSHEDS_DEMSource, HydroSHEDS_FlowAccSource
from app.services.terrain.sources.merit_hydro import get_merit_hydro_window
from app.services.terrain.susceptibility import calculate_terrain_susceptibility

TILE_SIZE = 256
_TILE_CACHE: dict[Tuple[int, int, int, str], bytes] = {}
_MAX_TILE_CACHE_SIZE = 128


def tile_to_bbox(z: int, x: int, y: int) -> list[float]:
    """Converts Web Mercator tile (z, x, y) to WGS84 bounding box [west, south, east, north]."""
    n = 2.0**z
    west = x / n * 360.0 - 180.0
    east = (x + 1) / n * 360.0 - 180.0

    north_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * y / n)))
    south_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (y + 1) / n)))

    north = math.degrees(north_rad)
    south = math.degrees(south_rad)

    return [west, south, east, north]


async def render_terrain_tile(z: int, x: int, y: int, mode: str = "susceptibility") -> bytes:
    """
    Renders a 256x256 RGBA PNG tile for tile coordinates (z, x, y).
    """
    cache_key = (z, x, y, mode)
    if cache_key in _TILE_CACHE:
        return _TILE_CACHE[cache_key]

    bbox = tile_to_bbox(z, x, y)
    m_elv, m_hnd, m_upa, _ = get_merit_hydro_window(bbox)
    if m_elv is not None and m_hnd is not None and m_upa is not None:
        susceptibility = calculate_terrain_susceptibility(m_elv, hnd=m_hnd, upa=m_upa)
    else:
        dem_source = HydroSHEDS_DEMSource()
        fa_source = HydroSHEDS_FlowAccSource()

        # Determine resolution scale based on zoom level
        res_m = max(30.0, 450.0 / (2.0 ** max(0, z - 4)))
        dem, _ = await dem_source.get_elevation_window(bbox, resolution_m=res_m)
        fa = await fa_source.get_flow_accumulation(bbox, target_shape=dem.shape)
        susceptibility = calculate_terrain_susceptibility(dem, flow_accumulation=fa)

    # Resize susceptibility grid to 256x256 PNG canvas
    if susceptibility.shape != (TILE_SIZE, TILE_SIZE):
        img_raw = Image.fromarray(susceptibility)
        resampled_img = img_raw.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.BILINEAR)
        score_grid = np.array(resampled_img, dtype=np.float32)
    else:
        score_grid = susceptibility

    # Construct RGBA pixel matrix (256, 256, 4)
    rgba = np.zeros((TILE_SIZE, TILE_SIZE, 4), dtype=np.uint8)

    valid_mask = (score_grid >= 0.0) & (score_grid <= 1.0)

    # 🟢 LOWER_SUSCEPTIBILITY (< 0.33) -> #22c55e (rgba(34, 197, 94, 115))
    lower_mask = valid_mask & (score_grid < 0.33)
    rgba[lower_mask] = [34, 197, 94, 115]

    # 🟡 MODERATE_SUSCEPTIBILITY (0.33 - 0.67) -> #eab308 (rgba(234, 179, 8, 140))
    mod_mask = valid_mask & (score_grid >= 0.33) & (score_grid < 0.67)
    rgba[mod_mask] = [234, 179, 8, 140]

    # 🔴 HIGHER_SUSCEPTIBILITY (>= 0.67) -> #ef4444 (rgba(239, 68, 68, 165))
    high_mask = valid_mask & (score_grid >= 0.67)
    rgba[high_mask] = [239, 68, 68, 165]

    png_image = Image.fromarray(rgba, mode="RGBA")
    buffer = io.BytesIO()
    png_image.save(buffer, format="PNG", optimize=True)
    png_bytes = buffer.getvalue()

    if len(_TILE_CACHE) >= _MAX_TILE_CACHE_SIZE:
        _TILE_CACHE.pop(next(iter(_TILE_CACHE)))
    _TILE_CACHE[cache_key] = png_bytes

    return png_bytes
