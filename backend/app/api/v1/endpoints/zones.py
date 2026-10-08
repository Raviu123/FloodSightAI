from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.zone import Zone

router = APIRouter()


@router.get("/", summary="List All Monitored Coastal Zones with Infrastructure")
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    results = []
    for z in zones:
        results.append({
            "id": z.id,
            "name": z.name,
            "state": z.state,
            "region": z.region,
            "latitude": z.latitude,
            "longitude": z.longitude,
            "elevation_meters": z.elevation_meters,
            "population": z.population,
            "dist_to_coast_km": z.dist_to_coast_km,
            "dist_to_river_km": z.dist_to_river_km,
            "drainage_capacity_pct": z.drainage_capacity_pct,
            "facilities": [
                {
                    "name": f.name,
                    "type": f.facility_type,
                    "elevation_meters": f.elevation_meters,
                    "capacity": f.capacity,
                }
                for f in z.facilities
            ],
            "roads": [
                {
                    "name": r.name,
                    "type": r.road_type,
                    "elevation_meters": r.elevation_meters,
                    "flood_cutoff_depth_m": r.flood_cutoff_depth_m,
                }
                for r in z.roads
            ],
        })
    return results


@router.get("/{zone_id}", summary="Get Detailed Zone Profile and Facilities")
def get_zone_details(zone_id: str, db: Session = Depends(get_db)):
    zone = db.query(Zone).filter(Zone.id == zone_id.upper()).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")

    return {
        "id": zone.id,
        "name": zone.name,
        "state": zone.state,
        "region": zone.region,
        "latitude": zone.latitude,
        "longitude": zone.longitude,
        "elevation_meters": zone.elevation_meters,
        "population": zone.population,
        "dist_to_coast_km": zone.dist_to_coast_km,
        "dist_to_river_km": zone.dist_to_river_km,
        "drainage_capacity_pct": zone.drainage_capacity_pct,
        "facilities": [
            {
                "name": f.name,
                "type": f.facility_type,
                "elevation_meters": f.elevation_meters,
                "capacity": f.capacity,
            }
            for f in zone.facilities
        ],
        "roads": [
            {
                "name": r.name,
                "type": r.road_type,
                "elevation_meters": r.elevation_meters,
                "flood_cutoff_depth_m": r.flood_cutoff_depth_m,
            }
            for r in zone.roads
        ],
    }
