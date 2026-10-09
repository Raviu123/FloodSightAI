"""DEM loader and downsampling helper module."""

from __future__ import annotations

import io
import math

import httpx
import numpy as np
from PIL import Image

TILE_SIZE = 256
DEFAULT_ZOOM = 14
DEFAULT_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def tile_x(longitude: float, zoom: int) -> float:
    return (longitude + 180.0) / 360.0 * (2**zoom)


def tile_y(latitude: float, zoom: int) -> float:
    latitude = max(-85.05112878, min(85.05112878, latitude))
    latitude_radians = math.radians(latitude)
    return (1.0 - math.asinh(math.tan(latitude_radians)) / math.pi) / 2.0 * (2**zoom)


def terrarium_elevation(image_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    red, green, blue = (np.asarray(image, dtype=np.float32)[:, :, index] for index in range(3))
    return red * 256.0 + green + blue / 256.0 - 32768.0


async def load_elevation_window(
    bbox: list[float],
    tile_url: str = DEFAULT_TILE_URL,
    zoom: int = DEFAULT_ZOOM,
) -> np.ndarray:
    west, south, east, north = bbox
    min_tile_x = max(0, math.floor(tile_x(west, zoom)))
    max_tile_x = max(0, math.floor(tile_x(east, zoom)))
    min_tile_y = max(0, math.floor(tile_y(north, zoom)))
    max_tile_y = max(0, math.floor(tile_y(south, zoom)))

    mosaic = np.full(
        ((max_tile_y - min_tile_y + 1) * TILE_SIZE, (max_tile_x - min_tile_x + 1) * TILE_SIZE),
        np.nan,
        dtype=np.float32,
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        for ty in range(min_tile_y, max_tile_y + 1):
            for tx in range(min_tile_x, max_tile_x + 1):
                url = tile_url.format(z=zoom, x=tx, y=ty)
                response = await client.get(url)
                response.raise_for_status()
                tile = terrarium_elevation(response.content)
                y_start = (ty - min_tile_y) * TILE_SIZE
                x_start = (tx - min_tile_x) * TILE_SIZE
                mosaic[y_start : y_start + TILE_SIZE, x_start : x_start + TILE_SIZE] = tile

    left = max(0, math.floor(tile_x(west, zoom) * TILE_SIZE - min_tile_x * TILE_SIZE))
    right = min(mosaic.shape[1], math.ceil(tile_x(east, zoom) * TILE_SIZE - min_tile_x * TILE_SIZE))
    top = max(0, math.floor(tile_y(north, zoom) * TILE_SIZE - min_tile_y * TILE_SIZE))
    bottom = min(mosaic.shape[0], math.ceil(tile_y(south, zoom) * TILE_SIZE - min_tile_y * TILE_SIZE))
    window = mosaic[top:bottom, left:right]

    if window.size == 0 or not np.isfinite(window).any():
        raise ValueError("The DEM provider returned no elevation data for this region")
    return window


def downsample_dem(values: np.ndarray, max_dimension: int = 192) -> np.ndarray:
    factor = max(1, math.ceil(max(values.shape) / max_dimension))
    rows = values.shape[0] // factor
    columns = values.shape[1] // factor
    trimmed = values[: rows * factor, : columns * factor]
    blocks = trimmed.reshape(rows, factor, columns, factor)
    return np.nanmean(blocks, axis=(1, 3))
