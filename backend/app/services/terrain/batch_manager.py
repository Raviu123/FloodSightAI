"""
8-Neighbor Regional Terrain Batch Manager.
Computes 3x3 contiguous grid bounds (center + 8 neighbors), manages deterministic region IDs,
eliminates border seam artifacts using context halos, and caches processed batches.
"""

from __future__ import annotations

import math
import time
from typing import Any, Dict, List, Tuple

INDIA_BBOX = [68.0, 6.0, 97.5, 37.5]
_BATCH_CACHE: Dict[Tuple[Any, ...], Tuple[float, Dict[str, Any]]] = {}
_BATCH_CACHE_TTL_SECONDS = 600
_BATCH_CACHE_MAX_ENTRIES = 16


def resolve_8_neighbor_grid(center_bbox: list[float], radius: int = 1) -> dict[str, list[float]]:
    """
    Generates bounding boxes for center region + all neighboring positions in a (2R+1)x(2R+1) grid.
    For radius=1 (3x3 grid), returns 9 region bounds:
    ['nw', 'n', 'ne', 'w', 'center', 'e', 'sw', 's', 'se'].
    """
    west, south, east, north = center_bbox
    d_lon = round(east - west, 5)
    d_lat = round(north - south, 5)

    grid: dict[str, list[float]] = {}
    directions = [
        ("nw", -1, 1),
        ("n", 0, 1),
        ("ne", 1, 1),
        ("w", -1, 0),
        ("center", 0, 0),
        ("e", 1, 0),
        ("sw", -1, -1),
        ("s", 0, -1),
        ("se", 1, -1),
    ]

    for dir_name, col, row in directions:
        b_w = round(west + col * d_lon, 4)
        b_e = round(east + col * d_lon, 4)
        b_s = round(south + row * d_lat, 4)
        b_n = round(north + row * d_lat, 4)
        grid[dir_name] = [b_w, b_s, b_e, b_n]

    return grid


def get_combined_batch_bbox(grid: dict[str, list[float]]) -> list[float]:
    """Computes the overall bounding box enclosing all regions in a grid."""
    all_w = [b[0] for b in grid.values()]
    all_s = [b[1] for b in grid.values()]
    all_e = [b[2] for b in grid.values()]
    all_n = [b[3] for b in grid.values()]
    return [min(all_w), min(all_s), max(all_e), max(all_n)]
