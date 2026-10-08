import os
import sys
import numpy as np
import pandas as pd

# Fix seed for reproducibility
np.random.seed(42)


def _compute_flood_physics(
    tide_level_m: np.ndarray,
    rainfall_rate_mm_h: np.ndarray,
    rainfall_accum_6h_mm: np.ndarray,
    elevation_m: np.ndarray,
    dist_to_coast_km: np.ndarray,
    dist_to_river_km: np.ndarray,
    drainage_capacity_pct: np.ndarray,
    soil_saturation_idx: np.ndarray,
    cyclone_wind_kmh: np.ndarray,
) -> pd.DataFrame:
    """
    Applies hydrodynamic principles to calculate coastal inundation depth,
    flood occurrence, onset time, and peak surge time.
    """
    n_samples = len(tide_level_m)

    # 1. Coastal Surge Component (decays inland, amplified non-linearly by cyclone wind speed)
    wind_surge_factor = (cyclone_wind_kmh / 100.0) ** 1.6 * 0.55
    coastal_surge_head = (tide_level_m + wind_surge_factor) * np.exp(-dist_to_coast_km / 2.8)

    # 2. Pluvial Runoff Component (depends on rain rate, 6h accumulation, soil saturation, drainage attenuation)
    effective_drainage_rate = (drainage_capacity_pct / 100.0) * 45.0  # mm/hr capacity
    net_pluvial_excess_mm = np.maximum(0.0, (rainfall_rate_mm_h * soil_saturation_idx) - effective_drainage_rate)
    pluvial_surge_head = (net_pluvial_excess_mm / 100.0) * 0.85 + (rainfall_accum_6h_mm / 250.0) * 0.45

    # 3. Estuary Confluence Backflow Factor (high tide prevents river discharge & forces backflow upstream)
    confluence_penalty = np.where(
        (dist_to_river_km < 1.2) & (tide_level_m > 1.8),
        (tide_level_m - 1.8) * 0.45 * np.exp(-dist_to_river_km * 1.5),
        0.0
    )

    # Total Hydrodynamic Water Surge Level above MSL
    noise = np.random.normal(0, 0.04, n_samples)
    total_water_level_m = coastal_surge_head * 0.70 + pluvial_surge_head * 0.60 + confluence_penalty + noise
    total_water_level_m = np.maximum(0.0, total_water_level_m)

    # Net Inundation Depth over ground elevation
    raw_depth = total_water_level_m - elevation_m
    flood_depth_m = np.maximum(0.0, raw_depth)
    flood_depth_m = np.round(np.clip(flood_depth_m, 0.0, 4.5), 2)

    # Binary Classification Target: Flood occurs if depth > 0.15m
    is_flooded = (flood_depth_m > 0.15).astype(int)

    # Timing calculations (Onset & Peak times in minutes)
    rate_factor = np.clip((rainfall_rate_mm_h + tide_level_m * 22.0) / 100.0, 0.2, 3.5)
    base_onset_min = np.where(
        is_flooded == 1,
        np.maximum(15.0, (elevation_m * 35.0) / rate_factor + (dist_to_coast_km * 8.0)),
        360.0
    )
    onset_time_min = np.round(np.clip(base_onset_min + np.random.normal(0, 4, n_samples), 15.0, 360.0)).astype(int)

    # Peak time: Onset time + surge build-up window
    surge_duration_min = np.maximum(30.0, (rainfall_accum_6h_mm * 0.45) + (tide_level_m * 28.0))
    peak_time_min = np.where(
        is_flooded == 1,
        np.clip(onset_time_min + surge_duration_min + np.random.normal(0, 8, n_samples), 40.0, 720.0),
        720.0
    )
    peak_time_min = np.round(peak_time_min).astype(int)

    return pd.DataFrame({
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


def generate_chennai_2015_profile(n: int = 2200) -> pd.DataFrame:
    """
    Profile 1: Chennai 2015 Flood Profile
    Characteristics: Adyar river overflow, 350mm catastrophic rain, 2.8m tide, low drainage, saturated urban delta.
    """
    tide_level_m = np.clip(np.random.normal(loc=2.8, scale=0.45, size=n), 0.8, 4.2)
    rainfall_rate_mm_h = np.clip(np.random.normal(loc=65.0, scale=25.0, size=n) + np.random.exponential(scale=20.0, size=n), 10.0, 180.0)
    rainfall_accum_6h_mm = np.clip(rainfall_rate_mm_h * np.random.uniform(2.5, 4.0, size=n) + np.random.uniform(50, 120, size=n), 80.0, 420.0)
    elevation_m = np.clip(np.random.normal(loc=2.1, scale=0.6, size=n), 0.5, 6.0)
    dist_to_coast_km = np.clip(np.random.uniform(0.2, 4.5, size=n), 0.1, 8.0)
    dist_to_river_km = np.clip(np.random.exponential(scale=0.35, size=n), 0.02, 1.8)
    drainage_capacity_pct = np.clip(np.random.normal(loc=30.0, scale=8.0, size=n), 12.0, 50.0)
    soil_saturation_idx = np.clip(np.random.normal(loc=0.88, scale=0.08, size=n), 0.65, 1.0)
    cyclone_wind_kmh = np.clip(np.random.normal(loc=65.0, scale=22.0, size=n), 20.0, 140.0)

    return _compute_flood_physics(
        tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm,
        elevation_m, dist_to_coast_km, dist_to_river_km,
        drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh
    )


def generate_kochi_2018_profile(n: int = 2200) -> pd.DataFrame:
    """
    Profile 2: Kochi 2018 Monsoon Profile
    Characteristics: Vembanad lake backwaters, 0.5m elevation, 0.95 soil saturation, persistent monsoon deluge.
    """
    tide_level_m = np.clip(np.random.normal(loc=1.8, scale=0.5, size=n), 0.5, 3.5)
    rainfall_rate_mm_h = np.clip(np.random.normal(loc=50.0, scale=20.0, size=n) + np.random.exponential(scale=18.0, size=n), 15.0, 160.0)
    rainfall_accum_6h_mm = np.clip(rainfall_rate_mm_h * np.random.uniform(2.8, 4.2, size=n) + np.random.uniform(70, 150, size=n), 90.0, 450.0)
    elevation_m = np.clip(np.random.normal(loc=0.5, scale=0.3, size=n), 0.2, 2.5)
    dist_to_coast_km = np.clip(np.random.uniform(0.3, 3.0, size=n), 0.1, 5.0)
    dist_to_river_km = np.clip(np.random.exponential(scale=0.15, size=n), 0.01, 0.8)
    drainage_capacity_pct = np.clip(np.random.normal(loc=25.0, scale=6.0, size=n), 10.0, 40.0)
    soil_saturation_idx = np.clip(np.random.normal(loc=0.95, scale=0.04, size=n), 0.82, 1.0)
    cyclone_wind_kmh = np.clip(np.random.normal(loc=45.0, scale=15.0, size=n), 15.0, 95.0)

    return _compute_flood_physics(
        tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm,
        elevation_m, dist_to_coast_km, dist_to_river_km,
        drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh
    )


def generate_mangalore_netravati_profile(n: int = 2200) -> pd.DataFrame:
    """
    Profile 3: Mangalore Netravati Estuary Profile
    Characteristics: Western Ghats runoff, 0.8m elevation, high spring tide confluence, high flow velocity.
    """
    tide_level_m = np.clip(np.random.normal(loc=3.1, scale=0.6, size=n), 1.2, 4.8)
    rainfall_rate_mm_h = np.clip(np.random.normal(loc=55.0, scale=24.0, size=n) + np.random.exponential(scale=25.0, size=n), 10.0, 175.0)
    rainfall_accum_6h_mm = np.clip(rainfall_rate_mm_h * np.random.uniform(2.2, 3.8, size=n) + np.random.uniform(40, 110, size=n), 70.0, 400.0)
    elevation_m = np.clip(np.random.normal(loc=0.8, scale=0.4, size=n), 0.3, 3.2)
    dist_to_coast_km = np.clip(np.random.uniform(0.1, 2.5, size=n), 0.05, 4.0)
    dist_to_river_km = np.clip(np.random.exponential(scale=0.18, size=n), 0.02, 0.9)
    drainage_capacity_pct = np.clip(np.random.normal(loc=35.0, scale=9.0, size=n), 15.0, 55.0)
    soil_saturation_idx = np.clip(np.random.normal(loc=0.85, scale=0.07, size=n), 0.65, 0.98)
    cyclone_wind_kmh = np.clip(np.random.normal(loc=55.0, scale=20.0, size=n), 20.0, 115.0)

    return _compute_flood_physics(
        tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm,
        elevation_m, dist_to_coast_km, dist_to_river_km,
        drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh
    )


def generate_mumbai_mithi_profile(n: int = 2200) -> pd.DataFrame:
    """
    Profile 4: Mumbai Mithi River Profile
    Characteristics: Urban drainage bottleneck, 2.2m elevation, high tide barrier, extreme paved impervious runoff.
    """
    tide_level_m = np.clip(np.random.normal(loc=3.4, scale=0.7, size=n), 1.0, 5.2)
    rainfall_rate_mm_h = np.clip(np.random.normal(loc=60.0, scale=28.0, size=n) + np.random.exponential(scale=22.0, size=n), 12.0, 190.0)
    rainfall_accum_6h_mm = np.clip(rainfall_rate_mm_h * np.random.uniform(2.4, 3.9, size=n) + np.random.uniform(60, 130, size=n), 80.0, 440.0)
    elevation_m = np.clip(np.random.normal(loc=2.2, scale=0.7, size=n), 0.8, 5.5)
    dist_to_coast_km = np.clip(np.random.uniform(0.4, 5.0, size=n), 0.2, 8.0)
    dist_to_river_km = np.clip(np.random.exponential(scale=0.25, size=n), 0.02, 1.2)
    drainage_capacity_pct = np.clip(np.random.normal(loc=22.0, scale=6.0, size=n), 8.0, 38.0)
    soil_saturation_idx = np.clip(np.random.normal(loc=0.92, scale=0.06, size=n), 0.72, 1.0)
    cyclone_wind_kmh = np.clip(np.random.normal(loc=60.0, scale=22.0, size=n), 20.0, 125.0)

    return _compute_flood_physics(
        tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm,
        elevation_m, dist_to_coast_km, dist_to_river_km,
        drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh
    )


def generate_vizag_cyclone_profile(n: int = 2200) -> pd.DataFrame:
    """
    Profile 5: Visakhapatnam Bay Cyclone Profile
    Characteristics: Cyclone wind surge dominance, coastal rocky shoreline, 3.4m elevation, high wind shear.
    """
    tide_level_m = np.clip(np.random.normal(loc=2.6, scale=0.65, size=n), 0.6, 4.5)
    rainfall_rate_mm_h = np.clip(np.random.normal(loc=48.0, scale=25.0, size=n) + np.random.exponential(scale=20.0, size=n), 8.0, 170.0)
    rainfall_accum_6h_mm = np.clip(rainfall_rate_mm_h * np.random.uniform(2.0, 3.6, size=n) + np.random.uniform(30, 90, size=n), 50.0, 380.0)
    elevation_m = np.clip(np.random.normal(loc=3.4, scale=1.1, size=n), 1.2, 8.5)
    dist_to_coast_km = np.clip(np.random.exponential(scale=0.8, size=n), 0.05, 4.5)
    dist_to_river_km = np.clip(np.random.uniform(1.0, 5.5, size=n), 0.5, 7.0)
    drainage_capacity_pct = np.clip(np.random.normal(loc=58.0, scale=12.0, size=n), 25.0, 85.0)
    soil_saturation_idx = np.clip(np.random.normal(loc=0.68, scale=0.14, size=n), 0.35, 0.95)
    cyclone_wind_kmh = np.clip(np.random.normal(loc=115.0, scale=32.0, size=n) + np.random.exponential(scale=20.0, size=n), 50.0, 220.0)

    return _compute_flood_physics(
        tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm,
        elevation_m, dist_to_coast_km, dist_to_river_km,
        drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh
    )


def generate_baseline_variation_profile(n: int = 1500) -> pd.DataFrame:
    """
    General ambient / baseline scenarios across diverse coastal conditions,
    including low tide, low rainfall, elevated terrain, and clear-weather envelopes.
    """
    tide_level_m = np.random.uniform(0.2, 3.8, size=n)
    rainfall_rate_mm_h = np.random.exponential(scale=20.0, size=n)
    rainfall_rate_mm_h = np.clip(rainfall_rate_mm_h, 0.0, 120.0)
    rainfall_accum_6h_mm = np.clip(rainfall_rate_mm_h * np.random.uniform(1.2, 3.2, size=n) + np.random.uniform(0, 35, size=n), 0.0, 300.0)
    elevation_m = np.clip(np.random.exponential(scale=3.0, size=n) + 0.5, 0.5, 14.0)
    dist_to_coast_km = np.random.uniform(0.1, 9.0, size=n)
    dist_to_river_km = np.random.uniform(0.05, 5.0, size=n)
    drainage_capacity_pct = np.random.uniform(25.0, 88.0, size=n)
    soil_saturation_idx = np.random.uniform(0.25, 0.90, size=n)
    cyclone_wind_kmh = np.random.uniform(10.0, 110.0, size=n)

    return _compute_flood_physics(
        tide_level_m, rainfall_rate_mm_h, rainfall_accum_6h_mm,
        elevation_m, dist_to_coast_km, dist_to_river_km,
        drainage_capacity_pct, soil_saturation_idx, cyclone_wind_kmh
    )


def generate_coastal_flood_dataset(n_samples: int = 12500) -> pd.DataFrame:
    """
    Generates a 10,000+ physics-informed dataset simulating Indian coastal flooding dynamics
    covering 5 calibrated regional profiles plus general baseline variations.
    """
    print(f"Generating physics-calibrated dataset across 5 Indian coastal profiles (Target: >= {n_samples} rows)...")

    # Sample distribution
    samples_per_profile = int(n_samples * 0.18)  # ~2250 each for 5 profiles
    baseline_samples = n_samples - (samples_per_profile * 5)  # remainder ~1250

    p1 = generate_chennai_2015_profile(samples_per_profile)
    p2 = generate_kochi_2018_profile(samples_per_profile)
    p3 = generate_mangalore_netravati_profile(samples_per_profile)
    p4 = generate_mumbai_mithi_profile(samples_per_profile)
    p5 = generate_vizag_cyclone_profile(samples_per_profile)
    p_base = generate_baseline_variation_profile(baseline_samples)

    df = pd.concat([p1, p2, p3, p4, p5, p_base], ignore_index=True)
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    return df


if __name__ == "__main__":
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(output_dir, exist_ok=True)
    csv_path = os.path.join(output_dir, "coastal_flood_training_data.csv")

    df = generate_coastal_flood_dataset(12500)
    df.to_csv(csv_path, index=False)
    print(f"[SUCCESS] Saved synthetic coastal dataset with {len(df)} rows to {csv_path}")
    print(f"Flooded samples: {df['is_flooded'].sum()} ({df['is_flooded'].mean()*100:.1f}%)")
    print(f"Max depth: {df['flood_depth_m'].max():.2f}m | Mean depth: {df['flood_depth_m'].mean():.2f}m")
    print(df.head())
