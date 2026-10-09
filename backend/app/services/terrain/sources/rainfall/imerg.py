"""NASA IMERG HDF5 precipitation data loader and raster grid resampler across India extent."""

from __future__ import annotations

import os
from typing import Any, Tuple

import h5py
import numpy as np
from PIL import Image

DEFAULT_IMERG_PATH = "3B-MO.MS.MRG.3IMERG.20250901-S000000-E235959.09.V07B.HDF5"
INDIA_BBOX = [68.0, 6.0, 97.5, 37.5]


def load_imerg_precipitation(
    bbox: list[float] | None = None,
    target_shape: Tuple[int, int] = (120, 145),
    file_path: str = DEFAULT_IMERG_PATH,
) -> Tuple[np.ndarray, dict[str, Any]]:
    """
    Ingests NASA IMERG HDF5 satellite precipitation product, crops to the requested
    bounding box [west, south, east, north] (defaults to India extent), normalizes values into [0.0, 1.0],
    and resamples onto target grid dimensions (rows, cols).

    Returns:
        (rainfall_score_grid, metadata)
    """
    target_rows, target_cols = target_shape
    if bbox is None:
        bbox = INDIA_BBOX
    west, south, east, north = bbox

    # Default fallback matrix if HDF5 file does not exist or fails to open
    if not os.path.exists(file_path):
        neutral = np.full((target_rows, target_cols), 0.5, dtype=np.float32)
        meta = {
            "dataset_file": os.path.basename(file_path),
            "status": "file_not_found_fallback",
            "mean_mm_hr": 0.0,
            "max_mm_hr": 0.0,
        }
        return neutral, meta

    with h5py.File(file_path, "r") as hf:
        grid = hf["Grid"]
        lons = grid["lon"][:]  # shape (3600,)
        lats = grid["lat"][:]  # shape (1800,)
        precip_ds = grid["precipitation"]  # shape (1, 3600, 1800)

        # Buffer bbox slightly to ensure coverage
        buf = 0.15
        w, e = west - buf, east + buf
        s, n = south - buf, north + buf

        lon_indices = np.where((lons >= w) & (lons <= e))[0]
        lat_indices = np.where((lats >= s) & (lats <= n))[0]

        if lon_indices.size == 0 or lat_indices.size == 0:
            neutral = np.full((target_rows, target_cols), 0.5, dtype=np.float32)
            meta = {
                "dataset_file": os.path.basename(file_path),
                "status": "outside_extent",
                "mean_mm_hr": 0.0,
                "max_mm_hr": 0.0,
            }
            return neutral, meta

        min_lon_i, max_lon_i = int(lon_indices[0]), int(lon_indices[-1]) + 1
        min_lat_i, max_lat_i = int(lat_indices[0]), int(lat_indices[-1]) + 1

        # Extract slice: shape (1, lon_len, lat_len)
        slice_data = precip_ds[0, min_lon_i:max_lon_i, min_lat_i:max_lat_i]

        # Transpose from (lon, lat) to (lat, lon)
        raw_slice = slice_data.T

        # IMERG lats are ascending (south to north).
        # We flip vertically so row 0 is North (top of map) and last row is South (bottom of map).
        raw_slice = np.flipud(raw_slice)

        # Replace invalid/fill values (< 0) with 0.0
        clean_slice = np.where(raw_slice < 0, 0.0, raw_slice).astype(np.float32)

        mean_val = float(np.mean(clean_slice)) if clean_slice.size > 0 else 0.0
        max_val = float(np.max(clean_slice)) if clean_slice.size > 0 else 0.0

        # Resample to target grid (target_cols, target_rows)
        if clean_slice.shape != (target_rows, target_cols):
            img = Image.fromarray(clean_slice)
            resampled_img = img.resize((target_cols, target_rows), Image.Resampling.BILINEAR)
            resampled_data = np.array(resampled_img, dtype=np.float32)
        else:
            resampled_data = clean_slice

        # Normalize score into [0.0, 1.0]
        r_min = np.min(resampled_data)
        r_max = np.max(resampled_data)
        r_denom = r_max - r_min

        if r_denom > 1e-6:
            rainfall_score = (resampled_data - r_min) / r_denom
        else:
            rainfall_score = np.full_like(resampled_data, 0.5)

        rainfall_score = np.clip(rainfall_score, 0.0, 1.0).astype(np.float32)

        meta = {
            "dataset_file": os.path.basename(file_path),
            "status": "ok",
            "mean_mm_hr": round(mean_val, 4),
            "max_mm_hr": round(max_val, 4),
            "native_resolution_deg": 0.1,
            "resampled_grid_shape": list(target_shape),
        }

        return rainfall_score, meta
