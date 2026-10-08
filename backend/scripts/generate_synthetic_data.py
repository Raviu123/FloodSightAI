import os
import sys
import numpy as np
import pandas as pd

# Fix seed for reproducibility
np.random.seed(42)

def generate_coastal_flood_dataset(n_samples: int = 6000) -> pd.DataFrame:
    """
    Generates a physics-informed dataset simulating Indian coastal flooding dynamics.
    Incorporates hydrodynamic principles:
    - Tidal surge decay over inland distance
    - Confluence backflow when river mouth is blocked by high tide
    - Runoff volume proportional to rain intensity, duration & soil imperviousness
    - Drainage attenuation capacity
    """
    print(f"Generating {n_samples} physics-calibrated coastal flood scenarios...")

    # Input Environmental & Geospatial Features
    tide_level_m = np.random.uniform(0.3, 4.5, n_samples)
    rainfall_rate_mm_h = np.random.exponential(scale=35.0, size=n_samples)
    rainfall_rate_mm_h = np.clip(rainfall_rate_mm_h, 0.0, 180.0)
    
    # 6-hour accumulation is correlated with current rate
    rainfall_accum_6h_mm = rainfall_rate_mm_h * np.random.uniform(1.5, 3.8, n_samples) + np.random.uniform(0, 50, n_samples)
    rainfall_accum_6h_mm = np.clip(rainfall_accum_6h_mm, 0.0, 400.0)

    elevation_m = np.random.exponential(scale=2.2, size=n_samples) + 0.3
    elevation_m = np.clip(elevation_m, 0.3, 15.0)

    dist_to_coast_km = np.random.uniform(0.05, 10.0, n_samples)
    dist_to_river_km = np.random.uniform(0.02, 5.0, n_samples)

    drainage_capacity_pct = np.random.uniform(15.0, 90.0, n_samples)
    soil_saturation_idx = np.random.uniform(0.2, 1.0, n_samples)
    cyclone_wind_kmh = np.random.uniform(10.0, 150.0, n_samples)

    # Physics Calculations:
    # 1. Coastal Surge Component (decays inland, amplified by wind)
    wind_surge_factor = (cyclone_wind_kmh / 100.0) ** 1.5 * 0.4
    coastal_surge_head = (tide_level_m + wind_surge_factor) * np.exp(-dist_to_coast_km / 2.5)

    # 2. Pluvial Runoff Component (depends on rain rate, 6h accumulation, soil saturation, drainage)
    effective_drainage_rate = (drainage_capacity_pct / 100.0) * 45.0  # mm/hr capacity
    net_pluvial_excess_mm = np.maximum(0.0, (rainfall_rate_mm_h * soil_saturation_idx) - effective_drainage_rate)
    pluvial_surge_head = (net_pluvial_excess_mm / 100.0) * 0.8 + (rainfall_accum_6h_mm / 250.0) * 0.4

    # 3. Estuary Confluence Backflow Factor (high tide prevents river discharge)
    confluence_penalty = np.where(
        (dist_to_river_km < 1.0) & (tide_level_m > 2.0),
        (tide_level_m - 2.0) * 0.35 * np.exp(-dist_to_river_km),
        0.0
    )

    # Total Hydrodynamic Water Surge Level above MSL
    total_water_level_m = coastal_surge_head * 0.65 + pluvial_surge_head * 0.55 + confluence_penalty + np.random.normal(0, 0.05, n_samples)
    total_water_level_m = np.maximum(0.0, total_water_level_m)

    # Net Inundation Depth over ground elevation
    raw_depth = total_water_level_m - elevation_m
    flood_depth_m = np.maximum(0.0, raw_depth)
    flood_depth_m = np.round(np.clip(flood_depth_m, 0.0, 3.5), 2)

    # Binary Classification Target: Flood occurs if depth > 0.15m
    is_flooded = (flood_depth_m > 0.15).astype(int)

    # Timing calculations (Onset & Peak times in minutes)
    # Onset time: Higher rainfall and lower elevation accelerate onset
    rate_factor = np.clip((rainfall_rate_mm_h + tide_level_m * 20.0) / 100.0, 0.2, 3.0)
    base_onset_min = np.where(
        is_flooded == 1,
        np.maximum(15.0, (elevation_m * 40.0) / rate_factor + (dist_to_coast_km * 10.0)),
        360.0
    )
    onset_time_min = np.round(np.clip(base_onset_min + np.random.normal(0, 5, n_samples), 15.0, 360.0)).astype(int)

    # Peak time: Onset time + surge build-up window
    surge_duration_min = np.maximum(30.0, (rainfall_accum_6h_mm * 0.5) + (tide_level_m * 25.0))
    peak_time_min = np.where(
        is_flooded == 1,
        np.clip(onset_time_min + surge_duration_min + np.random.normal(0, 10, n_samples), 45.0, 720.0),
        720.0
    )
    peak_time_min = np.round(peak_time_min).astype(int)

    df = pd.DataFrame({
        "tide_level_m": np.round(tide_level_m, 2),
        "rainfall_rate_mm_h": np.round(rainfall_rate_mm_h, 1),
        "rainfall_accum_6h_mm": np.round(rainfall_accum_6h_mm, 1),
        "elevation_m": np.round(elevation_m, 2),
        "dist_to_coast_km": np.round(dist_to_coast_km, 2),
        "dist_to_river_km": np.round(dist_to_river_km, 2),
        "drainage_capacity_pct": np.round(drainage_capacity_pct, 1),
        "soil_saturation_idx": np.round(soil_saturation_idx, 2),
        "cyclone_wind_kmh": np.round(cyclone_wind_kmh, 1),
        # Target variables
        "is_flooded": is_flooded,
        "flood_depth_m": flood_depth_m,
        "onset_time_min": onset_time_min,
        "peak_time_min": peak_time_min,
    })

    return df


if __name__ == "__main__":
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(output_dir, exist_ok=True)
    csv_path = os.path.join(output_dir, "coastal_flood_training_data.csv")

    df = generate_coastal_flood_dataset(6000)
    df.to_csv(csv_path, index=False)
    print(f"[SUCCESS] Saved synthetic coastal dataset with {len(df)} rows to {csv_path}")
    print(f"Flooded samples: {df['is_flooded'].sum()} ({df['is_flooded'].mean()*100:.1f}%)")
    print(df.head())
