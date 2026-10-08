"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BASE_MAP_STYLES,
  type BaseMapStyleId,
  LOW_LYING_AREAS_GEOJSON,
  WATER_BODIES_GEOJSON,
  CRITICAL_FACILITIES_GEOJSON,
  EVACUATION_ROUTES_GEOJSON,
  generateFloodInundationGeoJSON,
  calculateDynamicZoneTilesGeoJSON,
  calculateDynamicZoneCentroidsGeoJSON,
  REAL_DEM_ZONE_TILES_RAW,
  REGION_PRESETS,
  type RegionPreset,
} from "@/data/coastal-map-data";
import { MapLayerControls, type MapLayerState } from "./MapLayerControls";
import { MapLegend } from "./MapLegend";
import { MapQuickJumper } from "./MapQuickJumper";
import { Crosshair, ShieldAlert, ChevronRight } from "lucide-react";

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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [currentStyleId, setCurrentStyleId] = useState<BaseMapStyleId>("satellite");
  const [activeRegionId, setActiveRegionId] = useState<string>("mangalore");
  const [mapLoaded, setMapLoaded] = useState(false);

  // Layer toggles state
  const [layers, setLayers] = useState<MapLayerState>({
    dangerZones: true,
    lowLyingAreas: false,
    waterBodies: true,
    facilities: true,
    evacuationRoutes: true,
    floodInundation: true,
    is3DTerrain: true,
    layerOpacity: 0.85,
  });

  const getStyleObject = (id: BaseMapStyleId) => {
    const found = BASE_MAP_STYLES.find((s) => s.id === id);
    return found ? found.styleObject : BASE_MAP_STYLES[0].styleObject;
  };

  const updateLayerVisibilities = (map: maplibregl.Map, lState: MapLayerState) => {
    if (!map) return;

    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    };

    setVis("danger-zones-layer-fill", lState.dangerZones);
    setVis("danger-zones-layer-stroke", lState.dangerZones);
    setVis("danger-zones-centroids-halo", lState.dangerZones);
    setVis("danger-zones-centroids-circle", lState.dangerZones);
    setVis("low-lying-layer-fill", lState.lowLyingAreas);
    setVis("water-bodies-layer-line", lState.waterBodies);
    setVis("evacuation-routes-layer-line", lState.evacuationRoutes);
    setVis("critical-facilities-layer-circle", lState.facilities);
    setVis("flood-inundation-layer-fill", lState.floodInundation);
    setVis("flood-inundation-layer-stroke", lState.floodInundation);
  };

  const addAllLayers = useCallback((map: maplibregl.Map) => {
    if (!map) return;

    // 1. Low-lying Areas (Contour depression)
    if (!map.getSource("low-lying-source")) {
      map.addSource("low-lying-source", {
        type: "geojson",
        data: LOW_LYING_AREAS_GEOJSON,
      });

      map.addLayer({
        id: "low-lying-layer-fill",
        type: "fill",
        source: "low-lying-source",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["get", "opacity"],
        },
      });
    }

    // 2. Dynamic Flood Inundation Simulation Layer
    if (!map.getSource("flood-inundation-source")) {
      map.addSource("flood-inundation-source", {
        type: "geojson",
        data: generateFloodInundationGeoJSON(tideLevel, rainfall),
      });

      map.addLayer({
        id: "flood-inundation-layer-fill",
        type: "fill",
        source: "flood-inundation-source",
        paint: {
          "fill-color": "#38bdf8",
          "fill-opacity": 0.35,
        },
      });

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

      map.addLayer({
        id: "danger-zones-layer-fill",
        type: "fill",
        source: "danger-zones-source",
        paint: {
          "fill-color": ["get", "riskColor"],
          "fill-opacity": ["get", "fillOpacity"],
        },
      });

      map.addLayer({
        id: "danger-zones-layer-stroke",
        type: "line",
        source: "danger-zones-source",
        paint: {
          "line-color": ["get", "strokeColor"],
          "line-width": ["get", "strokeWidth"],
        },
      });
    }

    // 4. Danger Zone Centroid Beacons / Badges
    if (!map.getSource("danger-zones-centroids-source")) {
      map.addSource("danger-zones-centroids-source", {
        type: "geojson",
        data: calculateDynamicZoneCentroidsGeoJSON(tideLevel, rainfall),
      });

      map.addLayer({
        id: "danger-zones-centroids-halo",
        type: "circle",
        source: "danger-zones-centroids-source",
        paint: {
          "circle-radius": 14,
          "circle-color": ["get", "riskColor"],
          "circle-opacity": 0.40,
        },
      });

      map.addLayer({
        id: "danger-zones-centroids-circle",
        type: "circle",
        source: "danger-zones-centroids-source",
        paint: {
          "circle-radius": 8,
          "circle-color": ["get", "riskColor"],
          "circle-stroke-width": 2,
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

      map.addLayer({
        id: "evacuation-routes-layer-line",
        type: "line",
        source: "evacuation-routes-source",
        paint: {
          "line-color": ["get", "routeColor"],
          "line-width": 4.5,
          "line-opacity": 0.95,
        },
      });
    }

    // 7. Critical Facilities
    if (!map.getSource("critical-facilities-source")) {
      map.addSource("critical-facilities-source", {
        type: "geojson",
        data: CRITICAL_FACILITIES_GEOJSON,
      });

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
  }, [tideLevel, rainfall, layers]);

  const openZonePopup = (props: any, lngLat: maplibregl.LngLatLike, map: maplibregl.Map) => {
    if (popupRef.current) popupRef.current.remove();

    const popupHtml = `
      <div class="p-3.5 space-y-2 text-zinc-100 min-w-[280px] font-mono">
        <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
          <span class="font-bold text-xs text-sky-400">${props.id}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style="background: ${props.riskColor}26; color: ${props.riskColor}; border: 1px solid ${props.riskColor}60">
            ${props.riskLevel}
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

    popupRef.current = new maplibregl.Popup({ offset: 12 })
      .setLngLat(lngLat)
      .setHTML(popupHtml)
      .addTo(map);

    if (onZoneSelect) onZoneSelect(props);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultRegion = REGION_PRESETS[0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyleObject(currentStyleId),
      center: [defaultRegion.longitude, defaultRegion.latitude],
      zoom: defaultRegion.zoom,
      pitch: defaultRegion.pitch,
      bearing: defaultRegion.bearing,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      mapRef.current = map;
      addAllLayers(map);
      setMapLoaded(true);
    });

    // Click handler for Danger Zones Polygon
    map.on("click", "danger-zones-layer-fill", (e) => {
      if (!e.features || !e.features[0]) return;
      openZonePopup(e.features[0].properties, e.lngLat, map);
    });

    // Click handler for Danger Zones Centroid Badge
    map.on("click", "danger-zones-centroids-circle", (e) => {
      if (!e.features || !e.features[0]) return;
      const coords = (e.features[0].geometry as any).coordinates.slice();
      openZonePopup(e.features[0].properties, coords, map);
    });

    // Click handler for Critical Facilities
    map.on("click", "critical-facilities-layer-circle", (e) => {
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
      popupRef.current = new maplibregl.Popup({ offset: 12 })
        .setLngLat(coords)
        .setHTML(popupHtml)
        .addTo(map);
    });

    // Click handler for Evacuation Routes
    map.on("click", "evacuation-routes-layer-line", (e) => {
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

      popupRef.current = new maplibregl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(popupHtml)
        .addTo(map);
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
    map.on("mouseenter", "critical-facilities-layer-circle", setPointer);
    map.on("mouseleave", "critical-facilities-layer-circle", resetPointer);
    map.on("mouseenter", "evacuation-routes-layer-line", setPointer);
    map.on("mouseleave", "evacuation-routes-layer-line", resetPointer);

    return () => {
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

  const handleToggle3D = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const new3D = !layers.is3DTerrain;
    setLayers((prev) => ({ ...prev, is3DTerrain: new3D }));

    map.easeTo({
      pitch: new3D ? 45 : 0,
      bearing: new3D ? -15 : 0,
      duration: 1000,
    });
  };

  const handleSelectRegion = (preset: RegionPreset) => {
    setActiveRegionId(preset.id);
    if (!mapRef.current) return;

    mapRef.current.flyTo({
      center: [preset.longitude, preset.latitude],
      zoom: preset.zoom,
      pitch: layers.is3DTerrain ? preset.pitch : 0,
      bearing: layers.is3DTerrain ? preset.bearing : 0,
      duration: 1800,
      essential: true,
    });
  };

  const flyToSpecificZone = (zoneId: string) => {
    if (!mapRef.current) return;
    const found = REAL_DEM_ZONE_TILES_RAW.find((z) => z.properties.id === zoneId);
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
      pitch: 45,
      bearing: -10,
      duration: 1500,
      essential: true,
    });

    setTimeout(() => {
      if (mapRef.current) {
        openZonePopup(found.properties, [centerLng, centerLat], mapRef.current);
      }
    }, 1550);
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl bg-zinc-950 ${heightClassName}`}>
      <div ref={mapContainerRef} className="h-full w-full bg-zinc-950" />

      {/* Quick Region Selector (Top-Left) */}
      <MapQuickJumper
        onSelectRegion={handleSelectRegion}
        activeRegionId={activeRegionId}
      />

      {/* Map Layer and Base Style Controls (Top-Right) */}
      <MapLayerControls
        currentStyle={currentStyleId}
        onStyleChange={handleStyleChange}
        layers={layers}
        onLayerToggle={handleLayerToggle}
        onOpacityChange={handleOpacityChange}
        onToggle3D={handleToggle3D}
      />

      {/* Active Zone Fast-Fly HUD (Top-Left below Hotspots) */}
      <div className="absolute top-16 left-3.5 z-20 hidden lg:flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2.5 backdrop-blur-xl shadow-2xl max-w-xs">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
          <Crosshair className="h-3 w-3 text-sky-400" />
          Jump to River & Estuary Sectors:
        </span>
        <div className="flex flex-col gap-1 pt-1">
          <button
            onClick={() => flyToSpecificZone("ZONE-IXE-01")}
            className="flex items-center justify-between text-left px-2 py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 border border-rose-500/40 text-[11px] font-mono text-white transition-colors cursor-pointer"
          >
            <span className="truncate">Bengre River Mouth Spit</span>
            <span className="text-rose-400 font-bold ml-2">0.4m MSL</span>
          </button>
          <button
            onClick={() => flyToSpecificZone("ZONE-IXE-02")}
            className="flex items-center justify-between text-left px-2 py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 border border-rose-500/40 text-[11px] font-mono text-white transition-colors cursor-pointer"
          >
            <span className="truncate">Ullal Fishery Lowlands</span>
            <span className="text-rose-400 font-bold ml-2">0.9m MSL</span>
          </button>
          <button
            onClick={() => flyToSpecificZone("ZONE-IXE-03")}
            className="flex items-center justify-between text-left px-2 py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/40 text-[11px] font-mono text-white transition-colors cursor-pointer"
          >
            <span className="truncate">Old Port Bunder Wharf</span>
            <span className="text-amber-400 font-bold ml-2">1.5m MSL</span>
          </button>
          <button
            onClick={() => flyToSpecificZone("ZONE-IXE-04")}
            className="flex items-center justify-between text-left px-2 py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/40 text-[11px] font-mono text-white transition-colors cursor-pointer"
          >
            <span className="truncate">Gurupura River Valley</span>
            <span className="text-amber-400 font-bold ml-2">2.3m MSL</span>
          </button>
          <button
            onClick={() => flyToSpecificZone("ZONE-IXE-06")}
            className="flex items-center justify-between text-left px-2 py-1 rounded bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/40 text-[11px] font-mono text-white transition-colors cursor-pointer"
          >
            <span className="truncate">Kadri Highland Safe HQ</span>
            <span className="text-emerald-400 font-bold ml-2">24.5m MSL</span>
          </button>
        </div>
      </div>

      {/* Map Legend (Bottom-Left) */}
      <MapLegend />
    </div>
  );
}
