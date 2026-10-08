export const REAL_MAP_TILE_SOURCE = {
    id: "openfree-map-data",
    tiles: ["https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf"],
    attribution: "OpenFreeMap, OpenStreetMap contributors, OpenMapTiles",
    sourceLayers: {
        transport: "transportation",
        water: "water",
    },
} as const;

export const TRAFFIC_TILE_URL = process.env.NEXT_PUBLIC_TRAFFIC_TILE_URL || null;
export const TRAFFIC_SOURCE_LAYER = process.env.NEXT_PUBLIC_TRAFFIC_SOURCE_LAYER || "traffic";
export const TRAFFIC_ATTRIBUTION = process.env.NEXT_PUBLIC_TRAFFIC_ATTRIBUTION || "Configured traffic provider";

export type MapDataLayerKey = "transport" | "traffic" | "waterBodies";

export const MAP_DATA_LAYER_INFO: Record<
    MapDataLayerKey,
    { source: string; mode: "real-vector" | "configured-live"; description: string }
> = {
    transport: {
        source: "OpenFreeMap / OpenStreetMap",
        mode: "real-vector",
        description: "Live vector road and transit geometry",
    },
    traffic: {
        source: TRAFFIC_TILE_URL ? "Configured traffic provider" : "Provider not configured",
        mode: "configured-live",
        description: TRAFFIC_TILE_URL ? "Live traffic tile overlay" : "Add a traffic tile URL to enable",
    },
    waterBodies: {
        source: "OpenFreeMap / OpenStreetMap + FloodSight",
        mode: "real-vector",
        description: "Water polygons plus FloodSight channels",
    },
};
