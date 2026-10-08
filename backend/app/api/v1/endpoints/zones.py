from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.zone import CoastalZone, ZoneDetailResponse, Coordinates, CriticalFacility
from app.schemas.simulation import ThreatLevel

router = APIRouter()

MOCK_ZONES: List[CoastalZone] = [
    CoastalZone(
        id="ZONE-01",
        name="Mangalore Coastal Estuary & Sector 4",
        state="Karnataka",
        coastal_region="West Coast",
        elevation_meters=0.8,
        risk_level=ThreatLevel.HIGH,
        population=14200,
        coordinates=Coordinates(latitude=12.9141, longitude=74.8560),
        critical_facilities=[
            CriticalFacility(
                id="FAC-01",
                name="District General Hospital",
                facility_type="hospital",
                elevation_meters=3.2,
                is_operational=True,
                coordinates=Coordinates(latitude=12.9150, longitude=74.8570),
            ),
            CriticalFacility(
                id="FAC-02",
                name="Highland Relief Shelter #1",
                facility_type="shelter",
                elevation_meters=15.0,
                is_operational=True,
                coordinates=Coordinates(latitude=12.9200, longitude=74.8600),
            ),
        ],
        water_body_connections=["Netravati River", "Gurupura River", "Arabian Sea"],
    ),
    CoastalZone(
        id="ZONE-02",
        name="Udupi Lowlands & Malpe Harbor Area",
        state="Karnataka",
        coastal_region="West Coast",
        elevation_meters=1.3,
        risk_level=ThreatLevel.MEDIUM,
        population=8900,
        coordinates=Coordinates(latitude=13.3409, longitude=74.7421),
        critical_facilities=[
            CriticalFacility(
                id="FAC-03",
                name="Malpe Port Emergency Station",
                facility_type="port",
                elevation_meters=1.8,
                is_operational=True,
                coordinates=Coordinates(latitude=13.3420, longitude=74.7430),
            )
        ],
        water_body_connections=["Malpe Estuary", "Arabian Sea"],
    ),
    CoastalZone(
        id="ZONE-03",
        name="Kochi Backwaters Basin",
        state="Kerala",
        coastal_region="South-West Coast",
        elevation_meters=0.5,
        risk_level=ThreatLevel.CRITICAL,
        population=32000,
        coordinates=Coordinates(latitude=9.9312, longitude=76.2673),
        critical_facilities=[],
        water_body_connections=["Vembanad Lake", "Periyar River", "Arabian Sea"],
    ),
]


@router.get("/", response_model=List[CoastalZone], summary="List All Monitored Coastal Zones")
def list_zones():
    return MOCK_ZONES


@router.get("/{zone_id}", response_model=ZoneDetailResponse, summary="Get Zone Details and Evacuation Info")
def get_zone_details(zone_id: str):
    zone = next((z for z in MOCK_ZONES if z.id.upper() == zone_id.upper()), None)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")

    return ZoneDetailResponse(
        zone=zone,
        current_water_level=1.45,
        historical_max_flood_height=2.8,
        safe_evacuation_routes=[
            "Route 1: NH-66 Elevated Highway to Northern Shelter",
            "Route 2: Bypass Expressway via Ridge Line #4",
        ],
    )
