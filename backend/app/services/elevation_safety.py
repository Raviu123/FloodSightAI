"""Elevation-only safety regions for a selected FloodSight region."""

from __future__ import annotations

import asyncio
import io
import json
import os
from pathlib import Path
import sqlite3
import math
import time
from collections import deque
from typing import Any

import httpx
import numpy as np
from PIL import Image

from app.services.terrain.batch_manager import get_combined_batch_bbox, resolve_8_neighbor_grid
from app.services.terrain.sources.merit_hydro import get_merit_hydro_window
from app.services.terrain.susceptibility import calculate_terrain_susceptibility

TILE_SIZE = 256
DEFAULT_ZOOM = 14
DEFAULT_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

# These extents are analysis windows for the existing region selector, not flood boundaries.
REGION_EXTENTS: dict[str, dict[str, Any]] = {
    "mangalore": {"name": "Mangalore Estuary", "bbox": [74.79, 12.81, 74.89, 12.91]},
    "kochi": {"name": "Kochi Backwaters", "bbox": [76.21, 9.92, 76.32, 10.01]},
    "chennai": {"name": "Chennai Delta", "bbox": [80.19, 12.96, 80.32, 13.08]},
    "mumbai": {"name": "Mumbai Coastal Bay", "bbox": [72.77, 18.94, 72.91, 19.08]},
    "kolkata": {"name": "Kolkata Hooghly Delta", "bbox": [88.26, 22.45, 88.46, 22.65]},
    "guwahati": {"name": "Guwahati Brahmaputra Valley", "bbox": [91.63, 26.05, 91.83, 26.25]},
    "patna": {"name": "Patna Gangetic Plain", "bbox": [85.03, 25.50, 85.23, 25.70]},
    "surat": {"name": "Surat Tapi Estuary", "bbox": [72.73, 21.07, 72.93, 21.27]},
    "visakhapatnam": {"name": "Visakhapatnam Bay", "bbox": [83.11, 17.58, 83.31, 17.78]},
    "srinagar": {"name": "Srinagar Jhelum Basin", "bbox": [74.70, 33.98, 74.90, 34.18]},
    "cuttack": {"name": "Cuttack Mahanadi Delta", "bbox": [85.78, 20.36, 85.98, 20.56]},
    "bengaluru": {"name": "Bengaluru Basin", "bbox": [77.49, 12.87, 77.69, 13.07]},
    "ahmedabad": {"name": "Ahmedabad Sabarmati Basin", "bbox": [72.48, 22.92, 72.68, 23.12]},
    "vijayawada": {"name": "Vijayawada Krishna Delta", "bbox": [80.52, 16.41, 80.72, 16.61]},
}

_CACHE: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 3600
_CACHE_MAX_ENTRIES = 512
_COMPUTATION_LOCKS: dict[tuple[Any, ...], asyncio.Lock] = {}

CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = CACHE_DIR / "elevation_cache.db"


def _init_disk_cache() -> None:
    try:
        with sqlite3.connect(str(DB_PATH), timeout=10.0) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS elevation_cache (
                    cache_key TEXT PRIMARY KEY,
                    geojson TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            conn.commit()
    except Exception:
        pass


_init_disk_cache()


def _tile_x(longitude: float, zoom: int) -> float:
    return (longitude + 180.0) / 360.0 * (2**zoom)


def _tile_y(latitude: float, zoom: int) -> float:
    latitude = max(-85.05112878, min(85.05112878, latitude))
    latitude_radians = math.radians(latitude)
    return (1.0 - math.asinh(math.tan(latitude_radians)) / math.pi) / 2.0 * (2**zoom)


def _terrarium_elevation(image_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    red, green, blue = (np.asarray(image, dtype=np.float32)[:, :, index] for index in range(3))
    return red * 256.0 + green + blue / 256.0 - 32768.0


async def _load_elevation_window(
    bbox: list[float],
    tile_url: str,
    zoom: int,
) -> np.ndarray:
    west, south, east, north = bbox
    min_tile_x = max(0, math.floor(_tile_x(west, zoom)))
    max_tile_x = max(0, math.floor(_tile_x(east, zoom)))
    min_tile_y = max(0, math.floor(_tile_y(north, zoom)))
    max_tile_y = max(0, math.floor(_tile_y(south, zoom)))

    mosaic = np.full(
        ((max_tile_y - min_tile_y + 1) * TILE_SIZE, (max_tile_x - min_tile_x + 1) * TILE_SIZE),
        np.nan,
        dtype=np.float32,
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        async def _fetch_tile(tx: int, ty: int) -> tuple[int, int, np.ndarray]:
            url = tile_url.format(z=zoom, x=tx, y=ty)
            response = await client.get(url)
            response.raise_for_status()
            tile = _terrarium_elevation(response.content)
            ys = (ty - min_tile_y) * TILE_SIZE
            xs = (tx - min_tile_x) * TILE_SIZE
            return ys, xs, tile

        tasks = [
            _fetch_tile(tile_x, tile_y)
            for tile_y in range(min_tile_y, max_tile_y + 1)
            for tile_x in range(min_tile_x, max_tile_x + 1)
        ]
        fetched_tiles = await asyncio.gather(*tasks)
        for y_start, x_start, tile in fetched_tiles:
            mosaic[y_start : y_start + TILE_SIZE, x_start : x_start + TILE_SIZE] = tile

    left = max(0, math.floor(_tile_x(west, zoom) * TILE_SIZE - min_tile_x * TILE_SIZE))
    right = min(mosaic.shape[1], math.ceil(_tile_x(east, zoom) * TILE_SIZE - min_tile_x * TILE_SIZE))
    top = max(0, math.floor(_tile_y(north, zoom) * TILE_SIZE - min_tile_y * TILE_SIZE))
    bottom = min(mosaic.shape[0], math.ceil(_tile_y(south, zoom) * TILE_SIZE - min_tile_y * TILE_SIZE))
    window = mosaic[top:bottom, left:right]

    if window.size == 0 or not np.isfinite(window).any():
        raise ValueError("The DEM provider returned no elevation data for this region")
    return window


def _downsample(values: np.ndarray, max_dimension: int = 192) -> np.ndarray:
    factor = max(1, math.ceil(max(values.shape) / max_dimension))
    rows = values.shape[0] // factor
    columns = values.shape[1] // factor
    trimmed = values[: rows * factor, : columns * factor]
    blocks = trimmed.reshape(rows, factor, columns, factor)
    return np.nanmean(blocks, axis=(1, 3))


def _components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    visited = np.zeros(mask.shape, dtype=bool)
    found: list[list[tuple[int, int]]] = []
    rows, columns = mask.shape

    for row in range(rows):
        for column in range(columns):
            if not mask[row, column] or visited[row, column]:
                continue
            queue = deque([(row, column)])
            visited[row, column] = True
            component: list[tuple[int, int]] = []
            while queue:
                current_row, current_column = queue.popleft()
                component.append((current_row, current_column))
                for next_row, next_column in (
                    (current_row - 1, current_column),
                    (current_row + 1, current_column),
                    (current_row, current_column - 1),
                    (current_row, current_column + 1),
                ):
                    if (
                        0 <= next_row < rows
                        and 0 <= next_column < columns
                        and mask[next_row, next_column]
                        and not visited[next_row, next_column]
                    ):
                        visited[next_row, next_column] = True
                        queue.append((next_row, next_column))
            found.append(component)
    return found


def _component_boundary(component: set[tuple[int, int]]) -> list[tuple[int, int]]:
    edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()
    for row, column in component:
        cell_edges = [
            ((row, column), (row, column + 1)),
            ((row, column + 1), (row + 1, column + 1)),
            ((row + 1, column + 1), (row + 1, column)),
            ((row + 1, column), (row, column)),
        ]
        for edge in cell_edges:
            reverse = (edge[1], edge[0])
            if reverse in edges:
                edges.remove(reverse)
            else:
                edges.add(edge)

    if not edges:
        return []

    outgoing: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for start_pt, end_pt in edges:
        outgoing.setdefault(start_pt, []).append(end_pt)

    # Find top-leftmost vertex guaranteed to lie on the exterior boundary ring
    min_cell = min(component, key=lambda c: (c[0], c[1]))
    start = (min_cell[0], min_cell[1])

    if start not in outgoing:
        start = next(iter(edges))[0]

    boundary = [start]
    current = start
    visited_edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()

    while True:
        options = outgoing.get(current, [])
        next_point = None
        for opt in options:
            if (current, opt) not in visited_edges:
                next_point = opt
                break
        if not next_point:
            break
        visited_edges.add((current, next_point))
        boundary.append(next_point)
        current = next_point
        if current == start:
            break

    if len(boundary) < 4 or boundary[-1] != start:
        return []

    # Simplify collinear points along straight grid lines
    simplified = [boundary[0]]
    for i in range(1, len(boundary) - 1):
        prev_pt = simplified[-1]
        curr_pt = boundary[i]
        next_pt = boundary[i + 1]
        # Check collinearity: (y2-y1)*(x3-x2) == (x2-x1)*(y3-y2)
        if (curr_pt[0] - prev_pt[0]) * (next_pt[1] - curr_pt[1]) == (curr_pt[1] - prev_pt[1]) * (next_pt[0] - curr_pt[0]):
            continue
        simplified.append(curr_pt)
    simplified.append(start)

    return simplified


def _to_geojson_polygon(
    boundary: list[tuple[int, int]],
    bbox: list[float],
    rows: int,
    columns: int,
) -> list[list[list[float]]]:
    west, south, east, north = bbox
    coordinates = []
    for row, column in boundary:
        longitude = west + (column / columns) * (east - west)
        latitude = north - (row / rows) * (north - south)
        coordinates.append([round(longitude, 7), round(latitude, 7)])
    return [coordinates]


def _get_cached_entry(key: tuple[Any, ...]) -> tuple[dict[str, Any], bool, str] | None:
    now_mon = time.monotonic()
    entry = _CACHE.get(key)
    if entry:
        created_at, value = entry
        if now_mon - created_at <= _CACHE_TTL_SECONDS:
            res = dict(value)
            res["metadata"] = dict(value.get("metadata", {}))
            res["metadata"]["cache_hit"] = True
            res["metadata"]["cache_source"] = "memory"
            return res, True, "memory"
        else:
            _CACHE.pop(key, None)

    # Disk SQLite check
    key_str = json.dumps(key, sort_keys=True)
    try:
        with sqlite3.connect(str(DB_PATH), timeout=5.0) as conn:
            cursor = conn.execute("SELECT geojson, created_at FROM elevation_cache WHERE cache_key = ?", (key_str,))
            row = cursor.fetchone()
            if row:
                geojson_str, disk_created_at = row
                if time.time() - disk_created_at <= 86400:  # 24h disk TTL
                    data = json.loads(geojson_str)
                    _CACHE[key] = (now_mon, data)
                    res = dict(data)
                    res["metadata"] = dict(data.get("metadata", {}))
                    res["metadata"]["cache_hit"] = True
                    res["metadata"]["cache_source"] = "disk"
                    return res, True, "disk"
                else:
                    conn.execute("DELETE FROM elevation_cache WHERE cache_key = ?", (key_str,))
                    conn.commit()
    except Exception:
        pass

    return None


def _store_cached_entry(key: tuple[Any, ...], value: dict[str, Any]) -> None:
    now_mon = time.monotonic()
    if len(_CACHE) >= _CACHE_MAX_ENTRIES:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[key] = (now_mon, value)

    try:
        key_str = json.dumps(key, sort_keys=True)
        geojson_str = json.dumps(value)
        with sqlite3.connect(str(DB_PATH), timeout=5.0) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO elevation_cache (cache_key, geojson, created_at) VALUES (?, ?, ?)",
                (key_str, geojson_str, time.time()),
            )
            conn.commit()
    except Exception:
        pass


def _cached(key: tuple[Any, ...]) -> dict[str, Any] | None:
    res = _get_cached_entry(key)
    return res[0] if res else None


async def generate_elevation_safety(
    region_id: str,
    minimum_feature_width_m: float = 20.0,
    minimum_hotspot_area_m2: float = 400.0,
    danger_percentile: float = 33.0,
    safe_percentile: float = 67.0,
    tile_url: str = DEFAULT_TILE_URL,
    zoom: int = DEFAULT_ZOOM,
) -> dict[str, Any]:
    normalized_region = region_id.strip().lower()
    directions = ["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"]
    
    if normalized_region in REGION_EXTENTS:
        region = REGION_EXTENTS[normalized_region]
        bbox = region["bbox"]
        region_name = region["name"]
    else:
        target_dir = None
        parent_key = None
        for dir_name in directions:
            suffix = f"_{dir_name}"
            if normalized_region.endswith(suffix):
                possible_parent = normalized_region[:-len(suffix)]
                if possible_parent in REGION_EXTENTS:
                    parent_key = possible_parent
                    target_dir = dir_name
                    break
        if parent_key and target_dir:
            parent_region = REGION_EXTENTS[parent_key]
            grid = resolve_8_neighbor_grid(parent_region["bbox"], radius=1)
            bbox = grid[target_dir]
            region_name = f"{parent_region['name']} ({target_dir.upper()})"
        else:
            raise KeyError(f"Region '{region_id}' is not available for elevation analysis")

    if not 0 < danger_percentile < safe_percentile < 100:
        raise ValueError("Percentiles must satisfy 0 < danger_percentile < safe_percentile < 100")

    cache_key = (
        "merit_v2.1",
        normalized_region,
        round(minimum_feature_width_m, 1),
        round(minimum_hotspot_area_m2, 1),
        round(danger_percentile, 1),
        round(safe_percentile, 1),
        tile_url,
        zoom,
    )
    cached = _get_cached_entry(cache_key)
    if cached:
        return cached[0]

    lock = _COMPUTATION_LOCKS.setdefault(cache_key, asyncio.Lock())
    async with lock:
        cached_second_check = _get_cached_entry(cache_key)
        if cached_second_check:
            return cached_second_check[0]

        # Extract DEM window with 15-cell border context buffer to eliminate edge reflection artifacts
        buf = 15
        m_elv, m_hnd, m_upa, m_meta = get_merit_hydro_window(bbox, buffer_cells=buf)
        if m_elv is not None and m_hnd is not None and m_upa is not None and m_elv.shape[0] > 2 * buf and m_elv.shape[1] > 2 * buf:
            s_buf = calculate_terrain_susceptibility(m_elv, hnd=m_hnd, upa=m_upa)
            raw = m_elv[buf:-buf, buf:-buf]
            hnd_vals = m_hnd[buf:-buf, buf:-buf]
            upa_vals = m_upa[buf:-buf, buf:-buf]
            susceptibility = s_buf[buf:-buf, buf:-buf]
            source_name = "MERIT Hydro 3-arcsecond (~90m)"
            indicators_used = ["elv", "hnd", "upa", "slope", "relative_elev"]
            nominal_res_m = 90
        else:
            raw = await _load_elevation_window(bbox, tile_url, zoom)
            hnd_vals = None
            upa_vals = None
            susceptibility = calculate_terrain_susceptibility(raw)
            source_name = "AWS Open Data Terrain Tiles / Mapzen Terrarium / SRTM (Fallback)"
            indicators_used = ["elv", "slope", "relative_elev"]
            nominal_res_m = 30

        values = _downsample(raw)
        scores = _downsample(susceptibility)

        land_mask = np.isfinite(scores) & (scores >= 0.0)
        if not np.any(land_mask):
            result = {
                "type": "FeatureCollection",
                "features": [],
                "metadata": {
                    "region_id": normalized_region,
                    "region_name": region_name,
                    "classification_basis": "multi-criteria GIS terrain flood susceptibility",
                    "danger_percentile": danger_percentile,
                    "safe_percentile": safe_percentile,
                    "minimum_feature_width_m": minimum_feature_width_m,
                    "minimum_hotspot_area_m2": minimum_hotspot_area_m2,
                    "source": source_name,
                    "indicators_used": indicators_used,
                    "source_nominal_resolution_m": nominal_res_m,
                    "effective_cell_width_m": 0.0,
                    "effective_cell_height_m": 0.0,
                    "zoom": zoom,
                    "cache_hit": False,
                    "cache_source": "computed",
                    "status": "no_land_elevation_samples",
                },
            }
            _store_cached_entry(cache_key, result)
            return result

        classifications = np.full(scores.shape, -1, dtype=np.int8)
        classifications[land_mask & (scores >= 0.60)] = 0  # danger / higher_susceptibility
        classifications[land_mask & (scores >= 0.35) & (scores < 0.60)] = 1  # neutral / moderate_susceptibility
        classifications[land_mask & (scores < 0.35)] = 2  # safe / lower_susceptibility

        latitude_span_m = (bbox[3] - bbox[1]) * 111_320.0
        longitude_span_m = (bbox[2] - bbox[0]) * 111_320.0 * math.cos(math.radians((bbox[3] + bbox[1]) / 2))
        cell_height_m = latitude_span_m / scores.shape[0]
        cell_width_m = longitude_span_m / scores.shape[1]
        cell_area_m2 = cell_height_m * cell_width_m
        minimum_cells = max(4, math.ceil(minimum_hotspot_area_m2 / cell_area_m2))
        minimum_width_cells = max(1, math.ceil(minimum_feature_width_m / min(cell_height_m, cell_width_m)))

        colors = {0: "#ef4444", 1: "#f97316", 2: "#22c55e"}
        labels = {0: "danger", 1: "neutral", 2: "safe"}
        full_labels = {0: "HIGHER_SUSCEPTIBILITY", 1: "MODERATE_SUSCEPTIBILITY", 2: "LOWER_SUSCEPTIBILITY"}
        features: list[dict[str, Any]] = []

        spatial_cell_counts: dict[str, int] = {}
        for class_id in range(3):
            for component in _components(classifications == class_id):
                component_rows = [point[0] for point in component]
                component_columns = [point[1] for point in component]
                component_width = max(component_columns) - min(component_columns) + 1
                component_height = max(component_rows) - min(component_rows) + 1
                if len(component) < minimum_cells or min(component_width, component_height) < minimum_width_cells:
                    continue

                component_elevations = np.asarray([values[row, column] for row, column in component])
                component_scores = np.asarray([scores[row, column] for row, column in component])

                boundary = _component_boundary(set(component))
                if not boundary:
                    continue

                # Compute centroid lat/lon for persistent 0.01 degree spatial grid Zone ID
                mean_r = sum(component_rows) / len(component_rows)
                mean_c = sum(component_columns) / len(component_columns)
                center_lat = bbox[3] - (mean_r / scores.shape[0]) * (bbox[3] - bbox[1])
                center_lon = bbox[0] + (mean_c / scores.shape[1]) * (bbox[2] - bbox[0])

                ns_val = abs(center_lat)
                ew_val = abs(center_lon)
                ns_dir = "N" if center_lat >= 0 else "S"
                ew_dir = "E" if center_lon >= 0 else "W"
                base_grid_id = f"FSZ-{ns_val:.2f}{ns_dir}-{ew_val:.2f}{ew_dir}"

                spatial_cell_counts[base_grid_id] = spatial_cell_counts.get(base_grid_id, 0) + 1
                p_idx = spatial_cell_counts[base_grid_id]
                zone_id = f"{base_grid_id}-P{p_idx}"

                area_m2 = len(component) * cell_area_m2
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "zone_id": zone_id,
                            "classification": labels[class_id],
                            "susceptibility_tier": full_labels[class_id],
                            "susceptibility_score_mean": round(float(np.mean(component_scores)), 3),
                            "elevation_min_m": round(float(np.min(component_elevations)), 2),
                            "elevation_max_m": round(float(np.max(component_elevations)), 2),
                            "elevation_mean_m": round(float(np.mean(component_elevations)), 2),
                            "area_m2": round(area_m2, 1),
                            "area_km2": round(area_m2 / 1_000_000, 4),
                            "color": colors[class_id],
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": _to_geojson_polygon(boundary, bbox, scores.shape[0], scores.shape[1]),
                        },
                    }
                )

        # Balanced feature selection across classification tiers (safe, neutral, danger)
        safe_feats = [f for f in features if f["properties"]["classification"] == "safe"]
        neutral_feats = [f for f in features if f["properties"]["classification"] == "neutral"]
        danger_feats = [f for f in features if f["properties"]["classification"] == "danger"]

        safe_feats.sort(key=lambda f: f["properties"]["area_m2"], reverse=True)
        neutral_feats.sort(key=lambda f: f["properties"]["area_m2"], reverse=True)
        danger_feats.sort(key=lambda f: f["properties"]["area_m2"], reverse=True)

        # Retain top 48 features from each classification tier (up to 144 total features)
        selected_features = safe_feats[:48] + neutral_feats[:48] + danger_feats[:48]
        selected_features.sort(key=lambda f: f["properties"]["area_m2"], reverse=True)

        result = {
            "type": "FeatureCollection",
            "features": selected_features,
            "metadata": {
                "region_id": normalized_region,
                "region_name": region_name,
                "classification_basis": "multi-criteria GIS terrain flood susceptibility",
                "model_version": "merit_v2.1",
                "danger_percentile": danger_percentile,
                "safe_percentile": safe_percentile,
                "minimum_feature_width_m": minimum_feature_width_m,
                "minimum_hotspot_area_m2": minimum_hotspot_area_m2,
                "source": source_name,
                "indicators_used": indicators_used,
                "source_nominal_resolution_m": nominal_res_m,
                "effective_cell_width_m": round(cell_width_m, 1),
                "effective_cell_height_m": round(cell_height_m, 1),
                "zoom": zoom,
                "cache_hit": False,
                "cache_source": "computed",
            },
        }
        _store_cached_entry(cache_key, result)
        return result


from app.services.terrain.batch_manager import get_combined_batch_bbox, resolve_8_neighbor_grid


async def generate_elevation_safety_batch(
    region_id: str,
    radius: int = 1,
    minimum_feature_width_m: float = 20.0,
    minimum_hotspot_area_m2: float = 400.0,
    danger_percentile: float = 33.0,
    safe_percentile: float = 67.0,
    tile_url: str = DEFAULT_TILE_URL,
    zoom: int = DEFAULT_ZOOM,
) -> dict[str, Any]:
    """
    Generates a 3x3 contiguous 8-neighbor regional batch elevation safety collection.
    Resolves the center region + 8 surrounding directions (NW, N, NE, W, Center, E, SW, S, SE).
    Uses unified batch classification thresholds across combined bounds to prevent border seams.
    """
    normalized_region = region_id.strip().lower()
    region = REGION_EXTENTS.get(normalized_region)
    if not region:
        raise KeyError(f"Region '{region_id}' is not available for elevation batch analysis")

    cache_key = (
        "batch_merit_v1.0",
        normalized_region,
        radius,
        round(minimum_feature_width_m, 1),
        round(minimum_hotspot_area_m2, 1),
        round(danger_percentile, 1),
        round(safe_percentile, 1),
        tile_url,
        zoom,
    )
    cached = _cached(cache_key)
    if cached:
        return cached

    center_bbox = region["bbox"]
    grid = resolve_8_neighbor_grid(center_bbox, radius=radius)
    combined_bbox = get_combined_batch_bbox(grid)

    m_elv, m_hnd, m_upa, m_meta = get_merit_hydro_window(combined_bbox)
    if m_elv is not None and m_hnd is not None and m_upa is not None:
        raw = m_elv
        source_name = "MERIT Hydro 3-arcsecond (~90m)"
        indicators_used = ["elv", "hnd", "upa", "slope", "relative_elev"]
    else:
        raw = await _load_elevation_window(combined_bbox, tile_url, zoom)
        source_name = "AWS Open Data Terrain Tiles / Mapzen Terrarium / SRTM (Fallback)"
        indicators_used = ["elv", "slope", "relative_elev"]

    values = _downsample(raw, max_dimension=384)
    finite_values = values[np.isfinite(values) & (values > -9000.0)]
    if finite_values.size < 16:
        raise ValueError("The selected batch region does not contain enough elevation samples")

    danger_threshold, safe_threshold = np.percentile(finite_values, [danger_percentile, safe_percentile])
    classifications = np.full(values.shape, -1, dtype=np.int8)
    classifications[values < danger_threshold] = 0
    classifications[(values >= danger_threshold) & (values < safe_threshold)] = 1
    classifications[values >= safe_threshold] = 2

    latitude_span_m = (combined_bbox[3] - combined_bbox[1]) * 111_320.0
    longitude_span_m = (combined_bbox[2] - combined_bbox[0]) * 111_320.0 * math.cos(math.radians((combined_bbox[3] + combined_bbox[1]) / 2))
    cell_height_m = latitude_span_m / values.shape[0]
    cell_width_m = longitude_span_m / values.shape[1]
    cell_area_m2 = cell_height_m * cell_width_m
    minimum_cells = max(4, math.ceil(minimum_hotspot_area_m2 / cell_area_m2))
    minimum_width_cells = max(1, math.ceil(minimum_feature_width_m / min(cell_height_m, cell_width_m)))

    colors = {0: "#ef4444", 1: "#f97316", 2: "#22c55e"}
    labels = {0: "danger", 1: "neutral", 2: "safe"}
    features: list[dict[str, Any]] = []
    all_percentiles = np.sort(finite_values)

    for class_id in range(3):
        for component in _components(classifications == class_id):
            component_rows = [point[0] for point in component]
            component_columns = [point[1] for point in component]
            component_width = max(component_columns) - min(component_columns) + 1
            component_height = max(component_rows) - min(component_rows) + 1
            if len(component) < minimum_cells or min(component_width, component_height) < minimum_width_cells:
                continue

            component_values = np.asarray([values[row, column] for row, column in component])
            mean_elevation = float(np.mean(component_values))
            relative_percentile = float(np.searchsorted(all_percentiles, mean_elevation, side="right") / len(all_percentiles) * 100)
            boundary = _component_boundary(set(component))
            if not boundary:
                continue

            area_m2 = len(component) * cell_area_m2
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "classification": labels[class_id],
                        "relative_percentile": round(relative_percentile, 1),
                        "relative_elevation_percentile": round(relative_percentile, 1),
                        "elevation_min_m": round(float(np.min(component_values)), 2),
                        "elevation_max_m": round(float(np.max(component_values)), 2),
                        "elevation_mean_m": round(mean_elevation, 2),
                        "area_m2": round(area_m2, 1),
                        "area_km2": round(area_m2 / 1_000_000, 4),
                        "color": colors[class_id],
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": _to_geojson_polygon(boundary, combined_bbox, values.shape[0], values.shape[1]),
                    },
                }
            )

    features.sort(key=lambda feature: feature["properties"]["area_m2"], reverse=True)

    region_statuses = []
    for direction, b_box in grid.items():
        region_statuses.append({
            "direction": direction,
            "region_id": f"{normalized_region}_{direction}",
            "bbox": b_box,
            "status": "completed",
        })

    result = {
        "type": "FeatureCollection",
        "features": features[:128],
        "metadata": {
            "center_region_id": normalized_region,
            "region_name": region["name"],
            "batch_radius": radius,
            "grid_dimensions": f"{2*radius+1}x{2*radius+1}",
            "total_regions": len(grid),
            "combined_bbox": combined_bbox,
            "region_statuses": region_statuses,
            "classification_basis": "multi-criteria GIS terrain flood susceptibility across 8-neighbor batch bounds",
            "danger_percentile": danger_percentile,
            "safe_percentile": safe_percentile,
            "source": source_name,
            "indicators_used": indicators_used,
        },
    }

    _store_cached_entry(cache_key, result)
    return result
