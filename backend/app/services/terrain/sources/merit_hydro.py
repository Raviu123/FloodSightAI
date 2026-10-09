"""
MERIT Hydro 3-arcsecond (~90m) Raster Data Source Provider.
Handles on-demand extraction, tile mosaic window slicing, affine transform mapping,
and nodata handling for MERIT Hydro Elevation (elv), Height Above Nearest Drainage (hnd),
and Upstream Drainage Area (upa) GeoTIFF rasters.
"""

from __future__ import annotations

import math
import os
import tarfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
DATA_DIR = REPO_ROOT / "data" / "merit_hydro"
MERIT_COVERAGE_BBOX = [60.0, 0.0, 90.0, 30.0]  # West, South, East, North for n00e060 group


def get_merit_tile_id(lat: float, lon: float) -> str:
    """Returns MERIT Hydro 5x5 degree tile ID string (e.g. n15e070 for lat 18.9N, lon 72.8E)."""
    lat_block = int(math.floor(lat / 5.0) * 5)
    lon_block = int(math.floor(lon / 5.0) * 5)
    ns = f"n{lat_block:02d}" if lat_block >= 0 else f"s{-lat_block:02d}"
    ew = f"e{lon_block:03d}" if lon_block >= 0 else f"w{-lon_block:03d}"
    return f"{ns}{ew}"


def ensure_merit_tile_extracted(tile_id: str, indicator: str) -> Optional[Path]:
    """
    On-demand extracts a single tile (e.g. n15e070_elv.tif) from indicator archive tar file
    (elv_n00e060.tar, hnd_n00e060.tar, upa_n00e060.tar) into data/merit_hydro/.
    """
    folder_name = f"{indicator}_n00e060"
    target_dir = DATA_DIR / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{tile_id}_{indicator}.tif"
    target_path = target_dir / filename
    if target_path.exists() and target_path.stat().st_size > 1000:
        return target_path

    tar_path = REPO_ROOT / "data" / f"{folder_name}.tar"
    if not tar_path.exists():
        tar_path = REPO_ROOT / f"{folder_name}.tar"
        if not tar_path.exists():
            return None

    try:
        with tarfile.open(tar_path, "r") as tar:
            member_name = f"{folder_name}/{filename}"
            member = tar.getmember(member_name)
            tar.extract(member, path=DATA_DIR)
            if target_path.exists():
                return target_path
    except Exception as error:
        print(f"Warning: Failed to extract MERIT Hydro tile {filename}: {error}")

    return None


def read_geotiff_tile(tile_path: Path) -> Tuple[np.ndarray, float, float, float, float]:
    """
    Reads GeoTIFF raster matrix and extracts geographic bounds [west, south, east, north].
    Returns (raster_array, west, south, east, north).
    """
    img = Image.open(tile_path)
    arr = np.array(img, dtype=np.float32)

    tag_info = getattr(img, "tag_v2", {})
    # ModelPixelScaleTag (33550): (scale_x, scale_y, scale_z)
    # ModelTiepointTag (33922): (i, j, k, x, y, z)
    scale = tag_info.get(33550, (0.0008333333333333334, 0.0008333333333333334, 0.0))
    tiepoint = tag_info.get(33922, (0.0, 0.0, 0.0, 0.0, 0.0, 0.0))

    dx, dy = scale[0], scale[1]
    west = tiepoint[3]
    north = tiepoint[4]
    east = west + arr.shape[1] * dx
    south = north - arr.shape[0] * dy

    return arr, west, south, east, north


def is_bbox_in_merit_coverage(bbox: list[float]) -> bool:
    """Returns True if requested bbox is contained within the n00e060 MERIT Hydro coverage."""
    west, south, east, north = bbox
    return (
        MERIT_COVERAGE_BBOX[0] <= west <= MERIT_COVERAGE_BBOX[2]
        and MERIT_COVERAGE_BBOX[0] <= east <= MERIT_COVERAGE_BBOX[2]
        and MERIT_COVERAGE_BBOX[1] <= south <= MERIT_COVERAGE_BBOX[3]
        and MERIT_COVERAGE_BBOX[1] <= north <= MERIT_COVERAGE_BBOX[3]
    )


def load_merit_hydro_indicator_window(
    bbox: list[float], indicator: str, buffer_cells: int = 0
) -> Optional[np.ndarray]:
    """
    Extracts high-resolution window matrix for requested bounding box [west, south, east, north]
    for the specified indicator ('elv', 'hnd', or 'upa'), optionally padded with buffer_cells.
    Seamlessly stitches across 5x5 MERIT tile boundaries if requested bbox spans multiple tiles.
    """
    west, south, east, north = bbox

    min_lat_block = int(math.floor(south / 5.0) * 5)
    max_lat_block = int(math.floor((north - 1e-9) / 5.0) * 5)
    min_lon_block = int(math.floor(west / 5.0) * 5)
    max_lon_block = int(math.floor((east - 1e-9) / 5.0) * 5)

    lat_blocks = list(range(max_lat_block, min_lat_block - 5, -5))
    lon_blocks = list(range(min_lon_block, max_lon_block + 5, 5))

    row_mosaics = []
    top_north, left_west, bottom_south, right_east = None, None, None, None

    for row_idx, lat_b in enumerate(lat_blocks):
        col_rasters = []
        for col_idx, lon_b in enumerate(lon_blocks):
            tile_id = get_merit_tile_id(lat_b + 2.5, lon_b + 2.5)
            tile_path = ensure_merit_tile_extracted(tile_id, indicator)
            if not tile_path:
                return None
            arr, t_w, t_s, t_e, t_n = read_geotiff_tile(tile_path)
            col_rasters.append(arr)
            if row_idx == 0 and col_idx == 0:
                top_north = t_n
                left_west = t_w
            if row_idx == len(lat_blocks) - 1 and col_idx == len(lon_blocks) - 1:
                bottom_south = t_s
                right_east = t_e
        if len(col_rasters) == 1:
            row_mosaics.append(col_rasters[0])
        else:
            row_mosaics.append(np.hstack(col_rasters))

    if len(row_mosaics) == 1:
        stitched = row_mosaics[0]
    else:
        stitched = np.vstack(row_mosaics)

    m_west = left_west
    m_east = right_east
    m_south = bottom_south
    m_north = top_north

    rows, cols = stitched.shape
    d_lon = (m_east - m_west) / cols
    d_lat = (m_north - m_south) / rows

    col_start = max(0, int(math.floor((west - m_west) / d_lon)) - buffer_cells)
    col_end = min(cols, int(math.ceil((east - m_west) / d_lon)) + buffer_cells)
    row_start = max(0, int(math.floor((m_north - north) / d_lat)) - buffer_cells)
    row_end = min(rows, int(math.ceil((m_north - south) / d_lat)) + buffer_cells)

    window = stitched[row_start:row_end, col_start:col_end]
    if window.size == 0:
        return None

    return window


def get_merit_hydro_window(
    bbox: list[float],
    buffer_cells: int = 0,
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[np.ndarray], dict[str, Any]]:
    """
    Retrieves (elv, hnd, upa, metadata) for requested bounding box [west, south, east, north].
    Returns (None, None, None, metadata) if area is outside MERIT Hydro n00e060 coverage.
    """
    if not is_bbox_in_merit_coverage(bbox):
        return None, None, None, {"is_merit_hydro": False, "reason": "Outside n00e060 coverage bounds"}

    elv = load_merit_hydro_indicator_window(bbox, "elv", buffer_cells=buffer_cells)
    hnd = load_merit_hydro_indicator_window(bbox, "hnd", buffer_cells=buffer_cells)
    upa = load_merit_hydro_indicator_window(bbox, "upa", buffer_cells=buffer_cells)

    if elv is None or hnd is None or upa is None:
        return None, None, None, {"is_merit_hydro": False, "reason": "Failed to load tile files"}

    metadata = {
        "is_merit_hydro": True,
        "source": "MERIT Hydro 3-arcsecond (~90m)",
        "indicators_available": ["elv", "hnd", "upa"],
        "resolution_m": 90.0,
        "crs": "EPSG:4326 (WGS84)",
        "nodata_value": -9999.0,
        "buffer_cells": buffer_cells,
    }

    return elv, hnd, upa, metadata
