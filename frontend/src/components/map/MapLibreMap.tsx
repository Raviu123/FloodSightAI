"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import {
  BASE_MAP_STYLES,
  type BaseMapStyleId,
  DANGER_ZONES_GEOJSON,
  LOW_LYING_AREAS_GEOJSON,
  WATER_BODIES_GEOJSON,
  CRITICAL_FACILITIES_GEOJSON,
  EVACUATION_ROUTES_GEOJSON,
  generateFloodInundationGeoJSON,
  REGION_PRESETS,
  type RegionPreset,
} from "@/data/coastal-map-data";
import { MapLayerControls, type MapLayerState } from "./MapLayerControls";
import { MapLegend } from "./MapLegend";
import { MapQuickJumper } from "./MapQuickJumper";

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

  const [layers, setLayers] = useState<MapLayerState>({
    dangerZones: true,
    lowLyingAreas: true,
    waterBodies: true,
    facilities: true,
    evacuationRoutes: true,
    floodInundation: true,
    is3DTerrain: true,
    layerOpacity: 0.75,
  });

  const getStyleObject = (id: BaseMapStyleId) => {
    const found = BASE_MAP_STYLES.find((s) => s.id === id);
    return found ? found.styleObject : BASE_MAP_STYLES[0].styleObject;
  };

  const addAllLayers = useCallback((map: maplibregl.Map) => {
    if (!map) return;

    // 1. Low-lying Areas
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
          "fill-opacity": ["*", layers.layerOpacity * 0.5, ["get", "opacity"]],
        },
      });
    }

    // 2. Dynamic Flood Inundation Simulation
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
          "fill-opacity": layers.layerOpacity * 0.6,
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

    // 3. Danger Zones
    if (!map.getSource("danger-zones-source")) {
      map.addSource("danger-zones-source", {
        type: "geojson",
        data: DANGER_ZONES_GEOJSON,
      });

      map.addLayer({
        id: "danger-zones-layer-fill",
        type: "fill",
        source: "danger-zones-source",
        paint: {
          "fill-color": ["get", "riskColor"],
          "fill-opacity": layers.layerOpacity * 0.55,
        },
      });

      map.addLayer({
        id: "danger-zones-layer-stroke",
        type: "line",
        source: "danger-zones-source",
        paint: {
          "line-color": ["get", "riskColor"],
          "line-width": 2.5,
        },
      });
    }

    // 4. Water Bodies
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
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    }

    // 5. Evacuation Routes
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
          "line-opacity": 0.9,
        },
      });
    }

    // 6. Critical Facilities
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
          "circle-radius": 7,
          "circle-color": "#0f172a",
          "circle-stroke-color": "#38bdf8",
          "circle-stroke-width": 2.5,
        },
      });
    }

    updateLayerVisibilities(map, layers);
  }, [tideLevel, rainfall, layers]);

  const updateLayerVisibilities = (map: maplibregl.Map, lState: MapLayerState) => {
    if (!map) return;

    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    };

    setVis("danger-zones-layer-fill", lState.dangerZones);
    setVis("danger-zones-layer-stroke", lState.dangerZones);
    setVis("low-lying-layer-fill", lState.lowLyingAreas);
    setVis("water-bodies-layer-line", lState.waterBodies);
    setVis("evacuation-routes-layer-line", lState.evacuationRoutes);
    setVis("critical-facilities-layer-circle", lState.facilities);
    setVis("flood-inundation-layer-fill", lState.floodInundation);
    setVis("flood-inundation-layer-stroke", lState.floodInundation);

    if (map.getLayer("danger-zones-layer-fill")) {
      map.setPaintProperty("danger-zones-layer-fill", "fill-opacity", lState.layerOpacity * 0.55);
    }
    if (map.getLayer("flood-inundation-layer-fill")) {
      map.setPaintProperty("flood-inundation-layer-fill", "fill-opacity", lState.layerOpacity * 0.6);
    }
    if (map.getLayer("low-lying-layer-fill")) {
      map.setPaintProperty("low-lying-layer-fill", "fill-opacity", lState.layerOpacity * 0.4);
    }
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

    // Click handler for Danger Zones
    map.on("click", "danger-zones-layer-fill", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      const props = feature.properties as any;

      if (popupRef.current) popupRef.current.remove();

      const popupHtml = `
        <div class="p-3.5 space-y-2 text-zinc-100 min-w-[240px] font-mono">
          <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <span class="font-bold text-xs text-sky-400">${props.id}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style="background: ${props.riskColor}26; color: ${props.riskColor}; border: 1px solid ${props.riskColor}60">
              ${props.riskLevel}
            </span>
          </div>
          <div class="font-sans font-semibold text-xs leading-snug text-white">${props.name}</div>
          <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-300">
            <div>Elevation: <b class="text-white">${props.elevationMeters}m MSL</b></div>
            <div>Population: <b class="text-white">${Number(props.population).toLocaleString()}</b></div>
            <div>Peak Time: <b class="text-amber-400">${props.peakSurgeTime}</b></div>
            <div>Sector: <b class="text-zinc-200">${props.sectorCode || "SEC-01"}</b></div>
          </div>
          <div class="text-[10px] text-zinc-400 border-t border-zinc-850 pt-1.5 font-sans">
            Protocol: <span class="text-sky-300 font-medium">${props.recommendation}</span>
          </div>
        </div>
      `;

      popupRef.current = new maplibregl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(popupHtml)
        .addTo(map);

      if (onZoneSelect) onZoneSelect(props);
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

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const source = map.getSource("flood-inundation-source") as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(generateFloodInundationGeoJSON(tideLevel, rainfall));
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
      pitch: new3D ? 50 : 0,
      bearing: new3D ? -20 : 0,
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

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl bg-zinc-950 ${heightClassName}`}>
      <div ref={mapContainerRef} className="h-full w-full bg-zinc-950" />

      <MapQuickJumper
        onSelectRegion={handleSelectRegion}
        activeRegionId={activeRegionId}
      />

      <MapLayerControls
        currentStyle={currentStyleId}
        onStyleChange={handleStyleChange}
        layers={layers}
        onLayerToggle={handleLayerToggle}
        onOpacityChange={handleOpacityChange}
        onToggle3D={handleToggle3D}
      />

      <MapLegend />
    </div>
  );
}
