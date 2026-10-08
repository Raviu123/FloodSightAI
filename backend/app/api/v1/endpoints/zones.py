import os
import json
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.models.zone import Zone
from app.schemas.sms import (
    ZonePhoneSubscriptionRequest,
    ZoneSubscriptionResponse,
    ZoneSubscriptionListResponse,
    ZoneSubscriptionItem,
    SMSLogItem,
    SMSLogListResponse,
)
from app.services.sms_service import sms_service

router = APIRouter()

GEOJSON_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "processed", "geojson")
)


def load_geojson_file(filename: str) -> Dict[str, Any]:
    file_path = os.path.join(GEOJSON_DIR, filename)
    if not os.path.exists(file_path):
        # Fallback to generating on the fly if needed
        from scripts.extract_infrastructure_dem import build_and_save_geojson_layers
        build_and_save_geojson_layers()
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/geojson/all", summary="Get All Flood Mapping Layers Bundle (GeoJSON)")
def get_all_map_layers():
    """
    Returns the complete set of GeoJSON layers:
    - Historic Floods (Polygons)
    - Vulnerable Infrastructure (Hospitals, Bridges, Substations)
    - Safe Highland Shelters
    - Submersible Roads
    """
    return load_geojson_file("all_flood_layers.json")


@router.get("/geojson/historic-floods", summary="Get Historic Indian Flood Boundaries (GeoJSON)")
def get_historic_floods():
    """
    Returns historic flood inundation boundaries and benchmark damage telemetry across India.
    """
    return load_geojson_file("historic_floods.geojson")


@router.get("/geojson/infrastructure", summary="Get Vulnerable Infrastructure with DEM Elevations (GeoJSON)")
def get_vulnerable_infrastructure(
    category: Optional[str] = Query(None, description="Filter by category: HOSPITAL, BRIDGE, POWER_SUBSTATION"),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID e.g. ZONE-01"),
    max_elevation: Optional[float] = Query(None, description="Filter features below a certain elevation in meters"),
):
    """
    Returns critical facilities and bridges tagged with Copernicus DEM ground elevations and Relative Lowland Index tiers.
    """
    data = load_geojson_file("vulnerable_infrastructure.geojson")
    features = data.get("features", [])

    if category:
        features = [f for f in features if f["properties"].get("category", "").upper() == category.upper()]
    if zone_id:
        features = [f for f in features if f["properties"].get("zone_id", "").upper() == zone_id.upper()]
    if max_elevation is not None:
        features = [f for f in features if f["properties"].get("ground_elevation_m", 999.0) <= max_elevation]

    return {
        "type": "FeatureCollection",
        "name": "Filtered_Vulnerable_Infrastructure",
        "features": features,
    }


@router.get("/geojson/shelters", summary="Get High-Ground Cyclone Relief Shelters (GeoJSON)")
def get_safe_shelters(zone_id: Optional[str] = Query(None)):
    """
    Returns designated high-elevation multi-purpose cyclone shelters and evacuation destinations.
    """
    data = load_geojson_file("safe_shelters.geojson")
    features = data.get("features", [])
    if zone_id:
        features = [f for f in features if f["properties"].get("zone_id", "").upper() == zone_id.upper()]

    return {
        "type": "FeatureCollection",
        "name": "Highland_Shelters",
        "features": features,
    }


@router.get("/geojson/roads", summary="Get Submersible Coastal Roadways (GeoJSON)")
def get_submersible_roads(zone_id: Optional[str] = Query(None)):
    """
    Returns submersible road networks and cutoff thresholds.
    """
    data = load_geojson_file("submersible_roads.geojson")
    features = data.get("features", [])
    if zone_id:
        features = [f for f in features if f["properties"].get("zone_id", "").upper() == zone_id.upper()]

    return {
        "type": "FeatureCollection",
        "name": "Submersible_Roads",
        "features": features,
    }


def resolve_zone_target(db: Session, zone_id: Optional[str] = None, zone_name: Optional[str] = None) -> tuple[str, str]:
    """Helper to match a zone by ID or Name, with DB and seed fallbacks."""
    from scripts.seed_db import COASTAL_SEEDS

    # 1. Match by zone_id
    if zone_id and zone_id.strip():
        clean_id = zone_id.strip().upper()
        try:
            db_zone = db.query(Zone).filter(Zone.id == clean_id).first()
            if db_zone:
                return db_zone.id, db_zone.name
        except Exception:
            pass
        for s in COASTAL_SEEDS:
            if s["id"].upper() == clean_id:
                return s["id"], s["name"]

    # 2. Match by zone_name
    if zone_name and zone_name.strip():
        query_name = zone_name.strip().lower()
        try:
            db_zones = db.query(Zone).all()
            for z in db_zones:
                if query_name in z.name.lower() or z.name.lower() in query_name:
                    return z.id, z.name
        except Exception:
            pass
        for s in COASTAL_SEEDS:
            if query_name in s["name"].lower() or s["name"].lower() in query_name:
                return s["id"], s["name"]

    available = ", ".join([f"{s['id']} ({s['name']})" for s in COASTAL_SEEDS])
    raise HTTPException(
        status_code=400,
        detail=f"Could not resolve zone for zone_id='{zone_id}' or zone_name='{zone_name}'. Available zones: {available}",
    )


@router.get("/", summary="List All Monitored Coastal Zones with Infrastructure")
def list_zones(db: Session = Depends(get_db)):
    zones = []
    try:
        zones = db.query(Zone).all()
    except Exception:
        zones = []

    if not zones:
        from scripts.seed_db import COASTAL_SEEDS
        return COASTAL_SEEDS

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


# ------------------------------------------------------------------------------
# Static Phone Subscription routes (defined BEFORE variable /{zone_id} route)
# ------------------------------------------------------------------------------
@router.post("/subscribe-sms", response_model=ZoneSubscriptionResponse, summary="Connect Phone Number to a Coastal Zone for Auto-SMS Alerts")
def subscribe_phone_to_zone(req: ZonePhoneSubscriptionRequest, db: Session = Depends(get_db)):
    """
    Connects a phone number with a zone_id and zone_name.
    Whenever the AI model detects this zone as CRITICAL, an automatic SMS alert
    is immediately dispatched to this phone number via the TextBee SMS gateway.
    """
    if not req.phone_number or not req.phone_number.strip():
        raise HTTPException(status_code=400, detail="phone_number is required.")

    target_zone_id, target_zone_name = resolve_zone_target(db, zone_id=req.zone_id, zone_name=req.zone_name)

    sub = sms_service.register_zone_subscription(
        phone_number=req.phone_number,
        zone_id=target_zone_id,
        zone_name=target_zone_name,
        name=req.name,
        db=db,
    )

    return ZoneSubscriptionResponse(
        success=True,
        message=f"Phone number {sub['phone_number']} successfully connected to {target_zone_id} ({target_zone_name}). Automatic SMS alerts will trigger when this zone reaches CRITICAL.",
        subscription=ZoneSubscriptionItem(**sub),
    )


@router.get("/subscribers", response_model=ZoneSubscriptionListResponse, summary="List All Connected Zone Phone Numbers")
def list_all_subscribers(db: Session = Depends(get_db)):
    """Returns all active phone numbers connected across all coastal zones."""
    subscribers = sms_service.get_subscribers_for_zone(zone_id=None, db=db)
    items = [ZoneSubscriptionItem(**s) for s in subscribers]
    return ZoneSubscriptionListResponse(
        total_count=len(items),
        subscriptions=items,
    )


@router.delete("/unsubscribe-sms", summary="Disconnect Phone Number from Zone Alerts")
def unsubscribe_phone(phone_number: str, zone_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Unsubscribes a phone number from receiving automated critical flood alerts."""
    removed = sms_service.remove_zone_subscription(
        phone_number=phone_number,
        zone_id=zone_id,
        db=db,
    )
    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"Subscription not found for phone '{phone_number}'" + (f" and zone '{zone_id}'" if zone_id else ""),
        )
    return {
        "success": True,
        "message": f"Successfully unsubscribed {phone_number} from alert notifications.",
    }


# ------------------------------------------------------------------------------
# Variable /{zone_id} parameter routes
# ------------------------------------------------------------------------------
@router.get("/{zone_id}", summary="Get Detailed Zone Profile and Facilities")
def get_zone_details(zone_id: str, db: Session = Depends(get_db)):
    clean_id = zone_id.upper()
    zone = None
    try:
        zone = db.query(Zone).filter(Zone.id == clean_id).first()
    except Exception:
        zone = None

    if zone:
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

    from scripts.seed_db import COASTAL_SEEDS
    for s in COASTAL_SEEDS:
        if s["id"].upper() == clean_id:
            return s

    raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")


@router.get("/{zone_id}/subscribers", response_model=ZoneSubscriptionListResponse, summary="List Phone Numbers Connected to a Specific Zone")
def list_zone_subscribers(zone_id: str, db: Session = Depends(get_db)):
    """Returns all phone numbers registered to receive auto-SMS alerts for this zone."""
    subscribers = sms_service.get_subscribers_for_zone(zone_id=zone_id, db=db)
    items = [ZoneSubscriptionItem(**s) for s in subscribers]
    return ZoneSubscriptionListResponse(
        total_count=len(items),
        zone_id=zone_id.upper(),
        subscriptions=items,
    )


@router.post("/{zone_id}/test-critical-sms", summary="Trigger Instant Test Critical Alert SMS for Connected Numbers")
def test_critical_sms_for_zone(zone_id: str, db: Session = Depends(get_db)):
    """
    Manually triggers the critical alert SMS pipeline for this zone, immediately
    sending an emergency SMS to all connected phone numbers to verify connectivity.
    """
    target_id, target_name = resolve_zone_target(db, zone_id=zone_id)
    result = sms_service.dispatch_critical_zone_alert(
        zone_id=target_id,
        zone_name=target_name,
        projected_depth_m=1.85,
        onset_min=25,
        peak_min=110,
        sms_text=f"TEST CRITICAL FLOOD ALERT: {target_name} simulated water depth 1.85m. This is a system verification of your connected emergency SMS service.",
        db=db,
    )
    if not result:
        return {
            "success": False,
            "message": f"No active phone numbers connected to {target_id} ({target_name}). Please subscribe a phone number first using POST /api/v1/zones/subscribe-sms.",
            "data": None,
        }
    return {
        "success": True,
        "message": f"Dispatched critical SMS alert to {result['recipients_count']} subscriber(s) connected to {target_id}.",
        "data": result,
    }

@router.get("/{zone_id}/sms-logs", response_model=SMSLogListResponse, summary="Get SMS Dispatch Logs for this Zone")
def get_zone_sms_logs(zone_id: str, limit: int = 100, db: Session = Depends(get_db)):
    """Retrieve historical log of all SMS alerts dispatched for this zone."""
    target_id, _ = resolve_zone_target(db, zone_id=zone_id)
    logs = sms_service.get_sms_logs(zone_id=target_id, limit=limit, db=db)
    items = [SMSLogItem(**l) for l in logs]
    return SMSLogListResponse(
        total_count=len(items),
        zone_id=target_id,
        logs=items,
    )
