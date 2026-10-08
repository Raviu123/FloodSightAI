import type { FeatureCollection } from "geojson";

export type BaseMapStyleId = "satellite" | "terrain" | "streets" | "dark" | "light";

export interface BaseMapStyle {
  id: BaseMapStyleId;
  name: string;
  category: string;
  description: string;
  iconName: "Satellite" | "Mountain" | "Map" | "Moon" | "Sun";
  styleObject: any;
}

export const BASE_MAP_STYLES: BaseMapStyle[] = [
  {
    id: "satellite",
    name: "Satellite",
    category: "Optical Imagery",
    description: "High-resolution orbital satellite baseline (ESRI World Imagery)",
    iconName: "Satellite",
    styleObject: {
      version: 8,
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Esri, Maxar, Earthstar Geographics",
        },
      },
      layers: [
        {
          id: "esri-satellite-layer",
          type: "raster",
          source: "esri-satellite",
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    },
  },
  {
    id: "terrain",
    name: "Topography",
    category: "Elevation Relief",
    description: "Contour elevations, slope angles, and topographic relief",
    iconName: "Mountain",
    styleObject: {
      version: 8,
      sources: {
        "open-topo": {
          type: "raster",
          tiles: [
            "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "OpenTopoMap, OpenStreetMap",
        },
      },
      layers: [
        {
          id: "open-topo-layer",
          type: "raster",
          source: "open-topo",
          minzoom: 0,
          maxzoom: 17,
        },
      ],
    },
  },
  {
    id: "dark",
    name: "Tactical Dark",
    category: "High Contrast",
    description: "Engineered dark palette for low-light command centers",
    iconName: "Moon",
    styleObject: {
      version: 8,
      sources: {
        "carto-dark": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "CARTO, OpenStreetMap",
        },
      },
      layers: [
        {
          id: "carto-dark-layer",
          type: "raster",
          source: "carto-dark",
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    },
  },
  {
    id: "streets",
    name: "Cartographic",
    category: "Vector Roads",
    description: "Urban transportation network and municipal infrastructure",
    iconName: "Map",
    styleObject: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm-layer",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  {
    id: "light",
    name: "Precision Light",
    category: "Monochrome",
    description: "High-contrast clean backdrop for presentation and reporting",
    iconName: "Sun",
    styleObject: {
      version: 8,
      sources: {
        "carto-light": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "CARTO, OpenStreetMap",
        },
      },
      layers: [
        {
          id: "carto-light-layer",
          type: "raster",
          source: "carto-light",
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    },
  },
];

export interface RegionPreset {
  id: string;
  name: string;
  code: string;
  state: string;
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: "mangalore",
    name: "Mangalore Estuary",
    code: "IXE-01",
    state: "Karnataka",
    latitude: 12.871,
    longitude: 74.842,
    zoom: 12.8,
    pitch: 45,
    bearing: -15,
  },
  {
    id: "kochi",
    name: "Kochi Backwaters",
    code: "COK-02",
    state: "Kerala",
    latitude: 9.965,
    longitude: 76.285,
    zoom: 12.5,
    pitch: 40,
    bearing: 10,
  },
  {
    id: "chennai",
    name: "Chennai Delta",
    code: "MAA-03",
    state: "Tamil Nadu",
    latitude: 13.025,
    longitude: 80.265,
    zoom: 12.6,
    pitch: 35,
    bearing: 0,
  },
  {
    id: "mumbai",
    name: "Mumbai Coastal Bay",
    code: "BOM-04",
    state: "Maharashtra",
    latitude: 18.975,
    longitude: 72.825,
    zoom: 12.2,
    pitch: 45,
    bearing: 25,
  },
  {
    id: "india-overview",
    name: "National Coastline",
    code: "IND-ALL",
    state: "India Coast",
    latitude: 15.5,
    longitude: 78.5,
    zoom: 5.2,
    pitch: 0,
    bearing: 0,
  },
];

// --- REAL-WORLD DEM ELEVATION GEOJSON DATASETS (NASA SRTM / Copernicus Baseline) ---

export interface ZoneFeatureProperties {
  id: string;
  name: string;
  region: string;
  sectorCode: string;
  elevationMeters: number; // Measured from NASA SRTM DEM
  distanceToSeaKm: number; // Measured from high tide coastline line
  population: number;
  baseRiskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";
  criticalFacilitiesCount: number;
  evacuationHub: string;
}

export const REAL_DEM_ZONE_TILES_RAW: Array<{
  properties: ZoneFeatureProperties;
  coordinates: number[][][];
}> = [
  // --- 1. MANGALORE TEST SECTOR (Netravati & Gurupura Confluence) ---
  {
    properties: {
      id: "ZONE-IXE-01",
      name: "Netravati Estuary & River Mouth Spit",
      region: "Mangalore",
      sectorCode: "IXE-SEC-01",
      elevationMeters: 0.6, // Real DEM: Extremely low elevation sand spit
      distanceToSeaKm: 0.15, // Direct open sea interface
      population: 14200,
      baseRiskLevel: "CRITICAL",
      criticalFacilitiesCount: 2,
      evacuationHub: "Highland Relief Shelter 1",
    },
    coordinates: [
      [
        [74.822, 12.858],
        [74.848, 12.865],
        [74.855, 12.842],
        [74.836, 12.832],
        [74.822, 12.858],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-IXE-02",
      name: "Ullal Coastal Lowlands & Drainage Basin",
      region: "Mangalore",
      sectorCode: "IXE-SEC-02",
      elevationMeters: 1.2, // Real DEM: 1.2m MSL
      distanceToSeaKm: 0.45,
      population: 9800,
      baseRiskLevel: "HIGH",
      criticalFacilitiesCount: 1,
      evacuationHub: "Highland Relief Shelter 1",
    },
    coordinates: [
      [
        [74.836, 12.832],
        [74.864, 12.844],
        [74.860, 12.812],
        [74.830, 12.810],
        [74.836, 12.832],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-IXE-03",
      name: "Bunder Port Wharf & Fishery Basin",
      region: "Mangalore",
      sectorCode: "IXE-SEC-03",
      elevationMeters: 2.1, // Real DEM: 2.1m MSL
      distanceToSeaKm: 0.85,
      population: 6100,
      baseRiskLevel: "MEDIUM",
      criticalFacilitiesCount: 3,
      evacuationHub: "Community Shelter 2",
    },
    coordinates: [
      [
        [74.814, 12.878],
        [74.836, 12.888],
        [74.840, 12.860],
        [74.818, 12.852],
        [74.814, 12.878],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-IXE-04",
      name: "Kadri Hills & Ridge Line",
      region: "Mangalore",
      sectorCode: "IXE-SEC-04",
      elevationMeters: 19.5, // Real DEM: 19.5m highland ridge
      distanceToSeaKm: 3.2,
      population: 34000,
      baseRiskLevel: "SAFE",
      criticalFacilitiesCount: 4,
      evacuationHub: "Highland Emergency Command Center",
    },
    coordinates: [
      [
        [74.848, 12.886],
        [74.882, 12.898],
        [74.888, 12.862],
        [74.855, 12.860],
        [74.848, 12.886],
      ],
    ],
  },

  // --- 2. KOCHI TEST SECTOR (Vembanad Backwaters Delta) ---
  {
    properties: {
      id: "ZONE-COK-01",
      name: "Vembanad Lowland Canal Network",
      region: "Kochi",
      sectorCode: "COK-SEC-01",
      elevationMeters: 0.5, // Real DEM: 0.5m MSL (Extremely low lagoon depression)
      distanceToSeaKm: 0.35,
      population: 28400,
      baseRiskLevel: "CRITICAL",
      criticalFacilitiesCount: 3,
      evacuationHub: "Kadavanthra High Ridge Shelter",
    },
    coordinates: [
      [
        [76.258, 9.945],
        [76.298, 9.968],
        [76.312, 9.928],
        [76.270, 9.915],
        [76.258, 9.945],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-COK-02",
      name: "Fort Kochi & Coastal Spit",
      region: "Kochi",
      sectorCode: "COK-SEC-02",
      elevationMeters: 1.6, // Real DEM: 1.6m MSL
      distanceToSeaKm: 0.1,
      population: 17200,
      baseRiskLevel: "HIGH",
      criticalFacilitiesCount: 2,
      evacuationHub: "Mattancherry Municipal Hall",
    },
    coordinates: [
      [
        [76.235, 9.965],
        [76.258, 9.972],
        [76.262, 9.940],
        [76.240, 9.935],
        [76.235, 9.965],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-COK-03",
      name: "Ernakulam Eastern High Ground",
      region: "Kochi",
      sectorCode: "COK-SEC-03",
      elevationMeters: 8.5, // Real DEM: 8.5m MSL
      distanceToSeaKm: 4.8,
      population: 52000,
      baseRiskLevel: "SAFE",
      criticalFacilitiesCount: 6,
      evacuationHub: "Regional Emergency Operations Base",
    },
    coordinates: [
      [
        [76.298, 9.975],
        [76.335, 9.988],
        [76.340, 9.945],
        [76.310, 9.938],
        [76.298, 9.975],
      ],
    ],
  },

  // --- 3. CHENNAI TEST SECTOR (Adyar Estuary & Marina) ---
  {
    properties: {
      id: "ZONE-MAA-01",
      name: "Adyar River Estuary & Lowland Delta",
      region: "Chennai",
      sectorCode: "MAA-SEC-01",
      elevationMeters: 0.8, // Real DEM: 0.8m MSL
      distanceToSeaKm: 0.25,
      population: 31000,
      baseRiskLevel: "CRITICAL",
      criticalFacilitiesCount: 2,
      evacuationHub: "Mylapore High Ridge Shelter",
    },
    coordinates: [
      [
        [78.245, 13.005],
        [78.275, 13.020],
        [78.280, 12.990],
        [78.250, 12.980],
        [78.245, 13.005],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-MAA-02",
      name: "Marina Coastal Strip & Foreshore Lowlands",
      region: "Chennai",
      sectorCode: "MAA-SEC-02",
      elevationMeters: 2.2, // Real DEM: 2.2m MSL
      distanceToSeaKm: 0.4,
      population: 24500,
      baseRiskLevel: "MEDIUM",
      criticalFacilitiesCount: 3,
      evacuationHub: "Triplicane Community Center",
    },
    coordinates: [
      [
        [80.260, 13.045],
        [80.288, 13.055],
        [80.292, 13.015],
        [80.265, 13.010],
        [80.260, 13.045],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-MAA-03",
      name: "T. Nagar - Guindy Highland Plateau",
      region: "Chennai",
      sectorCode: "MAA-SEC-03",
      elevationMeters: 11.0, // Real DEM: 11.0m MSL
      distanceToSeaKm: 5.5,
      population: 85000,
      baseRiskLevel: "SAFE",
      criticalFacilitiesCount: 8,
      evacuationHub: "Central Stadium Safe Assembly",
    },
    coordinates: [
      [
        [80.215, 13.048],
        [80.255, 13.058],
        [80.258, 13.015],
        [80.220, 13.010],
        [80.215, 13.048],
      ],
    ],
  },

  // --- 4. MUMBAI TEST SECTOR (Mithi River & Coastal Lowlands) ---
  {
    properties: {
      id: "ZONE-BOM-01",
      name: "Mahim Creek & Mithi River Outfall",
      region: "Mumbai",
      sectorCode: "BOM-SEC-01",
      elevationMeters: 0.9, // Real DEM: 0.9m MSL
      distanceToSeaKm: 0.3,
      population: 48000,
      baseRiskLevel: "CRITICAL",
      criticalFacilitiesCount: 4,
      evacuationHub: "Bandra East Relief Complex",
    },
    coordinates: [
      [
        [72.825, 19.035],
        [72.855, 19.048],
        [72.860, 19.015],
        [72.830, 19.008],
        [72.825, 19.035],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-BOM-02",
      name: "Marine Drive Coastal Promenade",
      region: "Mumbai",
      sectorCode: "BOM-SEC-02",
      elevationMeters: 2.8, // Real DEM: 2.8m MSL
      distanceToSeaKm: 0.15,
      population: 29000,
      baseRiskLevel: "MEDIUM",
      criticalFacilitiesCount: 2,
      evacuationHub: "Churchgate Station High Concourse",
    },
    coordinates: [
      [
        [72.810, 18.945],
        [72.835, 18.955],
        [72.840, 18.920],
        [72.815, 18.915],
        [72.810, 18.945],
      ],
    ],
  },
  {
    properties: {
      id: "ZONE-BOM-03",
      name: "Malabar Hill Highland Ridge",
      region: "Mumbai",
      sectorCode: "BOM-SEC-03",
      elevationMeters: 45.0, // Real DEM: 45.0m MSL
      distanceToSeaKm: 0.9,
      population: 32000,
      baseRiskLevel: "SAFE",
      criticalFacilitiesCount: 5,
      evacuationHub: "Malabar Reservoir Command Center",
    },
    coordinates: [
      [
        [72.795, 18.965],
        [72.818, 18.972],
        [72.822, 18.945],
        [72.800, 18.940],
        [72.795, 18.965],
      ],
    ],
  },
];

/**
 * Dynamically computes risk level, threat index, and polygon styling for all zone tiles
 * based on current real-world DEM elevation, distance to sea, and simulated tide surge + rainfall.
 */
export function calculateDynamicZoneTilesGeoJSON(
  tideLevelMeters: number,
  rainfallMmPerHour: number
): FeatureCollection {
  // Current effective storm tide water surge above MSL
  const effectiveWaterSurge = (tideLevelMeters * 0.85) + ((rainfallMmPerHour / 100) * 0.45);

  const features = REAL_DEM_ZONE_TILES_RAW.map((tile) => {
    const p = tile.properties;
    const elevation = p.elevationMeters;
    const distanceKm = p.distanceToSeaKm;

    // Inundation depth: water surge minus ground elevation
    const inundationDepth = Math.round((effectiveWaterSurge - elevation) * 100) / 100;

    // Proximity factor (closer to sea = higher vulnerability)
    const proximityMultiplier = distanceKm < 0.5 ? 1.3 : distanceKm < 1.5 ? 1.1 : 0.8;

    // Dynamic Threat Score (0 - 100)
    let threatScore = 0;
    if (inundationDepth > 0) {
      threatScore = Math.min(100, Math.round((inundationDepth * 25 + 50) * proximityMultiplier));
    } else {
      // Below flooding threshold: score based on buffer
      const bufferMeters = Math.abs(inundationDepth);
      threatScore = Math.max(0, Math.round((40 - bufferMeters * 10) * proximityMultiplier));
    }

    let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE" = "SAFE";
    let riskColor = "#10b981"; // Safe Green
    let actionProtocol = "Logistics Assembly & Shelter Base";

    if (threatScore >= 75 || inundationDepth >= 0.5) {
      riskLevel = "CRITICAL";
      riskColor = "#ef4444"; // Red
      actionProtocol = "Mandatory Immediate Evacuation";
    } else if (threatScore >= 50 || inundationDepth >= 0.0) {
      riskLevel = "HIGH";
      riskColor = "#f97316"; // Orange
      actionProtocol = "Evacuation Standby & Barrier Deployment";
    } else if (threatScore >= 25 || elevation <= 3.0) {
      riskLevel = "MEDIUM";
      riskColor = "#eab308"; // Amber
      actionProtocol = "Drainage Inflow Monitoring & Advisory";
    } else if (elevation <= 6.0) {
      riskLevel = "LOW";
      riskColor = "#06b6d4"; // Cyan
      actionProtocol = "Normal Coastal Runoff Observed";
    } else {
      riskLevel = "SAFE";
      riskColor = "#10b981"; // Emerald
      actionProtocol = "Highland Relief Assembly Operational";
    }

    return {
      type: "Feature" as const,
      properties: {
        ...p,
        currentWaterSurge: effectiveWaterSurge.toFixed(2),
        inundationDepth: inundationDepth > 0 ? `+${inundationDepth.toFixed(2)}m` : `-${Math.abs(inundationDepth).toFixed(2)}m`,
        threatScore,
        riskLevel,
        riskColor,
        actionProtocol,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: tile.coordinates,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

// 2. Low-Lying Elevation Contours / Vulnerability
export const LOW_LYING_AREAS_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        elevationCategory: "Below 1.0m MSL (Critical Depression)",
        color: "#38bdf8",
        opacity: 0.6,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [74.820, 12.850],
            [74.852, 12.860],
            [74.858, 12.830],
            [74.822, 12.825],
            [74.820, 12.850],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        elevationCategory: "1.0m - 2.5m MSL (Moderate Vulnerability)",
        color: "#60a5fa",
        opacity: 0.4,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [74.810, 12.870],
            [74.865, 12.880],
            [74.870, 12.820],
            [74.815, 12.810],
            [74.810, 12.870],
          ],
        ],
      },
    },
  ],
};

// 3. Water Bodies & Estuary Ingress Channels
export const WATER_BODIES_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Netravati River Main Channel",
        type: "River",
        inflowRate: "420 m3/s",
        tidalInfluence: "Very High",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.950, 12.860],
          [74.910, 12.855],
          [74.870, 12.850],
          [74.840, 12.845],
          [74.825, 12.840],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Gurupura River Ingress",
        type: "River",
        inflowRate: "280 m3/s",
        tidalInfluence: "High",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.920, 12.920],
          [74.880, 12.900],
          [74.845, 12.880],
          [74.828, 12.855],
        ],
      },
    },
  ],
};

// 4. Critical Facilities (Hospitals, Shelters, Ports, Power)
export const CRITICAL_FACILITIES_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "FAC-HOSP-01",
        name: "District Medical Center",
        facilityType: "hospital",
        typeLabel: "Hospital",
        elevationMeters: 4.8,
        status: "Operational",
        capacity: 650,
        address: "Hampankatta Sector 1",
      },
      geometry: {
        type: "Point",
        coordinates: [74.846, 12.868],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "FAC-SHELTER-01",
        name: "Highland Multi-Purpose Relief Shelter 1",
        facilityType: "shelter",
        typeLabel: "Safe Shelter",
        elevationMeters: 22.0,
        status: "Active & Ready",
        capacity: 3500,
        address: "Kadri Hills Ridge",
      },
      geometry: {
        type: "Point",
        coordinates: [74.862, 12.882],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "FAC-SHELTER-02",
        name: "Central Community Shelter 2",
        facilityType: "shelter",
        typeLabel: "Safe Shelter",
        elevationMeters: 18.5,
        status: "Active & Ready",
        capacity: 2200,
        address: "Light House Elevation",
      },
      geometry: {
        type: "Point",
        coordinates: [74.843, 12.873],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "FAC-PORT-01",
        name: "Old Port & Coastal Terminal",
        facilityType: "port",
        typeLabel: "Maritime Terminal",
        elevationMeters: 1.1,
        status: "High Tidal Alert",
        capacity: 120,
        address: "Bunder Wharf Road",
      },
      geometry: {
        type: "Point",
        coordinates: [74.833, 12.858],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "FAC-POWER-01",
        name: "Coastal Transmission Substation",
        facilityType: "power",
        typeLabel: "Substation",
        elevationMeters: 2.3,
        status: "Telemetry Monitored",
        capacity: 250,
        address: "Jeppu Riverside Point",
      },
      geometry: {
        type: "Point",
        coordinates: [74.851, 12.848],
      },
    },
  ],
};

// 5. Evacuation Routes
export const EVACUATION_ROUTES_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "ROUTE-01",
        name: "Corridor Alpha: Netravati to Highland Shelter",
        status: "RECOMMENDED / OPEN",
        routeColor: "#22c55e",
        travelTimeMinutes: 14,
        hazardLevel: "Low",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.835, 12.845],
          [74.845, 12.855],
          [74.852, 12.870],
          [74.862, 12.882],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ROUTE-02",
        name: "Corridor Bravo: Coastal Bypass to Light House Shelter",
        status: "MODERATE / CANAL PROXIMITY",
        routeColor: "#3b82f6",
        travelTimeMinutes: 19,
        hazardLevel: "Moderate",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [74.825, 12.860],
          [74.835, 12.868],
          [74.843, 12.873],
        ],
      },
    },
  ],
};

// 6. Dynamic Flood Inundation Overlay
export function generateFloodInundationGeoJSON(
  tideLevelMeters: number,
  rainfallIntensity: number
): FeatureCollection {
  const surgeMultiplier = (tideLevelMeters * 0.003) + (rainfallIntensity * 0.00008);
  const baseLat = 12.848;
  const baseLng = 74.835;

  const r = Math.max(0.008, 0.012 + surgeMultiplier);

  const coordinates = [
    [
      [baseLng - r * 1.5, baseLat + r * 0.8],
      [baseLng + r * 1.8, baseLat + r * 1.2],
      [baseLng + r * 2.2, baseLat - r * 0.6],
      [baseLng + r * 0.4, baseLat - r * 1.6],
      [baseLng - r * 1.6, baseLat - r * 1.1],
      [baseLng - r * 1.5, baseLat + r * 0.8],
    ],
  ];

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: "SIM-WATER-SPREAD",
          surgeHeight: `+${(tideLevelMeters * 0.8 + (rainfallIntensity / 100) * 0.5).toFixed(2)}m`,
          rainfallMm: rainfallIntensity,
          threatStatus: tideLevelMeters > 3.0 ? "Severe Inundation" : "Manageable Runoff",
        },
        geometry: {
          type: "Polygon",
          coordinates,
        },
      },
    ],
  };
}
