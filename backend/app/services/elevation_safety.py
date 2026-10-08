"""Elevation-only safety regions for a selected FloodSight region."""

from __future__ import annotations

import io
import math
import time
from collections import deque
from typing import Any

import httpx
import numpy as np
from PIL import Image

TILE_SIZE = 256
DEFAULT_ZOOM = 14
DEFAULT_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

# These extents are analysis windows for the existing region selector, not flood boundaries.
REGION_EXTENTS: dict[str, dict[str, Any]] = {
    "mangalore": {"name": "Mangalore Estuary", "bbox": [74.79, 12.81, 74.89, 12.91]},
    "kochi": {"name": "Kochi Backwaters", "bbox": [76.21, 9.92, 76.32, 10.01]},
    "chennai": {"name": "Chennai Delta", "bbox": [80.19, 12.96, 80.32, 13.08]},
    "mumbai": {"name": "Mumbai Coastal Bay", "bbox": [72.77, 18.94, 72.91, 19.08]},
}

_CACHE: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 600
_CACHE_MAX_ENTRIES = 8


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
        for tile_y in range(min_tile_y, max_tile_y + 1):
            for tile_x in range(min_tile_x, max_tile_x + 1):
                url = tile_url.format(z=zoom, x=tile_x, y=tile_y)
                response = await client.get(url)
                response.raise_for_status()
                tile = _terrarium_elevation(response.content)
                y_start = (tile_y - min_tile_y) * TILE_SIZE
                x_start = (tile_x - min_tile_x) * TILE_SIZE
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
    for start, end in edges:
        outgoing.setdefault(start, []).append(end)

    start = next(iter(edges))[0]
    boundary = [start]
    current = start
    while True:
        options = outgoing.get(current, [])
        if not options:
            break
        next_point = options.pop()
        boundary.append(next_point)
        current = next_point
        if current == start:
            break

    return boundary if len(boundary) >= 4 and boundary[-1] == start else []


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


def _cached(key: tuple[Any, ...]) -> dict[str, Any] | None:
    entry = _CACHE.get(key)
    if not entry:
        return None
    created_at, value = entry
    if time.monotonic() - created_at > _CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return value


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
    region = REGION_EXTENTS.get(normalized_region)
    if not region:
        raise KeyError(f"Region '{region_id}' is not available for elevation analysis")
    if not 0 < danger_percentile < safe_percentile < 100:
        raise ValueError("Percentiles must satisfy 0 < danger_percentile < safe_percentile < 100")

    cache_key = (
        normalized_region,
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

    bbox = region["bbox"]
    raw = await _load_elevation_window(bbox, tile_url, zoom)
    values = _downsample(raw)
    finite_values = values[np.isfinite(values)]
    if finite_values.size < 16:
        raise ValueError("The selected region does not contain enough elevation samples")

    danger_threshold, safe_threshold = np.percentile(finite_values, [danger_percentile, safe_percentile])
    classifications = np.full(values.shape, -1, dtype=np.int8)
    classifications[values < danger_threshold] = 0
    classifications[(values >= danger_threshold) & (values < safe_threshold)] = 1
    classifications[values >= safe_threshold] = 2

    latitude_span_m = (bbox[3] - bbox[1]) * 111_320.0
    longitude_span_m = (bbox[2] - bbox[0]) * 111_320.0 * math.cos(math.radians((bbox[3] + bbox[1]) / 2))
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
                        "coordinates": _to_geojson_polygon(boundary, bbox, values.shape[0], values.shape[1]),
                    },
                }
            )

    features.sort(key=lambda feature: feature["properties"]["area_m2"], reverse=True)
    result = {
        "type": "FeatureCollection",
        "features": features[:36],
        "metadata": {
            "region_id": normalized_region,
            "region_name": region["name"],
            "classification_basis": "relative elevation within selected region",
            "danger_percentile": danger_percentile,
            "safe_percentile": safe_percentile,
            "minimum_feature_width_m": minimum_feature_width_m,
            "minimum_hotspot_area_m2": minimum_hotspot_area_m2,
            "source": "AWS Open Data Terrain Tiles / Mapzen Terrarium / SRTM",
            "source_nominal_resolution_m": 30,
            "effective_cell_width_m": round(cell_width_m, 1),
            "effective_cell_height_m": round(cell_height_m, 1),
            "zoom": zoom,
        },
    }
    if len(_CACHE) >= _CACHE_MAX_ENTRIES:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[cache_key] = (time.monotonic(), result)
    return result
