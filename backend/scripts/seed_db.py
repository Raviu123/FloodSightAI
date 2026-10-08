import os
import sys

# Add backend root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, init_db
from app.models.zone import Zone, CriticalFacility, AffectedRoad

COASTAL_SEEDS = [
    {
        "id": "ZONE-01",
        "name": "Mangalore Estuary & Netravati Confluence",
        "state": "Karnataka",
        "region": "West Coast",
        "latitude": 12.8615,
        "longitude": 74.8430,
        "elevation_meters": 0.8,
        "population": 14200,
        "dist_to_coast_km": 0.35,
        "dist_to_river_km": 0.05,
        "drainage_capacity_pct": 32.0,
        "soil_saturation_base": 0.78,
        "polygon_coordinates": [
            [74.835, 12.855], [74.855, 12.855], [74.858, 12.870], [74.838, 12.870], [74.835, 12.855]
        ],
        "facilities": [
            {"name": "Mangalore City Trauma Center", "facility_type": "HOSPITAL", "latitude": 12.8640, "longitude": 74.8450, "elevation_meters": 1.1, "capacity": 350},
            {"name": "Netravati Highland Emergency Shelter", "facility_type": "SHELTER", "latitude": 12.8720, "longitude": 74.8520, "elevation_meters": 14.5, "capacity": 2500},
            {"name": "Jeppu Power Grid Substation", "facility_type": "POWER_SUBSTATION", "latitude": 12.8580, "longitude": 74.8410, "elevation_meters": 0.9, "capacity": 0},
        ],
        "roads": [
            {"name": "NH-66 Netravati Bridge Lowland Approach", "road_type": "HIGHWAY", "elevation_meters": 0.7, "flood_cutoff_depth_m": 0.35},
            {"name": "Bolar Estuary River Road", "road_type": "ARTERIAL", "elevation_meters": 0.5, "flood_cutoff_depth_m": 0.25},
            {"name": "Jeppu Higher Ground Bypass", "road_type": "HIGHWAY", "elevation_meters": 8.5, "flood_cutoff_depth_m": 1.5},
        ]
    },
    {
        "id": "ZONE-02",
        "name": "Udupi Lowland Swamps & Malpe Port Area",
        "state": "Karnataka",
        "region": "West Coast",
        "latitude": 13.3512,
        "longitude": 74.7042,
        "elevation_meters": 1.3,
        "population": 8900,
        "dist_to_coast_km": 0.20,
        "dist_to_river_km": 0.60,
        "drainage_capacity_pct": 45.0,
        "soil_saturation_base": 0.65,
        "polygon_coordinates": [
            [74.695, 13.342], [74.715, 13.342], [74.718, 13.360], [74.698, 13.360], [74.695, 13.342]
        ],
        "facilities": [
            {"name": "Malpe Harbor Maritime Dispensary", "facility_type": "HOSPITAL", "latitude": 13.3530, "longitude": 74.7010, "elevation_meters": 1.4, "capacity": 120},
            {"name": "Udupi Coastal Multi-Purpose Cyclone Shelter", "facility_type": "SHELTER", "latitude": 13.3610, "longitude": 74.7200, "elevation_meters": 12.0, "capacity": 1800},
        ],
        "roads": [
            {"name": "Malpe Port Access Causeway", "road_type": "ARTERIAL", "elevation_meters": 1.0, "flood_cutoff_depth_m": 0.3},
            {"name": "Udupi-Malpe Main Link Road", "road_type": "PRIMARY", "elevation_meters": 4.2, "flood_cutoff_depth_m": 0.8},
        ]
    },
    {
        "id": "ZONE-03",
        "name": "Kochi Backwaters & Canal Network",
        "state": "Kerala",
        "region": "South-West Coast",
        "latitude": 9.9674,
        "longitude": 76.2440,
        "elevation_meters": 0.5,
        "population": 32000,
        "dist_to_coast_km": 1.10,
        "dist_to_river_km": 0.02,
        "drainage_capacity_pct": 28.0,
        "soil_saturation_base": 0.88,
        "polygon_coordinates": [
            [76.230, 9.955], [76.260, 9.955], [76.265, 9.980], [76.235, 9.980], [76.230, 9.955]
        ],
        "facilities": [
            {"name": "General Hospital West Kochi", "facility_type": "HOSPITAL", "latitude": 9.9680, "longitude": 76.2480, "elevation_meters": 0.7, "capacity": 600},
            {"name": "Ernakulam South High-Ground Relief Center", "facility_type": "SHELTER", "latitude": 9.9750, "longitude": 76.2800, "elevation_meters": 16.0, "capacity": 4500},
            {"name": "Willingdon Island Transformer Station", "facility_type": "POWER_SUBSTATION", "latitude": 9.9600, "longitude": 76.2500, "elevation_meters": 0.6, "capacity": 0},
        ],
        "roads": [
            {"name": "Mattancherry Low Canal Ring Road", "road_type": "ARTERIAL", "elevation_meters": 0.4, "flood_cutoff_depth_m": 0.2},
            {"name": "Kochi Marina Bypass Corridor", "road_type": "HIGHWAY", "elevation_meters": 2.2, "flood_cutoff_depth_m": 0.5},
            {"name": "MG Road Elevated Transit Flyover", "road_type": "HIGHWAY", "elevation_meters": 9.0, "flood_cutoff_depth_m": 2.0},
        ]
    },
    {
        "id": "ZONE-04",
        "name": "Chennai Marina Lowlands & Adyar Delta",
        "state": "Tamil Nadu",
        "region": "East Coast",
        "latitude": 13.0102,
        "longitude": 80.2580,
        "elevation_meters": 2.1,
        "population": 45000,
        "dist_to_coast_km": 0.45,
        "dist_to_river_km": 0.15,
        "drainage_capacity_pct": 52.0,
        "soil_saturation_base": 0.60,
        "polygon_coordinates": [
            [80.245, 12.998], [80.275, 12.998], [80.278, 13.025], [80.248, 13.025], [80.245, 12.998]
        ],
        "facilities": [
            {"name": "Adyar Multi-Specialty Health Center", "facility_type": "HOSPITAL", "latitude": 13.0080, "longitude": 80.2520, "elevation_meters": 2.3, "capacity": 400},
            {"name": "Guindy Safe Elevation Community Shelter", "facility_type": "SHELTER", "latitude": 13.0090, "longitude": 80.2100, "elevation_meters": 18.0, "capacity": 5000},
        ],
        "roads": [
            {"name": "Marina Coastal Road (Kamarajar Salai)", "road_type": "ARTERIAL", "elevation_meters": 1.9, "flood_cutoff_depth_m": 0.4},
            {"name": "Adyar Bridge Overpass Link", "road_type": "HIGHWAY", "elevation_meters": 6.5, "flood_cutoff_depth_m": 1.2},
        ]
    },
    {
        "id": "ZONE-05",
        "name": "Visakhapatnam Harbor & Coastal Bay",
        "state": "Andhra Pradesh",
        "region": "East Coast",
        "latitude": 17.6980,
        "longitude": 83.2980,
        "elevation_meters": 3.4,
        "population": 18000,
        "dist_to_coast_km": 0.10,
        "dist_to_river_km": 2.50,
        "drainage_capacity_pct": 68.0,
        "soil_saturation_base": 0.45,
        "polygon_coordinates": [
            [83.285, 17.685], [83.315, 17.685], [83.318, 17.712], [83.288, 17.712], [83.285, 17.685]
        ],
        "facilities": [
            {"name": "Port Trust Central Hospital", "facility_type": "HOSPITAL", "latitude": 17.7020, "longitude": 83.2920, "elevation_meters": 4.1, "capacity": 300},
            {"name": "Kailasagiri Hilltop Evacuation Station", "facility_type": "SHELTER", "latitude": 17.7450, "longitude": 83.3400, "elevation_meters": 35.0, "capacity": 6000},
        ],
        "roads": [
            {"name": "Beach Road Coastal Boulevard", "road_type": "ARTERIAL", "elevation_meters": 2.8, "flood_cutoff_depth_m": 0.5},
            {"name": "NH-16 Harbor Bypass Expressway", "road_type": "HIGHWAY", "elevation_meters": 11.0, "flood_cutoff_depth_m": 2.5},
        ]
    },
]


def seed_database():
    print("Initializing Database tables...")
    init_db()
    db = SessionLocal()

    try:
        print("Seeding coastal zone profiles and infrastructure...")
        for zone_data in COASTAL_SEEDS:
            existing = db.query(Zone).filter(Zone.id == zone_data["id"]).first()
            if existing:
                print(f"  Zone {zone_data['id']} already exists, skipping.")
                continue

            facilities_data = zone_data.pop("facilities", [])
            roads_data = zone_data.pop("roads", [])

            zone = Zone(**zone_data)
            db.add(zone)
            db.flush()

            for fac in facilities_data:
                facility = CriticalFacility(zone_id=zone.id, **fac)
                db.add(facility)

            for rd in roads_data:
                road = AffectedRoad(zone_id=zone.id, **rd)
                db.add(road)

            print(f"  + Seeded {zone.id}: {zone.name} with {len(facilities_data)} facilities & {len(roads_data)} roads.")

        db.commit()
        print("[SUCCESS] Database seeding complete!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
