"use client";

import { Badge } from "@/components/ui/badge";
import { BASE_MAP_STYLES, type BaseMapStyleId } from "@/data/coastal-map-data";
import {
    CarFront,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Compass,
    Eye,
    EyeOff,
    Globe2,
    Layers,
    Map,
    MapPin,
    Moon,
    Mountain,
    Navigation,
    Radio,
    Satellite,
    Shield,
    SlidersHorizontal,
    Sun,
    Waves,
} from "lucide-react";
import { useState } from "react";
import { MapOverlayCard } from "./MapOverlayCard";

export interface MapLayerState {
    dangerZones: boolean;
    floodCoverage: boolean;
    lowLyingAreas: boolean;
    waterBodies: boolean;
    transport: boolean;
    traffic: boolean;
    facilities: boolean;
    evacuationRoutes: boolean;
    floodInundation: boolean;
    elevationSafety: boolean;
    layerOpacity: number;
}

export type CameraMode = "standard" | "terrain" | "intelligence";

interface MapLayerControlsProps {
    currentStyle: BaseMapStyleId;
    onStyleChange: (styleId: BaseMapStyleId) => void;
    layers: MapLayerState;
    onLayerToggle: (layerKey: keyof MapLayerState) => void;
    onOpacityChange: (opacity: number) => void;
    onToggle3D: () => void;
    cameraMode: CameraMode;
    pitch: number;
    onCameraModeChange: (mode: CameraMode) => void;
    onPitchChange: (pitch: number) => void;
    onClose?: () => void;
    trafficAvailable?: boolean;
}

export function MapLayerControls({
    currentStyle,
    onStyleChange,
    layers,
    onLayerToggle,
    onOpacityChange,
    onToggle3D,
    cameraMode,
    pitch,
    onCameraModeChange,
    onPitchChange,
    onClose,
    trafficAvailable = false,
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
            key: "elevationSafety" as const,
            label: "Elevation Safety Regions",
            description: "Relative terrain elevation for selected region",
            icon: Mountain,
            color: "text-emerald-400",
            highlight: true,
        },
        {
            key: "transport" as const,
            label: "Transport Network",
            description: "OpenFreeMap / OpenStreetMap vector roads",
            icon: CarFront,
            color: "text-amber-300",
            highlight: true,
        },
        {
            key: "traffic" as const,
            label: "Live Traffic",
            description: trafficAvailable ? "Configured traffic tile provider" : "Provider configuration required",
            icon: Radio,
            color: "text-orange-400",
            highlight: trafficAvailable,
            unavailable: !trafficAvailable,
        },
        {
            key: "waterBodies" as const,
            label: "Water Bodies",
            description: "OpenStreetMap water + FloodSight channels",
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
        <MapOverlayCard
            label="Layers & Viewport"
            onClose={onClose}
            className="absolute top-14 right-3.5 z-20 w-80 sm:w-84 transition-all duration-200"
        >
            <div>
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-900/60">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Layers className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-200">
                                Layers & Viewport
                            </span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-zinc-700 text-zinc-300">
                                GIS Vector
                            </Badge>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={isCollapsed ? "Expand Layer HUD" : "Collapse Layer HUD"}
                    >
                        {isCollapsed ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronUp className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>

                {!isCollapsed && (
                    <div className="p-3.5 space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto no-scrollbar">
                        {/* Base Map Style Selector */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                                Base Layer
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                                {BASE_MAP_STYLES.map(style => (
                                    <button
                                        key={style.id}
                                        onClick={() => onStyleChange(style.id)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                                            currentStyle === style.id
                                                ? "border-zinc-700 bg-zinc-800 text-zinc-100 font-semibold shadow-xs"
                                                : "border-zinc-800/80 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
                                        }`}
                                    >
                                        <span className="mb-1">{getStyleIcon(style.iconName)}</span>
                                        <span className="text-[10px] font-mono leading-tight">{style.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Unified camera and terrain presets */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                                    Camera Mode
                                </span>
                                <Compass className="h-3.5 w-3.5 text-zinc-400" />
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {(
                                    [
                                        { id: "standard", label: "Standard", icon: Map },
                                        { id: "terrain", label: "Terrain", icon: Mountain },
                                        { id: "intelligence", label: "3D Intel", icon: Globe2 },
                                    ] as const
                                ).map(mode => {
                                    const Icon = mode.icon;
                                    const active = cameraMode === mode.id;
                                    return (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => onCameraModeChange(mode.id)}
                                            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all cursor-pointer ${
                                                active
                                                    ? "border-zinc-700 bg-zinc-800 text-zinc-100 font-semibold shadow-xs"
                                                    : "border-zinc-800/80 bg-zinc-900/70 text-zinc-500 hover:bg-zinc-850 hover:text-zinc-200"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            <span className="text-[9px] font-mono leading-tight">{mode.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={onToggle3D}
                                className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-[10px] font-mono text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 cursor-pointer"
                            >
                                {cameraMode === "standard" ? "Enable Terrain" : "Return to 2D"}
                            </button>
                            {cameraMode !== "standard" && (
                                <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 p-2">
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="text-zinc-500">Camera Tilt</span>
                                        <span className="text-zinc-200 font-bold">{Math.round(pitch)}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="85"
                                        step="1"
                                        value={Math.max(10, Math.min(85, pitch))}
                                        onChange={event => onPitchChange(Number(event.target.value))}
                                        aria-label="Camera tilt in degrees"
                                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-zinc-200"
                                    />
                                    <div className="flex justify-between text-[9px] font-mono text-zinc-600">
                                        <span>10° LOW</span>
                                        <span>85° HIGH</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Active Layers */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                                Vector Overlays
                            </span>

                            <div className="space-y-1">
                                {layerConfigs.map(layer => {
                                    const Icon = layer.icon;
                                    const isVisible = layers[layer.key];
                                    return (
                                        <div
                                            key={layer.key}
                                            onClick={() => !layer.unavailable && onLayerToggle(layer.key)}
                                            className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                                                layer.unavailable
                                                    ? "border-transparent opacity-35 bg-zinc-900/30 text-zinc-600 cursor-not-allowed"
                                                    : isVisible
                                                      ? "border-zinc-700 bg-zinc-850 text-zinc-100 font-medium"
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

                                            <button
                                                disabled={layer.unavailable}
                                                className="text-zinc-400 hover:text-white disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                {layer.unavailable ? (
                                                    <span className="text-[8px] font-mono uppercase">Config</span>
                                                ) : isVisible ? (
                                                    <Eye className="h-3.5 w-3.5 text-zinc-200" />
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
                                <span className="text-zinc-200 font-semibold">
                                    {Math.round(layers.layerOpacity * 100)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={layers.layerOpacity}
                                onChange={e => onOpacityChange(parseFloat(e.target.value))}
                                className="w-full accent-zinc-200 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                            />
                        </div>
                    </div>
                )}
            </div>
        </MapOverlayCard>
    );
}
