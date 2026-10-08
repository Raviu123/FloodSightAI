"use client";

import { useState } from "react";
import {
  Layers,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Compass,
  MapPin,
  Waves,
  Shield,
  Navigation,
  ChevronRight,
  ChevronLeft,
  Satellite,
  Mountain,
  Map,
  Moon,
  Sun,
  Maximize2,
} from "lucide-react";
import { BASE_MAP_STYLES, type BaseMapStyleId } from "@/data/coastal-map-data";
import { Badge } from "@/components/ui/badge";

export interface MapLayerState {
  dangerZones: boolean;
  floodCoverage: boolean;
  lowLyingAreas: boolean;
  waterBodies: boolean;
  facilities: boolean;
  evacuationRoutes: boolean;
  floodInundation: boolean;
  is3DTerrain: boolean;
  layerOpacity: number;
}

interface MapLayerControlsProps {
  currentStyle: BaseMapStyleId;
  onStyleChange: (styleId: BaseMapStyleId) => void;
  layers: MapLayerState;
  onLayerToggle: (layerKey: keyof MapLayerState) => void;
  onOpacityChange: (opacity: number) => void;
  onToggle3D: () => void;
}

export function MapLayerControls({
  currentStyle,
  onStyleChange,
  layers,
  onLayerToggle,
  onOpacityChange,
  onToggle3D,
}: MapLayerControlsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getStyleIcon = (iconName: string) => {
    switch (iconName) {
      case "Satellite":
        return <Satellite className="h-3.5 w-3.5" />;
      case "Mountain":
        return <Mountain className="h-3.5 w-3.5" />;
      case "Map":
        return <Map className="h-3.5 w-3.5" />;
      case "Moon":
        return <Moon className="h-3.5 w-3.5" />;
      case "Sun":
        return <Sun className="h-3.5 w-3.5" />;
      default:
        return <Map className="h-3.5 w-3.5" />;
    }
  };

  const layerConfigs = [
    {
      key: "dangerZones" as const,
      label: "Risk Classification Zones",
      description: "Color-coded danger polygons",
      icon: Shield,
      color: "text-rose-400",
    },
    {
      key: "floodCoverage" as const,
      label: "Regional Floodplain Extent",
      description: "Google Flood Hub basin network",
      icon: Waves,
      color: "text-purple-400",
      highlight: true,
    },
    {
      key: "floodInundation" as const,
      label: "Dynamic Surge Inundation",
      description: "Real-time tidal water spread",
      icon: Waves,
      color: "text-sky-400",
      highlight: true,
    },
    {
      key: "lowLyingAreas" as const,
      label: "Depression Elevation Contours",
      description: "Areas < 1.0m & 2.5m MSL",
      icon: SlidersHorizontal,
      color: "text-cyan-400",
    },
    {
      key: "waterBodies" as const,
      label: "River & Estuary Channels",
      description: "Inflow networks & tidal mouths",
      icon: Waves,
      color: "text-teal-400",
    },
    {
      key: "facilities" as const,
      label: "Critical Infrastructure",
      description: "Hospitals, shelters, power hubs",
      icon: MapPin,
      color: "text-emerald-400",
    },
    {
      key: "evacuationRoutes" as const,
      label: "Evacuation Corridors",
      description: "Designated safe transit paths",
      icon: Navigation,
      color: "text-green-400",
    },
  ];

  return (
    <div
      className={`absolute top-3.5 right-3.5 z-20 transition-all duration-200 ${
        isCollapsed ? "w-10" : "w-80 sm:w-84"
      }`}
    >
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-850 bg-zinc-900/60">
          <div className="flex items-center gap-2 overflow-hidden">
            <Layers className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-200">
                  Layers & Viewport
                </span>
                <Badge variant="outline" className="text-[9px] py-0 px-1">
                  GIS Vector
                </Badge>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isCollapsed ? "Expand Layer HUD" : "Collapse Layer HUD"}
          >
            {isCollapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="p-3.5 space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto">
            {/* Base Map Style Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Base Layer
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {BASE_MAP_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => onStyleChange(style.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      currentStyle === style.id
                        ? "border-sky-500/80 bg-sky-950/50 text-sky-300 font-semibold shadow-xs"
                        : "border-zinc-800/80 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
                    }`}
                  >
                    <span className="mb-1">{getStyleIcon(style.iconName)}</span>
                    <span className="text-[10px] font-mono leading-tight">{style.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Terrain Perspective Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-purple-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-200">
                    3D Terrain Tilt
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {layers.is3DTerrain ? "Perspective (45deg Angle)" : "Orthographic (0deg Top-Down)"}
                  </span>
                </div>
              </div>
              <button
                onClick={onToggle3D}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                  layers.is3DTerrain
                    ? "bg-purple-600 text-white border border-purple-400/40"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                }`}
              >
                {layers.is3DTerrain ? "3D ACTIVE" : "2D FLAT"}
              </button>
            </div>

            {/* Active Layers */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Vector Overlays
              </span>

              <div className="space-y-1">
                {layerConfigs.map((layer) => {
                  const Icon = layer.icon;
                  const isVisible = layers[layer.key];
                  return (
                    <div
                      key={layer.key}
                      onClick={() => onLayerToggle(layer.key)}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        isVisible
                          ? layer.highlight
                            ? "border-sky-500/40 bg-sky-950/30 text-zinc-100"
                            : "border-zinc-800 bg-zinc-900/80 text-zinc-200"
                          : "border-transparent opacity-40 hover:opacity-75 bg-zinc-900/30 text-zinc-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${layer.color}`} />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium leading-none">
                            {layer.label}
                          </span>
                          <span className="text-[10px] text-zinc-500 mt-0.5">
                            {layer.description}
                          </span>
                        </div>
                      </div>

                      <button className="text-zinc-400 hover:text-white">
                        {isVisible ? (
                          <Eye className="h-3.5 w-3.5 text-sky-400" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-850">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Layer Density / Opacity</span>
                <span className="text-sky-400 font-semibold">
                  {Math.round(layers.layerOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={layers.layerOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
