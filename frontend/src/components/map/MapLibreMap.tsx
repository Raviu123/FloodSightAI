"use client";

import {
    BASE_MAP_STYLES,
    type BaseMapStyleId,
    calculateDynamicZoneCentroidsGeoJSON,
    calculateDynamicZoneTilesGeoJSON,
    CRITICAL_FACILITIES_GEOJSON,
    EVACUATION_ROUTES_GEOJSON,
    generateFloodInundationGeoJSON,
    GOOGLE_FLOOD_HUB_COVERAGE_GEOJSON,
    LOW_LYING_AREAS_GEOJSON,
    REAL_DEM_ZONE_TILES_RAW,
    REGION_PRESETS,
    type RegionPreset,
    WATER_BODIES_GEOJSON,
} from "@/data/coastal-map-data";
import type { FeatureCollection } from "geojson";
import { ChevronDown, ChevronUp, Crosshair, Layers, MapPin, Shield, SlidersHorizontal } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CameraMode, MapLayerControls, type MapLayerState } from "./MapLayerControls";
import { MapLegend } from "./MapLegend";
import { MapOverlayCard } from "./MapOverlayCard";
import { MapQuickJumper } from "./MapQuickJumper";
import { REAL_MAP_TILE_SOURCE, TRAFFIC_ATTRIBUTION, TRAFFIC_SOURCE_LAYER, TRAFFIC_TILE_URL } from "./map-data-sources";

import { fetchIndiaBaseline, fetchIndiaHotspots } from "@/lib/api";

const DEM_SOURCE_ID = "floodsight-dem";
const HILLSHADE_SOURCE_ID = "floodsight-dem-hillshade";
const HILLSHADE_LAYER_ID = "floodsight-hillshade";
const REAL_MAP_SOURCE_ID = REAL_MAP_TILE_SOURCE.id;
const TRANSPORT_LAYER_ID = "real-transport-network";
const WATER_BODY_LAYER_ID = "real-water-bodies-fill";
const WATER_BODY_OUTLINE_LAYER_ID = "real-water-bodies-outline";
const TRAFFIC_SOURCE_ID = "configured-traffic-source";
const TRAFFIC_LAYER_ID = "configured-traffic-layer";
const ELEVATION_SAFETY_SOURCE_ID = "elevation-safety-source";
const ELEVATION_SAFETY_LAYER_IDS = [
    "elevation-safety-danger-fill",
    "elevation-safety-neutral-fill",
    "elevation-safety-safe-fill",
    "elevation-safety-outline",
] as const;

const INDIA_BASELINE_SOURCE_ID = "india-baseline-source";
const INDIA_BASELINE_LAYER_IDS = [
    "india-baseline-safer-fill",
    "india-baseline-neutral-fill",
    "india-baseline-susceptible-fill",
    "india-baseline-outline",
] as const;

const INDIA_HOTSPOTS_SOURCE_ID = "india-hotspots-source";
const INDIA_HOTSPOTS_LAYER_IDS = [
    "india-hotspots-low-fill",
    "india-hotspots-mod-fill",
    "india-hotspots-high-fill",
    "india-hotspots-outline",
] as const;
const EMPTY_FEATURE_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };
const ELEVATION_CLASSIFICATIONS = new Set(["safe", "neutral", "danger"]);
const ELEVATION_SAFETY_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const DEFAULT_DEM_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const DEM_TILE_URL =
    process.env.NEXT_PUBLIC_DEM_TILE_URL === "disabled"
        ? null
        : process.env.NEXT_PUBLIC_DEM_TILE_URL || DEFAULT_DEM_TILE_URL;
const TERRAIN_EXAGGERATION = Math.min(
    2,
    Math.max(0.5, Number.parseFloat(process.env.NEXT_PUBLIC_TERRAIN_EXAGGERATION || "1.25") || 1.25),
);

const CAMERA_PRESETS: Record<CameraMode, { pitch: number; bearing: number }> = {
    standard: { pitch: 0, bearing: 0 },
    terrain: { pitch: 35, bearing: -12 },
    intelligence: { pitch: 50, bearing: -18 },
};

function isElevationSafetyFeatureCollection(value: unknown): value is FeatureCollection {
    if (!value || typeof value !== "object") return false;
    const collection = value as { type?: unknown; features?: unknown };
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) return false;

    return collection.features.every(feature => {
        if (!feature || typeof feature !== "object") return false;
        const candidate = feature as {
            type?: unknown;
            geometry?: { type?: unknown; coordinates?: unknown } | null;
            properties?: { classification?: unknown } | null;
        };
        return (
            candidate.type === "Feature" &&
            (candidate.geometry?.type === "Polygon" || candidate.geometry?.type === "MultiPolygon") &&
            candidate.geometry.coordinates !== undefined &&
            ELEVATION_CLASSIFICATIONS.has(String(candidate.properties?.classification))
        );
    });
}

// Configure local standalone Web Worker for MapLibre GL in Next.js / Turbopack
if (typeof window !== "undefined") {
    if (typeof (maplibregl as any).setWorkerUrl === "function") {
        (maplibregl as any).setWorkerUrl("/maplibre-gl-worker.mjs");
    } else if ((maplibregl as any).config) {
        (maplibregl as any).config.WORKER_URL = "/maplibre-gl-worker.mjs";
    }
}

export interface MapLibreMapProps {
    tideLevel?: number;
    rainfall?: number;
    heightClassName?: string;
    onZoneSelect?: (zone: any) => void;
    interactive?: boolean;
}

export function MapLibreMap({
    tideLevel = 2.4,
    rainfall = 65,
    heightClassName = "h-[650px]",
    onZoneSelect,
    interactive = true,
}: MapLibreMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const rootContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);

    const [currentStyleId, setCurrentStyleId] = useState<BaseMapStyleId>("satellite");
    const [activeRegionId, setActiveRegionId] = useState<string>("mangalore");
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapStyleVersion, setMapStyleVersion] = useState(0);
    const [cameraMode, setActiveCameraMode] = useState<CameraMode>("intelligence");
    const [cameraPitch, setCameraPitch] = useState(CAMERA_PRESETS.intelligence.pitch);
    const [terrainAvailable, setTerrainAvailable] = useState(Boolean(DEM_TILE_URL));
    const [visibleOverlays, setVisibleOverlays] = useState({
        hotspots: false,
        layers: false,
        sectors: false,
        legend: false,
    });
    const [allOverlaysEnabled, setAllOverlaysEnabled] = useState(false);
    const [consoleCollapsed, setConsoleCollapsed] = useState(false);

    // Layer toggles state
    const [layers, setLayers] = useState<MapLayerState>({
        dangerZones: false,
        floodCoverage: false,
        lowLyingAreas: false,
        waterBodies: true,
        transport: true,
        traffic: false,
        facilities: true,
        evacuationRoutes: true,
        floodInundation: false,
        elevationSafety: true,
        indiaBaseline: false,
        indiaHotspots: false,
        layerOpacity: 0.85,
    });

    const ensureTerrainSupport = useCallback((map: maplibregl.Map, enabled: boolean) => {
        if (!DEM_TILE_URL) return false;

        try {
            if (!map.getSource(DEM_SOURCE_ID)) {
                map.addSource(DEM_SOURCE_ID, {
                    type: "raster-dem",
                    tiles: [DEM_TILE_URL],
                    tileSize: 256,
                    maxzoom: 15,
                    encoding: "terrarium",
                    attribution: "AWS Terrain Tiles, Mapzen, SRTM",
                });
            }

            if (!map.getSource(HILLSHADE_SOURCE_ID)) {
                map.addSource(HILLSHADE_SOURCE_ID, {
                    type: "raster-dem",
                    tiles: [DEM_TILE_URL],
                    tileSize: 256,
                    maxzoom: 15,
                    encoding: "terrarium",
                    attribution: "AWS Terrain Tiles, Mapzen, SRTM",
                });
            }

            if (!map.getLayer(HILLSHADE_LAYER_ID)) {
                map.addLayer({
                    id: HILLSHADE_LAYER_ID,
                    type: "hillshade",
                    source: HILLSHADE_SOURCE_ID,
                    layout: { visibility: enabled ? "visible" : "none" },
                    paint: {
                        "hillshade-exaggeration": 0.22,
                        "hillshade-illumination-direction": 315,
                        "hillshade-shadow-color": "#090d16",
                        "hillshade-highlight-color": "#d4d4d8",
                        "hillshade-accent-color": "#52525b",
                    },
                });
            } else {
                map.setLayoutProperty(HILLSHADE_LAYER_ID, "visibility", enabled ? "visible" : "none");
            }

            map.setTerrain(enabled ? { source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION } : null);
            return true;
        } catch (error) {
            console.error("FloodSight terrain is unavailable; using 2D map fallback.", error);
            map.setTerrain(null);
            if (map.getLayer(HILLSHADE_LAYER_ID)) {
                map.setLayoutProperty(HILLSHADE_LAYER_ID, "visibility", "none");
            }
            setTerrainAvailable(false);
            return false;
        }
    }, []);

    const getStyleObject = (id: BaseMapStyleId) => {
        const found = BASE_MAP_STYLES.find(s => s.id === id);
        return found ? found.styleObject : BASE_MAP_STYLES[0].styleObject;
    };

    const updateLayerVisibilities = (map: maplibregl.Map, lState: MapLayerState) => {
        if (!map) return;

        const setVis = (layerId: string, visible: boolean) => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
            }
        };

        setVis("flood-coverage-layer-fill", lState.floodCoverage);
        setVis("flood-coverage-layer-stroke", lState.floodCoverage);
        setVis("danger-zones-layer-fill", lState.dangerZones);
        setVis("danger-zones-layer-stroke", lState.dangerZones);
        setVis("danger-zones-centroids-halo", lState.dangerZones);
        setVis("danger-zones-centroids-circle", lState.dangerZones);
        setVis("low-lying-layer-fill", lState.lowLyingAreas);
        setVis("water-bodies-layer-line", lState.waterBodies);
        setVis(WATER_BODY_LAYER_ID, lState.waterBodies);
        setVis(WATER_BODY_OUTLINE_LAYER_ID, lState.waterBodies);
        setVis(TRANSPORT_LAYER_ID, lState.transport);
        setVis(TRAFFIC_LAYER_ID, lState.traffic && Boolean(TRAFFIC_TILE_URL));
        setVis("evacuation-routes-layer-casing", lState.evacuationRoutes);
        setVis("evacuation-routes-layer-line", lState.evacuationRoutes);
        setVis("critical-facilities-layer-circle", lState.facilities);
        setVis("flood-inundation-layer-fill", lState.floodInundation);
        setVis("flood-inundation-layer-stroke", lState.floodInundation);
        ELEVATION_SAFETY_LAYER_IDS.forEach(layerId => setVis(layerId, lState.elevationSafety));
        setVis("india-terrain-tile-layer", lState.indiaBaseline);
        INDIA_BASELINE_LAYER_IDS.forEach(layerId => setVis(layerId, lState.indiaBaseline));
        INDIA_HOTSPOTS_LAYER_IDS.forEach(layerId => setVis(layerId, lState.indiaHotspots));
    };

    const addAllLayers = useCallback(
        (map: maplibregl.Map) => {
            if (!map) return;

            ensureTerrainSupport(map, cameraMode !== "standard");

            if (!map.getSource(REAL_MAP_SOURCE_ID)) {
                map.addSource(REAL_MAP_SOURCE_ID, {
                    type: "vector",
                    tiles: [...REAL_MAP_TILE_SOURCE.tiles],
                    minzoom: 0,
                    maxzoom: 14,
                    attribution: REAL_MAP_TILE_SOURCE.attribution,
                });
            }
            if (!map.getLayer(TRANSPORT_LAYER_ID)) {
                map.addLayer({
                    id: TRANSPORT_LAYER_ID,
                    type: "line",
                    source: REAL_MAP_SOURCE_ID,
                    "source-layer": REAL_MAP_TILE_SOURCE.sourceLayers.transport,
                    minzoom: 8,
                    paint: {
                        "line-color": [
                            "match",
                            ["get", "class"],
                            "motorway",
                            "#f59e0b",
                            "trunk",
                            "#fbbf24",
                            "primary",
                            "#fde68a",
                            "#a1a1aa",
                        ],
                        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 12, 2.2, 16, 5],
                        "line-opacity": 0.9,
                    },
                });
            }
            if (!map.getLayer(WATER_BODY_LAYER_ID)) {
                map.addLayer({
                    id: WATER_BODY_LAYER_ID,
                    type: "fill",
                    source: REAL_MAP_SOURCE_ID,
                    "source-layer": REAL_MAP_TILE_SOURCE.sourceLayers.water,
                    paint: {
                        "fill-color": "#0e7490",
                        "fill-opacity": 0.22,
                    },
                });
            }
            if (!map.getLayer(WATER_BODY_OUTLINE_LAYER_ID)) {
                map.addLayer({
                    id: WATER_BODY_OUTLINE_LAYER_ID,
                    type: "line",
                    source: REAL_MAP_SOURCE_ID,
                    "source-layer": REAL_MAP_TILE_SOURCE.sourceLayers.water,
                    paint: {
                        "line-color": "#22d3ee",
                        "line-width": 0.8,
                        "line-opacity": 0.55,
                    },
                });
            }
            if (TRAFFIC_TILE_URL && !map.getSource(TRAFFIC_SOURCE_ID)) {
                map.addSource(TRAFFIC_SOURCE_ID, {
                    type: "vector",
                    tiles: [TRAFFIC_TILE_URL],
                    minzoom: 0,
                    maxzoom: 18,
                    attribution: TRAFFIC_ATTRIBUTION,
                });
            }
            if (TRAFFIC_TILE_URL && !map.getLayer(TRAFFIC_LAYER_ID)) {
                map.addLayer({
                    id: TRAFFIC_LAYER_ID,
                    type: "line",
                    source: TRAFFIC_SOURCE_ID,
                    "source-layer": TRAFFIC_SOURCE_LAYER,
                    minzoom: 8,
                    paint: {
                        "line-color": [
                            "match",
                            ["get", "congestion"],
                            "severe",
                            "#dc2626",
                            "heavy",
                            "#f97316",
                            "moderate",
                            "#facc15",
                            "#22c55e",
                        ],
                        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 14, 4],
                        "line-opacity": 0.88,
                    },
                });
            }

            // 0. Google Flood Hub Extended Regional Floodplain Coverage Network
            if (!map.getSource("flood-coverage-source")) {
                map.addSource("flood-coverage-source", {
                    type: "geojson",
                    data: GOOGLE_FLOOD_HUB_COVERAGE_GEOJSON,
                });
            }
            if (!map.getLayer("flood-coverage-layer-fill")) {
                map.addLayer({
                    id: "flood-coverage-layer-fill",
                    type: "fill",
                    source: "flood-coverage-source",
                    paint: {
                        "fill-color": ["coalesce", ["get", "color"], "#a855f7"],
                        "fill-opacity": ["coalesce", ["get", "opacity"], 0.38],
                    },
                });
            }
            if (!map.getLayer("flood-coverage-layer-stroke")) {
                map.addLayer({
                    id: "flood-coverage-layer-stroke",
                    type: "line",
                    source: "flood-coverage-source",
                    paint: {
                        "line-color": "#7e22ce",
                        "line-width": 1.5,
                        "line-opacity": 0.8,
                    },
                });
            }

            // 1. Low-lying Areas (Contour depression)
            if (!map.getSource("low-lying-source")) {
                map.addSource("low-lying-source", {
                    type: "geojson",
                    data: LOW_LYING_AREAS_GEOJSON,
                });
            }
            if (!map.getLayer("low-lying-layer-fill")) {
                map.addLayer({
                    id: "low-lying-layer-fill",
                    type: "fill",
                    source: "low-lying-source",
                    paint: {
                        "fill-color": ["coalesce", ["get", "color"], "#0284c7"],
                        "fill-opacity": ["coalesce", ["get", "opacity"], 0.4],
                    },
                });
            }

            if (!map.getSource(ELEVATION_SAFETY_SOURCE_ID)) {
                map.addSource(ELEVATION_SAFETY_SOURCE_ID, {
                    type: "geojson",
                    data: EMPTY_FEATURE_COLLECTION,
                });
            }
            for (const [classification, color] of [
                ["danger", "#ef4444"],
                ["neutral", "#f97316"],
                ["safe", "#22c55e"],
            ] as const) {
                const layerId = `elevation-safety-${classification}-fill`;
                if (!map.getLayer(layerId)) {
                    map.addLayer({
                        id: layerId,
                        type: "fill",
                        source: ELEVATION_SAFETY_SOURCE_ID,
                        filter: ["==", ["get", "classification"], classification],
                        paint: {
                            "fill-color": color,
                            "fill-opacity": classification === "safe" ? 0.45 : classification === "danger" ? 0.5 : 0.42,
                        },
                    });
                }
            }
            if (!map.getLayer("elevation-safety-outline")) {
                map.addLayer({
                    id: "elevation-safety-outline",
                    type: "line",
                    source: ELEVATION_SAFETY_SOURCE_ID,
                    paint: {
                        "line-color": [
                            "match",
                            ["get", "classification"],
                            "safe",
                            "#22c55e",
                            "neutral",
                            "#f97316",
                            "#ef4444",
                        ],
                        "line-width": 1.5,
                        "line-opacity": 0.85,
                    },
                });
            }

            // India Terrain Safety Baseline (HydroSHEDS 15s)
            if (!map.getSource(INDIA_BASELINE_SOURCE_ID)) {
                map.addSource(INDIA_BASELINE_SOURCE_ID, {
                    type: "geojson",
                    data: EMPTY_FEATURE_COLLECTION,
                });
            }
            for (const [classification, color] of [
                ["safer", "#10b981"],
                ["neutral", "#eab308"],
                ["susceptible", "#ef4444"],
            ] as const) {
                const layerId = `india-baseline-${classification}-fill`;
                if (!map.getLayer(layerId)) {
                    map.addLayer({
                        id: layerId,
                        type: "fill",
                        source: INDIA_BASELINE_SOURCE_ID,
                        filter: ["==", ["get", "classification"], classification],
                        paint: {
                            "fill-color": color,
                            "fill-opacity": 0.35,
                        },
                    });
                }
            }
            if (!map.getLayer("india-baseline-outline")) {
                map.addLayer({
                    id: "india-baseline-outline",
                    type: "line",
                    source: INDIA_BASELINE_SOURCE_ID,
                    paint: {
                        "line-color": [
                            "match",
                            ["get", "classification"],
                            "safer",
                            "#34d399",
                            "neutral",
                            "#facc15",
                            "#f87171",
                        ],
                        "line-width": 1.0,
                        "line-opacity": 0.7,
                    },
                });
            }

            // India Flood Hotspots (IMERG Satellite Forcing)
            if (!map.getSource(INDIA_HOTSPOTS_SOURCE_ID)) {
                map.addSource(INDIA_HOTSPOTS_SOURCE_ID, {
                    type: "geojson",
                    data: EMPTY_FEATURE_COLLECTION,
                });
            }
            for (const [riskLevel, color] of [
                ["LOW", "#3b82f6"],
                ["MODERATE", "#f97316"],
                ["HIGH", "#ef4444"],
            ] as const) {
                const layerId = `india-hotspots-${riskLevel.toLowerCase()}-fill`;
                if (!map.getLayer(layerId)) {
                    map.addLayer({
                        id: layerId,
                        type: "fill",
                        source: INDIA_HOTSPOTS_SOURCE_ID,
                        filter: ["==", ["get", "risk_level"], riskLevel],
                        paint: {
                            "fill-color": color,
                            "fill-opacity": riskLevel === "HIGH" ? 0.6 : riskLevel === "MODERATE" ? 0.45 : 0.3,
                        },
                    });
                }
            }
            if (!map.getLayer("india-hotspots-outline")) {
                map.addLayer({
                    id: "india-hotspots-outline",
                    type: "line",
                    source: INDIA_HOTSPOTS_SOURCE_ID,
                    paint: {
                        "line-color": [
                            "match",
                            ["get", "risk_level"],
                            "LOW",
                            "#60a5fa",
                            "MODERATE",
                            "#fb923c",
                            "#f87171",
                        ],
                        "line-width": 1.2,
                        "line-opacity": 0.85,
                    },
                });
            }

            // India High-Resolution Web Mercator Terrain Susceptibility Tile Layer
            if (!map.getSource("india-terrain-tile-source")) {
                map.addSource("india-terrain-tile-source", {
                    type: "raster",
                    tiles: [`${ELEVATION_SAFETY_API_URL}/terrain/tiles/{z}/{x}/{y}.png`],
                    tileSize: 256,
                    minzoom: 0,
                    maxzoom: 18,
                    attribution: "HydroSHEDS 15s Hydro-Conditioned DEM / Terrarium AWS",
                });
            }
            if (!map.getLayer("india-terrain-tile-layer")) {
                map.addLayer({
                    id: "india-terrain-tile-layer",
                    type: "raster",
                    source: "india-terrain-tile-source",
                    layout: { visibility: layers.indiaBaseline ? "visible" : "none" },
                    paint: {
                        "raster-opacity": layers.layerOpacity,
                        "raster-fade-duration": 200,
                    },
                });
            }
            // 2. Dynamic Flood Inundation Simulation Layer
            if (!map.getSource("flood-inundation-source")) {
                map.addSource("flood-inundation-source", {
                    type: "geojson",
                    data: generateFloodInundationGeoJSON(tideLevel, rainfall),
                });
            }
            if (!map.getLayer("flood-inundation-layer-fill")) {
                map.addLayer({
                    id: "flood-inundation-layer-fill",
                    type: "fill",
                    source: "flood-inundation-source",
                    paint: {
                        "fill-color": "#38bdf8",
                        "fill-opacity": 0.35,
                    },
                });
            }
            if (!map.getLayer("flood-inundation-layer-stroke")) {
                map.addLayer({
                    id: "flood-inundation-layer-stroke",
                    type: "line",
                    source: "flood-inundation-source",
                    paint: {
                        "line-color": "#0284c7",
                        "line-width": 2,
                        "line-dasharray": [2, 2],
                    },
                });
            }

            // 3. Real DEM Elevation Danger Zones (Polygons - Google Flood Hub Style)
            if (!map.getSource("danger-zones-source")) {
                map.addSource("danger-zones-source", {
                    type: "geojson",
                    data: calculateDynamicZoneTilesGeoJSON(tideLevel, rainfall),
                });
            }
            if (!map.getLayer("danger-zones-layer-fill")) {
                map.addLayer({
                    id: "danger-zones-layer-fill",
                    type: "fill",
                    source: "danger-zones-source",
                    paint: {
                        "fill-color": ["coalesce", ["get", "riskColor"], "#dc2626"],
                        "fill-opacity": ["coalesce", ["get", "fillOpacity"], 0.7],
                    },
                });
            }
            if (!map.getLayer("danger-zones-layer-stroke")) {
                map.addLayer({
                    id: "danger-zones-layer-stroke",
                    type: "line",
                    source: "danger-zones-source",
                    paint: {
                        "line-color": ["coalesce", ["get", "strokeColor"], "#991b1b"],
                        "line-width": ["coalesce", ["get", "strokeWidth"], 3.5],
                        "line-opacity": 0.95,
                    },
                });
            }

            // 4. Danger Zone Centroid Beacons / Badges
            if (!map.getSource("danger-zones-centroids-source")) {
                map.addSource("danger-zones-centroids-source", {
                    type: "geojson",
                    data: calculateDynamicZoneCentroidsGeoJSON(tideLevel, rainfall),
                });
            }
            if (!map.getLayer("danger-zones-centroids-halo")) {
                map.addLayer({
                    id: "danger-zones-centroids-halo",
                    type: "circle",
                    source: "danger-zones-centroids-source",
                    paint: {
                        "circle-radius": 16,
                        "circle-color": ["coalesce", ["get", "riskColor"], "#dc2626"],
                        "circle-opacity": 0.45,
                    },
                });
            }
            if (!map.getLayer("danger-zones-centroids-circle")) {
                map.addLayer({
                    id: "danger-zones-centroids-circle",
                    type: "circle",
                    source: "danger-zones-centroids-source",
                    paint: {
                        "circle-radius": 8,
                        "circle-color": ["coalesce", ["get", "riskColor"], "#dc2626"],
                        "circle-stroke-width": 2.5,
                        "circle-stroke-color": "#ffffff",
                    },
                });
            }

            // 5. Water Bodies & Ingress Channels
            if (!map.getSource("water-bodies-source")) {
                map.addSource("water-bodies-source", {
                    type: "geojson",
                    data: WATER_BODIES_GEOJSON,
                });
            }
            if (!map.getLayer("water-bodies-layer-line")) {
                map.addLayer({
                    id: "water-bodies-layer-line",
                    type: "line",
                    source: "water-bodies-source",
                    paint: {
                        "line-color": "#06b6d4",
                        "line-width": 4.5,
                        "line-opacity": 0.9,
                    },
                });
            }

            // 6. Evacuation Routes
            if (!map.getSource("evacuation-routes-source")) {
                map.addSource("evacuation-routes-source", {
                    type: "geojson",
                    data: EVACUATION_ROUTES_GEOJSON,
                });
            }
            if (!map.getLayer("evacuation-routes-layer-casing")) {
                map.addLayer({
                    id: "evacuation-routes-layer-casing",
                    type: "line",
                    source: "evacuation-routes-source",
                    paint: {
                        "line-color": "#090d16",
                        "line-width": 6.5,
                        "line-opacity": 0.85,
                    },
                });
            }
            if (!map.getLayer("evacuation-routes-layer-line")) {
                map.addLayer({
                    id: "evacuation-routes-layer-line",
                    type: "line",
                    source: "evacuation-routes-source",
                    paint: {
                        "line-color": ["coalesce", ["get", "routeColor"], "#10b981"],
                        "line-width": 3.5,
                        "line-opacity": 1.0,
                    },
                });
            }

            // 7. Critical Facilities
            if (!map.getSource("critical-facilities-source")) {
                map.addSource("critical-facilities-source", {
                    type: "geojson",
                    data: CRITICAL_FACILITIES_GEOJSON,
                });
            }
            if (!map.getLayer("critical-facilities-layer-circle")) {
                map.addLayer({
                    id: "critical-facilities-layer-circle",
                    type: "circle",
                    source: "critical-facilities-source",
                    paint: {
                        "circle-radius": 8,
                        "circle-color": "#090d16",
                        "circle-stroke-color": "#38bdf8",
                        "circle-stroke-width": 3,
                    },
                });
            }

            updateLayerVisibilities(map, layers);
        },
        [cameraMode, ensureTerrainSupport, layers, rainfall, tideLevel],
    );

    const openZonePopup = (props: any, lngLat: maplibregl.LngLatLike, map: maplibregl.Map) => {
        if (popupRef.current) popupRef.current.remove();

        const riskColor =
            props.riskColor ||
            (props.baseRiskLevel === "CRITICAL"
                ? "#dc2626"
                : props.baseRiskLevel === "HIGH"
                  ? "#ea580c"
                  : props.baseRiskLevel === "MEDIUM"
                    ? "#eab308"
                    : "#10b981");
        const riskLevel = props.riskLevel || props.baseRiskLevel || "MONITORED";

        const popupHtml = `
      <div class="p-3.5 space-y-2 text-zinc-100 min-w-[280px] font-mono">
        <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
          <span class="font-bold text-xs text-sky-400">${props.id}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style="background: ${riskColor}26; color: ${riskColor}; border: 1px solid ${riskColor}60">
            ${riskLevel}
          </span>
        </div>
        <div class="font-sans font-bold text-xs leading-snug text-white">${props.name}</div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] pt-1 text-zinc-300 border-t border-zinc-850">
          <div>DEM Altitude: <b class="text-white">${props.elevationMeters}m MSL</b></div>
          <div>Coast Distance: <b class="text-sky-300">${props.distanceToSeaKm} km</b></div>
          <div>Inundation: <b class="text-amber-400">${props.inundationDepth || "0.0m"}</b></div>
          <div>Threat Index: <b class="text-rose-400">${props.threatScore || 75}/100</b></div>
          <div>Population: <b class="text-white">${Number(props.population).toLocaleString()}</b></div>
          <div>Critical Hubs: <b class="text-white">${props.criticalFacilitiesCount || 2}</b></div>
        </div>
        <div class="text-[10px] text-zinc-400 border-t border-zinc-850 pt-1.5 font-sans">
          Shelter Hub: <span class="text-emerald-300 font-semibold">${props.evacuationHub || "Designated Highland Hub"}</span>
        </div>
        <div class="text-[10px] text-zinc-400 font-sans">
          Directive: <span class="text-sky-300 font-medium">${props.actionProtocol || "Monitor Inundation"}</span>
        </div>
      </div>
    `;

        popupRef.current = new maplibregl.Popup({ offset: 12 }).setLngLat(lngLat).setHTML(popupHtml).addTo(map);

        if (onZoneSelect) onZoneSelect(props);
    };

    const openElevationSafetyPopup = (
        props: Record<string, unknown>,
        lngLat: maplibregl.LngLatLike,
        map: maplibregl.Map,
    ) => {
        if (popupRef.current) popupRef.current.remove();
        const classification = String(props.classification || "neutral").toUpperCase();
        const color = String(props.color || "#f97316");
        const popupHtml = `
            <div class="p-3.5 space-y-2 text-zinc-100 min-w-[250px] font-mono">
                <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                    <span class="font-bold text-xs text-sky-400">ELEVATION SAFETY</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="color:${color};border:1px solid ${color}99">${classification}</span>
                </div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-zinc-300">
                    <div>Relative elevation: <b class="text-white">${props.relative_percentile ?? props.relative_elevation_percentile}th percentile</b></div>
                    <div>Mean elevation: <b class="text-white">${props.elevation_mean_m}m</b></div>
                    <div>Range: <b class="text-white">${props.elevation_min_m} - ${props.elevation_max_m}m</b></div>
                    <div>Area: <b class="text-white">${props.area_km2} km²</b></div>
                </div>
                <div class="border-t border-zinc-800 pt-1.5 text-[10px] leading-relaxed text-zinc-400 font-sans">
                    Relative to selected region. Elevation-only terrain assessment; water level and flood conditions are not included.
                </div>
            </div>`;
        popupRef.current = new maplibregl.Popup({ offset: 12 }).setLngLat(lngLat).setHTML(popupHtml).addTo(map);
    };

    const openIndiaBaselinePopup = (
        props: Record<string, unknown>,
        lngLat: maplibregl.LngLatLike,
        map: maplibregl.Map,
    ) => {
        if (popupRef.current) popupRef.current.remove();
        const classification = String(props.classification || "neutral").toUpperCase();
        const color = String(props.color || "#eab308");
        const terrainScore = typeof props.terrain_score === "number" ? props.terrain_score.toFixed(2) : "N/A";
        const flowAccRank = typeof props.flow_accumulation_rank === "number" ? props.flow_accumulation_rank.toFixed(2) : "N/A";
        const elevation = typeof props.elevation_m === "number" ? `${props.elevation_m}m` : "N/A";

        const popupHtml = `
            <div class="p-3.5 space-y-2 text-zinc-100 min-w-[260px] font-mono">
                <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                    <span class="font-bold text-xs text-emerald-400">HYDROSHEDS BASELINE</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="color:${color};border:1px solid ${color}99">${classification}</span>
                </div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-zinc-300">
                    <div>Terrain Score: <b class="text-white">${terrainScore}</b></div>
                    <div>Flow Accum: <b class="text-white">${flowAccRank}</b></div>
                    <div>Elevation MSL: <b class="text-white">${elevation}</b></div>
                    <div>Region: <b class="text-white">${props.region || "India"}</b></div>
                </div>
                <div class="border-t border-zinc-800 pt-1.5 text-[10px] leading-relaxed text-zinc-400 font-sans">
                    HydroSHEDS 15s multi-criteria GIS flood susceptibility baseline map.
                </div>
            </div>`;
        popupRef.current = new maplibregl.Popup({ offset: 12 }).setLngLat(lngLat).setHTML(popupHtml).addTo(map);
    };

    const openIndiaHotspotsPopup = (
        props: Record<string, unknown>,
        lngLat: maplibregl.LngLatLike,
        map: maplibregl.Map,
    ) => {
        if (popupRef.current) popupRef.current.remove();
        const riskLevel = String(props.risk_level || "MODERATE").toUpperCase();
        const color = String(props.color || "#f97316");
        const hotspotScore = typeof props.hotspot_score === "number" ? props.hotspot_score.toFixed(2) : "N/A";
        const terrainScore = typeof props.terrain_score === "number" ? props.terrain_score.toFixed(2) : "N/A";
        const rainfall = typeof props.rainfall_mm_month === "number" ? `${props.rainfall_mm_month} mm/mo` : "N/A";

        const popupHtml = `
            <div class="p-3.5 space-y-2 text-zinc-100 min-w-[260px] font-mono">
                <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                    <span class="font-bold text-xs text-amber-400">IMERG FLOOD HOTSPOT</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="color:${color};border:1px solid ${color}99">${riskLevel} HAZARD</span>
                </div>
                <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-zinc-300">
                    <div>Hotspot Score: <b class="text-white">${hotspotScore}</b></div>
                    <div>Precipitation: <b class="text-white">${rainfall}</b></div>
                    <div>Terrain Score: <b class="text-white">${terrainScore}</b></div>
                    <div>Hydro Baseline: <b class="text-white">Active</b></div>
                </div>
                <div class="border-t border-zinc-800 pt-1.5 text-[10px] leading-relaxed text-zinc-400 font-sans">
                    HydroSHEDS terrain susceptibility baseline coupled with NASA GPM IMERG satellite rainfall forcing.
                </div>
            </div>`;
        popupRef.current = new maplibregl.Popup({ offset: 12 }).setLngLat(lngLat).setHTML(popupHtml).addTo(map);
    };

    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (typeof (maplibregl as any).setWorkerUrl === "function") {
            (maplibregl as any).setWorkerUrl("/maplibre-gl-worker.mjs");
        }

        const defaultRegion = REGION_PRESETS[0];

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: getStyleObject(currentStyleId),
            center: [defaultRegion.longitude, defaultRegion.latitude],
            zoom: defaultRegion.zoom,
            pitch: DEM_TILE_URL ? defaultRegion.pitch : 0,
            bearing: DEM_TILE_URL ? defaultRegion.bearing : 0,
            maxPitch: 85,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
        map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
        map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

        const fsBtn = mapContainerRef.current?.querySelector(".maplibregl-ctrl-fullscreen");
        const handleFsClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else if (rootContainerRef.current) {
                rootContainerRef.current.requestFullscreen().catch(() => {});
            }
        };

        if (fsBtn) {
            fsBtn.addEventListener("click", handleFsClick, true);
        }
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
        map.touchPitch.enable();
        map.on("pitchend", () => setCameraPitch(map.getPitch()));

        const onMapReady = () => {
            mapRef.current = map;
            addAllLayers(map);
            setCameraPitch(map.getPitch());
            setMapStyleVersion(version => version + 1);
            setMapLoaded(true);
        };

        map.on("error", event => {
            const sourceId = (event as { sourceId?: string }).sourceId;
            const message = event.error?.message || "";
            if (sourceId === DEM_SOURCE_ID || message.toLowerCase().includes("raster-dem")) {
                console.error("FloodSight DEM tiles failed; reverting to the 2D map.", event.error);
                map.setTerrain(null);
                if (map.getLayer(HILLSHADE_LAYER_ID)) {
                    map.setLayoutProperty(HILLSHADE_LAYER_ID, "visibility", "none");
                }
                setTerrainAvailable(false);
                setActiveCameraMode("standard");
            }
        });

        if (map.isStyleLoaded()) {
            onMapReady();
        } else {
            map.once("style.load", onMapReady);
        }

        map.once("load", () => {
            onMapReady();
        });

        // Click handler for Danger Zones Polygon
        map.on("click", "danger-zones-layer-fill", e => {
            if (!e.features || !e.features[0]) return;
            openZonePopup(e.features[0].properties, e.lngLat, map);
        });

        // Click handler for Danger Zones Centroid Badge
        map.on("click", "danger-zones-centroids-circle", e => {
            if (!e.features || !e.features[0]) return;
            const coords = (e.features[0].geometry as any).coordinates.slice();
            openZonePopup(e.features[0].properties, coords, map);
        });

        map.on("click", "elevation-safety-outline", e => {
            if (!e.features || !e.features[0]) return;
            openElevationSafetyPopup(e.features[0].properties || {}, e.lngLat, map);
        });

        map.on("click", "india-baseline-outline", e => {
            if (!e.features || !e.features[0]) return;
            openIndiaBaselinePopup(e.features[0].properties || {}, e.lngLat, map);
        });

        map.on("click", "india-hotspots-outline", e => {
            if (!e.features || !e.features[0]) return;
            openIndiaHotspotsPopup(e.features[0].properties || {}, e.lngLat, map);
        });

        // Click handler for Critical Facilities
        map.on("click", "critical-facilities-layer-circle", e => {
            if (!e.features || !e.features[0]) return;
            const feature = e.features[0];
            const props = feature.properties as any;

            if (popupRef.current) popupRef.current.remove();

            const popupHtml = `
        <div class="p-3 space-y-1.5 text-zinc-100 min-w-[220px] font-mono">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-1">
            <span class="font-bold text-xs text-sky-400">${props.typeLabel || "Facility"}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              ${props.status}
            </span>
          </div>
          <div class="font-sans font-semibold text-xs text-white">${props.name}</div>
          <div class="text-[11px] text-zinc-400 font-sans">${props.address}</div>
          <div class="grid grid-cols-2 gap-1 text-[10px] text-zinc-300 pt-1">
            <div>Elevation: <b class="text-white">${props.elevationMeters}m MSL</b></div>
            <div>Capacity: <b class="text-white">${props.capacity} Pax</b></div>
          </div>
        </div>
      `;

            const coords = (feature.geometry as any).coordinates.slice();
            popupRef.current = new maplibregl.Popup({ offset: 12 }).setLngLat(coords).setHTML(popupHtml).addTo(map);
        });

        // Click handler for Evacuation Routes
        map.on("click", "evacuation-routes-layer-line", e => {
            if (!e.features || !e.features[0]) return;
            const props = e.features[0].properties as any;

            if (popupRef.current) popupRef.current.remove();

            const popupHtml = `
        <div class="p-3 space-y-1.5 text-zinc-100 min-w-[230px] font-mono">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-1">
            <span class="font-bold text-xs text-emerald-400">Evacuation Corridor</span>
            <span class="text-[9px] text-zinc-400">${props.id}</span>
          </div>
          <div class="font-sans font-semibold text-xs text-white">${props.name}</div>
          <div class="text-[10px] text-zinc-300">Status: <b class="text-emerald-300">${props.status}</b></div>
          <div class="text-[10px] text-zinc-400">Transit Duration: <b class="text-white">${props.travelTimeMinutes} mins</b></div>
        </div>
      `;

            popupRef.current = new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(popupHtml).addTo(map);
        });

        const setPointer = () => {
            if (mapRef.current) mapRef.current.getCanvas().style.cursor = "pointer";
        };
        const resetPointer = () => {
            if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
        };

        map.on("mouseenter", "danger-zones-layer-fill", setPointer);
        map.on("mouseleave", "danger-zones-layer-fill", resetPointer);
        map.on("mouseenter", "danger-zones-centroids-circle", setPointer);
        map.on("mouseleave", "danger-zones-centroids-circle", resetPointer);
        map.on("mouseenter", "elevation-safety-outline", setPointer);
        map.on("mousemove", "elevation-safety-outline", () => {
            for (const layerId of [
                "elevation-safety-danger-fill",
                "elevation-safety-neutral-fill",
                "elevation-safety-safe-fill",
            ]) {
                if (map.getLayer(layerId)) map.setPaintProperty(layerId, "fill-opacity", 0.38);
            }
        });
        map.on("mouseleave", "elevation-safety-outline", () => {
            resetPointer();
            for (const layerId of [
                "elevation-safety-danger-fill",
                "elevation-safety-neutral-fill",
                "elevation-safety-safe-fill",
            ]) {
                if (map.getLayer(layerId)) map.setPaintProperty(layerId, "fill-opacity", 0.28);
            }
        });
        map.on("mouseenter", "critical-facilities-layer-circle", setPointer);
        map.on("mouseleave", "critical-facilities-layer-circle", resetPointer);
        map.on("mouseenter", "evacuation-routes-layer-line", setPointer);
        map.on("mouseleave", "evacuation-routes-layer-line", resetPointer);
        map.on("mouseenter", "india-baseline-outline", setPointer);
        map.on("mouseleave", "india-baseline-outline", resetPointer);
        map.on("mouseenter", "india-hotspots-outline", setPointer);
        map.on("mouseleave", "india-hotspots-outline", resetPointer);

        return () => {
            if (fsBtn) {
                fsBtn.removeEventListener("click", handleFsClick, true);
            }
            map.remove();
            mapRef.current = null;
        };
    }, []);

    const handleStyleChange = (styleId: BaseMapStyleId) => {
        setCurrentStyleId(styleId);
        if (!mapRef.current) return;

        const map = mapRef.current;
        map.setStyle(getStyleObject(styleId));

        map.once("style.load", () => {
            addAllLayers(map);
            setMapStyleVersion(version => version + 1);
        });
    };

    // Live dynamic recalculation of Water Inundation and Real DEM Risk Zone Tiles + Centroids
    useEffect(() => {
        if (!mapRef.current || !mapLoaded) return;
        const map = mapRef.current;

        // 1. Update Water Inundation Polygon
        const simSource = map.getSource("flood-inundation-source") as maplibregl.GeoJSONSource;
        if (simSource) {
            simSource.setData(generateFloodInundationGeoJSON(tideLevel, rainfall));
        }

        // 2. Update Real DEM Risk Zone Polygons
        const dangerSource = map.getSource("danger-zones-source") as maplibregl.GeoJSONSource;
        if (dangerSource) {
            dangerSource.setData(calculateDynamicZoneTilesGeoJSON(tideLevel, rainfall));
        }

        // 3. Update Real DEM Risk Zone Centroids
        const centroidSource = map.getSource("danger-zones-centroids-source") as maplibregl.GeoJSONSource;
        if (centroidSource) {
            centroidSource.setData(calculateDynamicZoneCentroidsGeoJSON(tideLevel, rainfall));
        }
    }, [tideLevel, rainfall, mapLoaded]);

    useEffect(() => {
        if (!mapRef.current || !mapLoaded) return;

        const controller = new AbortController();
        const source = mapRef.current.getSource(ELEVATION_SAFETY_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        source?.setData(EMPTY_FEATURE_COLLECTION);

        if (!layers.elevationSafety) return () => controller.abort();

        // The batch endpoint classifies one contiguous 3x3 terrain window with
        // shared thresholds. Stitching cached per-region responses can leave
        // seams, stale classifications, or no visible polygons at all.
        const params = new URLSearchParams({
            region_id: activeRegionId,
            radius: "1",
            minimum_feature_width_m: "20",
            minimum_hotspot_area_m2: "400",
            danger_percentile: "33",
            safe_percentile: "67",
        });

        fetch(`${ELEVATION_SAFETY_API_URL}/terrain/elevation-safety-batch?${params}`, {
            signal: controller.signal,
            cache: "no-store",
        })
            .then(async response => {
                if (!response.ok) throw new Error(`Elevation batch request failed: ${response.status}`);
                return response.json();
            })
            .then(geojson => {
                if (!controller.signal.aborted && isElevationSafetyFeatureCollection(geojson)) {
                    const nextSource = mapRef.current?.getSource(ELEVATION_SAFETY_SOURCE_ID) as
                        | maplibregl.GeoJSONSource
                        | undefined;
                    nextSource?.setData(geojson);
                }
            })
            .catch(error => {
                if (!controller.signal.aborted) {
                    console.error("Unable to load contiguous elevation safety regions.", error);
                }
            });

        return () => controller.abort();
    }, [activeRegionId, layers.elevationSafety, mapLoaded, mapStyleVersion]);

    useEffect(() => {
        if (!mapRef.current || !mapLoaded) return;

        const controller = new AbortController();
        const source = mapRef.current.getSource(INDIA_BASELINE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        source?.setData(EMPTY_FEATURE_COLLECTION);

        if (!layers.indiaBaseline) return () => controller.abort();

        fetchIndiaBaseline(0.25, 0.0)
            .then(data => {
                if (!controller.signal.aborted && data) {
                    const nextSource = mapRef.current?.getSource(INDIA_BASELINE_SOURCE_ID) as
                        | maplibregl.GeoJSONSource
                        | undefined;
                    nextSource?.setData(data);
                }
            })
            .catch(error => {
                if (!controller.signal.aborted) {
                    console.error("Unable to load India baseline terrain analysis.", error);
                }
            });

        return () => controller.abort();
    }, [layers.indiaBaseline, mapLoaded, mapStyleVersion]);

    useEffect(() => {
        if (!mapRef.current || !mapLoaded) return;

        const controller = new AbortController();
        const source = mapRef.current.getSource(INDIA_HOTSPOTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        source?.setData(EMPTY_FEATURE_COLLECTION);

        if (!layers.indiaHotspots) return () => controller.abort();

        fetchIndiaHotspots(0.25, 0.70, 0.30)
            .then(data => {
                if (!controller.signal.aborted && data) {
                    const nextSource = mapRef.current?.getSource(INDIA_HOTSPOTS_SOURCE_ID) as
                        | maplibregl.GeoJSONSource
                        | undefined;
                    nextSource?.setData(data);
                }
            })
            .catch(error => {
                if (!controller.signal.aborted) {
                    console.error("Unable to load India flood hotspots analysis.", error);
                }
            });

        return () => controller.abort();
    }, [layers.indiaHotspots, mapLoaded, mapStyleVersion]);

    const handleLayerToggle = (layerKey: keyof MapLayerState) => {
        const updated = { ...layers, [layerKey]: !layers[layerKey] };
        setLayers(updated);
        if (mapRef.current) {
            updateLayerVisibilities(mapRef.current, updated);
        }
    };

    const handleOpacityChange = (opacity: number) => {
        const updated = { ...layers, layerOpacity: opacity };
        setLayers(updated);
        if (mapRef.current) {
            updateLayerVisibilities(mapRef.current, updated);
        }
    };

    const handleCameraModeChange = (mode: CameraMode) => {
        const map = mapRef.current;
        const terrainEnabled = mode !== "standard";
        const terrainReady = map ? ensureTerrainSupport(map, terrainEnabled) : terrainAvailable;

        if (terrainEnabled && !terrainReady) {
            setActiveCameraMode("standard");
            return;
        }

        setActiveCameraMode(mode);
        setCameraPitch(CAMERA_PRESETS[mode].pitch);
        if (map) {
            map.easeTo({ ...CAMERA_PRESETS[mode], duration: 900, essential: true });
        }
    };

    const handleToggle3D = () => {
        handleCameraModeChange(cameraMode === "standard" ? "terrain" : "standard");
    };

    const handleSelectRegion = (preset: RegionPreset) => {
        setActiveRegionId(preset.id);
        setLayers(current => ({ ...current, elevationSafety: true }));
        if (!mapRef.current) return;

        const cameraPreset = CAMERA_PRESETS[cameraMode];
        const terrainReady = ensureTerrainSupport(mapRef.current, cameraMode !== "standard");
        const targetPitch = cameraMode === "standard" || !terrainReady ? 0 : cameraPreset.pitch;
        setCameraPitch(targetPitch);

        mapRef.current.flyTo({
            center: [preset.longitude, preset.latitude],
            zoom: preset.zoom,
            pitch: targetPitch,
            bearing: cameraMode === "standard" || !terrainReady ? 0 : cameraPreset.bearing,
            duration: 1800,
            essential: true,
        });
    };

    const handlePitchChange = (pitch: number) => {
        const map = mapRef.current;
        if (!map || cameraMode === "standard") return;

        const nextPitch = Math.max(10, Math.min(85, pitch));
        setCameraPitch(nextPitch);
        map.easeTo({ pitch: nextPitch, duration: 250, essential: true });
    };

    const flyToSpecificZone = (zoneId: string) => {
        if (!mapRef.current) return;
        const found = REAL_DEM_ZONE_TILES_RAW.find(z => z.properties.id === zoneId);
        if (!found) return;

        const coords = found.coordinates[0];
        let sumLng = 0;
        let sumLat = 0;
        for (let i = 0; i < coords.length - 1; i++) {
            sumLng += coords[i][0];
            sumLat += coords[i][1];
        }
        const centerLng = sumLng / (coords.length - 1);
        const centerLat = sumLat / (coords.length - 1);

        mapRef.current.flyTo({
            center: [centerLng, centerLat],
            zoom: 14.5,
            pitch: cameraMode === "standard" ? 0 : Math.max(10, mapRef.current.getPitch()),
            bearing: mapRef.current.getBearing(),
            duration: 1500,
            essential: true,
        });

        const dynamicGeo = calculateDynamicZoneTilesGeoJSON(tideLevel, rainfall);
        const dynamicFeat = dynamicGeo.features.find((f: any) => f.properties.id === zoneId);
        const popupProps = dynamicFeat ? dynamicFeat.properties : found.properties;

        setTimeout(() => {
            if (mapRef.current) {
                openZonePopup(popupProps, [centerLng, centerLat], mapRef.current);
            }
        }, 1550);
    };

    return (
        <div
            ref={rootContainerRef}
            className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl bg-zinc-950 fullscreen:rounded-none fullscreen:border-none ${heightClassName}`}
        >
            <div ref={mapContainerRef} className="h-full w-full bg-zinc-950" />

            {/* Top-Right Vertical Overlay Control Console */}
            <div className="absolute top-3.5 right-3.5 z-30 rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl backdrop-blur-md font-mono text-[10px] select-none w-56 overflow-hidden">
                {/* Console Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/90">
                    <span className="font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                        Overlay Console
                    </span>
                    <button
                        type="button"
                        onClick={() => setConsoleCollapsed(!consoleCollapsed)}
                        className="text-zinc-400 hover:text-white cursor-pointer p-0.5"
                        title={consoleCollapsed ? "Expand Console" : "Collapse Console"}
                    >
                        {consoleCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                </div>

                {!consoleCollapsed && (
                    <div className="p-2.5 space-y-2.5">
                        {/* Master Overlays Toggle */}
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                            <span className="font-bold text-zinc-200">ALL OVERLAYS</span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setAllOverlaysEnabled(!allOverlaysEnabled)}
                                    className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                                        allOverlaysEnabled
                                            ? "border-emerald-500/60 bg-emerald-950/80"
                                            : "border-zinc-700 bg-zinc-850"
                                    }`}
                                    title={allOverlaysEnabled ? "Turn all map overlays OFF" : "Turn all map overlays ON"}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                                            allOverlaysEnabled ? "translate-x-3.5 bg-emerald-400" : "translate-x-0 bg-zinc-500"
                                        }`}
                                    />
                                </button>
                                <span className={`text-[9px] font-bold w-6 ${allOverlaysEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                                    {allOverlaysEnabled ? "ON" : "OFF"}
                                </span>
                            </div>
                        </div>

                        {/* Individual Modules Vertical List with Slider Switches */}
                        <div className="space-y-2 pt-0.5">
                            {[
                                { key: "hotspots" as const, label: "Hotspots", icon: Crosshair },
                                { key: "layers" as const, label: "Layers HUD", icon: Layers },
                                { key: "sectors" as const, label: "Estuary Sectors", icon: MapPin },
                                { key: "legend" as const, label: "Symbology Key", icon: Shield },
                            ].map(item => {
                                const Icon = item.icon;
                                const isOn = allOverlaysEnabled && visibleOverlays[item.key];
                                return (
                                    <div key={item.key} className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-zinc-300">
                                            <Icon className="h-3 w-3 text-zinc-500" />
                                            {item.label}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                disabled={!allOverlaysEnabled}
                                                onClick={() =>
                                                    setVisibleOverlays(c => ({
                                                        ...c,
                                                        [item.key]: !c[item.key],
                                                    }))
                                                }
                                                className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                                                    isOn
                                                        ? "border-emerald-500/60 bg-emerald-950/80"
                                                        : "border-zinc-700 bg-zinc-850"
                                                }`}
                                                title={`Toggle ${item.label} overlay ${isOn ? "OFF" : "ON"}`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-md transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                                                        isOn ? "translate-x-3.5 bg-emerald-400" : "translate-x-0 bg-zinc-500"
                                                    }`}
                                                />
                                            </button>
                                            <span
                                                className={`text-[9px] font-bold w-6 ${
                                                    isOn ? "text-emerald-400" : "text-zinc-500"
                                                }`}
                                            >
                                                {isOn ? "ON" : "OFF"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Region Selector (Top-Left) */}
            {allOverlaysEnabled && visibleOverlays.hotspots && (
                <MapQuickJumper
                    onSelectRegion={handleSelectRegion}
                    activeRegionId={activeRegionId}
                    onClose={() => setVisibleOverlays(current => ({ ...current, hotspots: false }))}
                />
            )}

            {/* Map Layer and Base Style Controls (Top-Right) */}
            {allOverlaysEnabled && visibleOverlays.layers && (
                <MapLayerControls
                    currentStyle={currentStyleId}
                    onStyleChange={handleStyleChange}
                    layers={layers}
                    onLayerToggle={handleLayerToggle}
                    onOpacityChange={handleOpacityChange}
                    onToggle3D={handleToggle3D}
                    cameraMode={cameraMode}
                    pitch={cameraPitch}
                    onCameraModeChange={handleCameraModeChange}
                    onPitchChange={handlePitchChange}
                    trafficAvailable={Boolean(TRAFFIC_TILE_URL)}
                    onClose={() => setVisibleOverlays(current => ({ ...current, layers: false }))}
                />
            )}

            {/* Active Zone Fast-Fly HUD (Top-Left below Hotspots) */}
            {allOverlaysEnabled && visibleOverlays.sectors && (
                <MapOverlayCard
                    label="Estuary & Basin Sectors"
                    onClose={() => setVisibleOverlays(current => ({ ...current, sectors: false }))}
                    className="absolute top-16 left-3.5 z-20 hidden lg:flex max-w-xs flex-col gap-1 p-2.5"
                >
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                        <Crosshair className="h-3 w-3 text-zinc-400" />
                        Jump to Estuary & Basin Sectors:
                    </span>
                    <div className="flex flex-col gap-1 pt-1 max-h-64 overflow-y-auto no-scrollbar pr-0.5">
                        {(REAL_DEM_ZONE_TILES_RAW.filter(
                            z => z.properties.region.toLowerCase() === activeRegionId.toLowerCase(),
                        ).length > 0
                            ? REAL_DEM_ZONE_TILES_RAW.filter(
                                  z => z.properties.region.toLowerCase() === activeRegionId.toLowerCase(),
                              )
                            : REAL_DEM_ZONE_TILES_RAW.slice(0, 6)
                        ).map(zone => {
                            const p = zone.properties;
                            const badgeBorder =
                                p.elevationMeters <= 1.0
                                    ? "border-rose-500/40 text-rose-400"
                                    : p.elevationMeters <= 2.5
                                      ? "border-amber-500/40 text-amber-400"
                                      : p.elevationMeters <= 5.0
                                        ? "border-yellow-500/40 text-yellow-400"
                                        : "border-emerald-500/40 text-emerald-400";
                            const [borderCls, textCls] = badgeBorder.split(" ");

                            return (
                                <button
                                    key={p.id}
                                    onClick={() => flyToSpecificZone(p.id)}
                                    className={`flex items-center justify-between text-left px-2 py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 border ${borderCls} text-[11px] font-mono text-white transition-colors cursor-pointer`}
                                >
                                    <span className="truncate max-w-[160px]">{p.name}</span>
                                    <span className={`${textCls} font-bold ml-2 shrink-0`}>
                                        {p.elevationMeters}m MSL
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </MapOverlayCard>
            )}

            {/* Map Legend (Bottom-Left) */}
            {allOverlaysEnabled && visibleOverlays.legend && (
                <MapLegend
                    elevationSafetyActive={layers.elevationSafety}
                    indiaBaselineActive={layers.indiaBaseline}
                    indiaHotspotsActive={layers.indiaHotspots}
                    onClose={() => setVisibleOverlays(current => ({ ...current, legend: false }))}
                />
            )}
        </div>
    );
}
