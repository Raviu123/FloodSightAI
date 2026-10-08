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
  Sparkles,
} from "lucide-react";
import { BASE_MAP_STYLES, type BaseMapStyleId } from "@/data/coastal-map-data";
import { Badge } from "@/components/ui/badge";

export interface MapLayerState {
  dangerZones: boolean;
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

  const layerConfigs = [
    {
      key: "dangerZones" as const,
      label: "Danger Risk Zones",
      description: "Color-coded risk classifications",
      icon: Shield,
      color: "text-red-500",
    },
    {
      key: "floodInundation" as const,
      label: "Dynamic Inundation Layer",
      description: "Live simulated tide & rain spread",
      icon: Waves,
      color: "text-blue-500",
      highlight: true,
    },
    {
      key: "lowLyingAreas" as const,
      label: "Low-Lying Elevation",
      description: "Regions below 1.0m & 2.5m MSL",
      icon: SlidersHorizontal,
      color: "text-sky-500",
    },
    {
      key: "waterBodies" as const,
      label: "Water Bodies & Ingress",
      description: "River networks & estuaries",
      icon: Waves,
      color: "text-cyan-500",
    },
    {
      key: "facilities" as const,
      label: "Critical Facilities",
      description: "Hospitals, shelters, power stations",
      icon: MapPin,
      color: "text-emerald-500",
    },
    {
      key: "evacuationRoutes" as const,
      label: "Safe Evacuation Paths",
      description: "High-elevation transit corridors",
      icon: Navigation,
      color: "text-green-500",
    },
  ];

  return (
    <div
      className={`absolute top-4 right-4 z-20 transition-all duration-300 ${
        isCollapsed ? "w-11" : "w-80 sm:w-88"
      }`}
    >
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 shadow-xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            {!isCollapsed && (
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                Map Modes & Layers
              </span>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={isCollapsed ? "Expand Layer Panel" : "Collapse Layer Panel"}
          >
            {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="p-4 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
            {/* Base Map Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Base Map Style
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {BASE_MAP_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => onStyleChange(style.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      currentStyle === style.id
                        ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-lg">{style.thumbnail}</span>
                    <span className="text-[11px] leading-tight mt-1">{style.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Perspective Control */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-purple-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    3D Terrain Perspective
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {layers.is3DTerrain ? "Tilted 3D View (45°)" : "Top-Down Ortho (0°)"}
                  </span>
                </div>
              </div>
              <button
                onClick={onToggle3D}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  layers.is3DTerrain
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {layers.is3DTerrain ? "3D ON" : "2D"}
              </button>
            </div>

            {/* Overlays / Map Layers List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Active Map Layers
                </label>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  GeoJSON Vector
                </Badge>
              </div>

              <div className="space-y-1.5">
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
                            ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30"
                            : "border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-850"
                          : "border-transparent opacity-60 hover:opacity-90 bg-zinc-50/50 dark:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${layer.color}`} />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {layer.label}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {layer.description}
                          </span>
                        </div>
                      </div>

                      <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        {isVisible ? (
                          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-zinc-400" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Layer Opacity Slider */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">Layer Opacity</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">
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
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
