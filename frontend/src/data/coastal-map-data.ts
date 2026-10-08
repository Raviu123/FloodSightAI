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
    zoom: 12.5,
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
    zoom: 12.2,
    pitch: 40,
    bearing: 10,
  },
  {
    id: "chennai",
    name: "Chennai Delta",
    code: "MAA-03",
    state: "Tamil Nadu",
    latitude: 13.035,
    longitude: 80.265,
    zoom: 12.4,
    pitch: 35,
    bearing: 0,
  },
  {
    id: "mumbai",
    name: "Mumbai Coastal Bay",
    code: "BOM-04",
    state: "Maharashtra",
    latitude: 18.965,
    longitude: 72.825,
    zoom: 12.0,
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

// --- GEOJSON DATASETS ---

// 1. Danger Zone Classification Polygons
export const DANGER_ZONES_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "ZONE-CRIT-01",
        name: "Netravati River Confluence Sector",
        sectorCode: "SEC-KA-01",
        riskLevel: "CRITICAL",
        riskColor: "#ef4444",
        elevationMeters: 0.6,
        population: 14200,
        peakSurgeTime: "14:30 IST",
        recommendation: "Mandatory Evacuation Order Issued",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [74.825, 12.855],
            [74.848, 12.862],
            [74.855, 12.845],
            [74.838, 12.835],
            [74.825, 12.855],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ZONE-HIGH-02",
        name: "Ullal Coastal Spit & Lowlands",
        sectorCode: "SEC-KA-02",
        riskLevel: "HIGH",
        riskColor: "#f97316",
        elevationMeters: 1.2,
        population: 9800,
        peakSurgeTime: "15:15 IST",
        recommendation: "Emergency Standby & Barrier Deployment",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [74.838, 12.835],
            [74.862, 12.842],
            [74.858, 12.815],
            [74.832, 12.812],
            [74.838, 12.835],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ZONE-MED-03",
        name: "Bengre Sand Spit & Port Basin",
        sectorCode: "SEC-KA-03",
        riskLevel: "MEDIUM",
        riskColor: "#eab308",
        elevationMeters: 2.1,
        population: 5300,
        peakSurgeTime: "16:45 IST",
        recommendation: "Coastal Advisory & Craft Suspension",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [74.815, 12.875],
            [74.835, 12.885],
            [74.838, 12.860],
            [74.818, 12.852],
            [74.815, 12.875],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ZONE-SAFE-04",
        name: "Kadri & Highlands Assembly Area",
        sectorCode: "SEC-KA-04",
        riskLevel: "NO_DANGER",
        riskColor: "#10b981",
        elevationMeters: 18.5,
        population: 34000,
        peakSurgeTime: "Safe Zone",
        recommendation: "Designated Logistics & Shelter Hub",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [74.848, 12.885],
            [74.878, 12.895],
            [74.885, 12.865],
            [74.855, 12.862],
            [74.848, 12.885],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ZONE-KOCHI-01",
        name: "Vembanad Backwater Basin",
        sectorCode: "SEC-KL-01",
        riskLevel: "HIGH",
        riskColor: "#f97316",
        elevationMeters: 0.7,
        population: 28000,
        peakSurgeTime: "15:00 IST",
        recommendation: "High-Volume Siphon Pump Operations Active",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [76.265, 9.950],
            [76.300, 9.965],
            [76.310, 9.930],
            [76.275, 9.920],
            [76.265, 9.950],
          ],
        ],
      },
    },
  ],
};

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

// 6. Dynamic Flood Propagation Generator
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
