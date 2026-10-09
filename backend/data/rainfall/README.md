# Regional NASA IMERG Satellite Rainfall Datasets

This directory contains region-specific NASA GPM IMERG satellite precipitation datasets (`.hdf5` / `.h5`) used by the FloodSightAI terrain engine to compute rainfall-forced Flood Hotspot polygons.

## File Naming Convention
To add satellite precipitation data for a hotspot region, save or link the IMERG HDF5 file in this directory using the region's ID:

```
backend/data/rainfall/{region_id}_imerg.hdf5
```

### Supported Regions & Examples:
- **Mumbai**: `mumbai_imerg.hdf5`
- **Mangalore**: `mangalore_imerg.hdf5`
- **Kochi**: `kochi_imerg.hdf5`
- **Chennai**: `chennai_imerg.hdf5`

## Fallback Behavior
If a specific regional file is not present for a requested `region_id`, the engine will gracefully fall back to the default available IMERG product (or global bounding box crop) and indicate `status: "fallback_default"` in the GeoJSON response metadata.
