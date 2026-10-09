"""
Abstract Data Source Interface classes for terrain and hydrological data.
Allows DEM, Flow Accumulation, and River sources to be swapped without changing downstream analysis algorithms.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Tuple

import numpy as np


class DEMSource(ABC):
    """Abstract interface for Digital Elevation Model providers."""

    @abstractmethod
    async def get_elevation_window(self, bbox: list[float], resolution_m: float) -> Tuple[np.ndarray, dict[str, Any]]:
        """
        Retrieves elevation matrix (rows, cols) in meters MSL for the requested bounding box [west, south, east, north].
        Returns:
            (elevation_grid, metadata)
        """
        pass


class FlowDirectionSource(ABC):
    """Abstract interface for Flow Direction raster providers (e.g. D8, D-infinity)."""

    @abstractmethod
    async def get_flow_direction(self, bbox: list[float], target_shape: Tuple[int, int]) -> np.ndarray:
        """Retrieves flow direction grid for requested extent."""
        pass


class FlowAccumulationSource(ABC):
    """Abstract interface for Flow Accumulation raster providers."""

    @abstractmethod
    async def get_flow_accumulation(self, bbox: list[float], target_shape: Tuple[int, int]) -> np.ndarray:
        """Retrieves flow accumulation grid (upstream cell count or km²) for requested extent."""
        pass


class RiverSource(ABC):
    """Abstract interface for major river channels and hydrographic lines."""

    @abstractmethod
    async def get_river_mask(self, bbox: list[float], target_shape: Tuple[int, int]) -> np.ndarray:
        """Retrieves boolean/distance raster mask for river channels."""
        pass


class LakeSource(ABC):
    """Abstract interface for lakes, reservoirs, and water bodies."""

    @abstractmethod
    async def get_lake_mask(self, bbox: list[float], target_shape: Tuple[int, int]) -> np.ndarray:
        """Retrieves boolean/distance raster mask for lakes and reservoirs."""
        pass


class LandMaskSource(ABC):
    """Abstract interface for land vs ocean/sea masks."""

    @abstractmethod
    async def get_land_mask(self, bbox: list[float], target_shape: Tuple[int, int]) -> np.ndarray:
        """Retrieves boolean mask (True for land, False for ocean/nodata)."""
        pass
