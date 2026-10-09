"use client";

import { FloodMap } from "@/components/map/FloodMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiCopilotPanel } from "@/components/chat/AiCopilotPanel";
import { REGION_PRESETS } from "@/data/coastal-map-data";
import { API_V1_URL } from "@/lib/api";
import {
    AlertTriangle,
    ArrowRightLeft,
    Bot,
    ChevronDown,
    ChevronUp,
    Clock,
    CloudRain,
    Database,
    Droplets,
    Info,
    Loader2,
    MapPin,
    Pause,
    Play,
    RotateCcw,
    Sliders,
    SlidersHorizontal,
    Sparkles,
    Waves,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// Filter valid hotspots (excluding India nationwide entry)
const HOTSPOT_REGIONS = REGION_PRESETS.filter(r => r.id !== "india");
const VALID_HOTSPOT_IDS = HOTSPOT_REGIONS.map(r => r.id);

interface ScenarioRunResultData {
    run_id: string;
    scenario_config: any;
    model_version: string;
    executed_at: string;
    execution_duration_ms: number;
    mass_balance_error_pct: number;
    total_rainfall_volume_m3: number;
    total_runoff_volume_m3: number;
    total_infiltrated_volume_m3: number;
    inundated_area_sq_km: number;
    max_water_depth_m: number;
    mean_water_depth_m: number;
    affected_population: number;
    zone_summaries: any[];
    geojson_output: any;
    timeline: Array<{
        time_minutes: number;
        inundated_area_sq_km: number;
        max_water_depth_m: number;
        geojson_output: any;
    }>;
}

interface ScenarioComparisonResultData {
    comparison_id: string;
    baseline_run_id: string;
    comparison_run_id: string;
    spatial_domain: string;
    delta_inundated_area_sq_km: number;
    delta_max_depth_m: number;
    delta_affected_population: number;
    parameter_differences: Record<string, any>;
    geojson_delta_output: any;
}

function formatSimulationError(payload: unknown, status: number): string {
    if (!payload || typeof payload !== "object") {
        return `Simulation failed with status ${status}`;
    }

    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const messages = detail
            .map(item => {
                if (typeof item === "string") return item;
                if (item && typeof item === "object") {
                    const loc = Array.isArray(item.loc)
                        ? item.loc.filter((x: any) => x !== "body").join(".")
                        : "";
                    const msg = item.msg || "Invalid value";
                    return loc ? `${msg} (${loc})` : String(msg);
                }
                return JSON.stringify(item);
            })
            .filter(Boolean);
        if (messages.length) return messages.join("; ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return `Simulation failed with status ${status}`;
}

export default function SimulationPage() {
    // Hotspot Selection State (Mandatory Gate)
    const [selectedRegionId, setSelectedRegionId] = useState<string>("mumbai");

    // Scenario Parameters State
    const [rainfallIntensity, setRainfallIntensity] = useState<number>(75);
    const [rainfallDuration, setRainfallDuration] = useState<number>(6);
    const [soilSaturation, setSoilSaturation] = useState<number>(0.75);
    const [coastalSurge, setCoastalSurge] = useState<number>(1.5);
    const [riverInflow, setRiverInflow] = useState<number>(0);
    const [totalDuration, setTotalDuration] = useState<number>(12);

    // Simulation Execution & Telemetry State
    const [isSimulating, setIsSimulating] = useState<boolean>(false);
    const [simulationResult, setSimulationResult] = useState<ScenarioRunResultData | null>(null);
    const [comparisonResult, setComparisonResult] = useState<ScenarioComparisonResultData | null>(null);
    const [simulationError, setSimulationError] = useState<string | null>(null);

    // Preset Families State
    const [presetFamilies, setPresetFamilies] = useState<any[]>([]);
    const [comparisonMode, setComparisonMode] = useState<boolean>(false);
    const [timelineIndex, setTimelineIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    // Collapsible Console Sections State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        region: true,
        environmental: true,
        presets: true,
        metrics: true,
        comparison: false,
    });

    const isRegionValid = Boolean(selectedRegionId && VALID_HOTSPOT_IDS.includes(selectedRegionId));
    const activePresetRegion = HOTSPOT_REGIONS.find(r => r.id === selectedRegionId);

    const toggleSection = (sectionKey: string) => {
        setOpenSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
    };

    // Load preset families when selected hotspot region changes
    const fetchPresetFamilies = useCallback(async (domainId: string) => {
        try {
            const res = await fetch(`${API_V1_URL}/simulation/scenarios/preset-families?domain=${domainId}`);
            if (res.ok) {
                const data = await res.json();
                setPresetFamilies(data);
            }
        } catch {
            setPresetFamilies([]);
        }
    }, []);

    useEffect(() => {
        if (isRegionValid) {
            fetchPresetFamilies(selectedRegionId);
        }
    }, [selectedRegionId, isRegionValid, fetchPresetFamilies]);

    useEffect(() => {
        if (!isPlaying || !simulationResult?.timeline?.length) return;
        const timer = window.setInterval(() => {
            setTimelineIndex(current => {
                const next = current + 1;
                if (next >= simulationResult.timeline.length) {
                    setIsPlaying(false);
                    return 0;
                }
                return next;
            });
        }, 1200);

        return () => window.clearInterval(timer);
    }, [isPlaying, simulationResult]);

    // Handle single scenario execution
    const handleRunSimulation = async () => {
        if (!isRegionValid) {
            setSimulationError("Please select an official hotspot region before executing simulation.");
            return;
        }

        setIsSimulating(true);
        setSimulationError(null);
        setComparisonResult(null);

        const payload = {
            scenario_id: `scen_${selectedRegionId}_${Date.now()}`,
            name: `Manual Run: ${activePresetRegion?.name ?? selectedRegionId}`,
            spatial_domain: selectedRegionId,
            rainfall_intensity_mm_h: rainfallIntensity,
            rainfall_duration_hours: rainfallDuration,
            soil_saturation_index: soilSaturation,
            coastal_surge_stage_m: coastalSurge,
            river_inflow_m3_s: riverInflow,
            total_duration_hours: totalDuration,
            time_step_minutes: 15,
        };

        try {
            const res = await fetch(`${API_V1_URL}/simulation/scenarios/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(formatSimulationError(errData, res.status));
            }

            const data = await res.json();
            setSimulationResult(data);
            setTimelineIndex(0);
            setIsPlaying(false);
            setOpenSections(prev => ({ ...prev, metrics: true }));
        } catch (err: any) {
            setSimulationError(err.message || "Failed to execute simulation. Backend may be offline.");
        } finally {
            setIsSimulating(false);
        }
    };

    // Apply preset scenario configuration
    const handleApplyPreset = (config: any) => {
        if (!config) return;
        if (config.rainfall_intensity_mm_h !== undefined) {
            setRainfallIntensity(config.rainfall_intensity_mm_h);
        } else if (config.rainfall_intensity_mm_per_hr !== undefined) {
            setRainfallIntensity(config.rainfall_intensity_mm_per_hr);
        }
        if (config.rainfall_duration_hours !== undefined) {
            setRainfallDuration(config.rainfall_duration_hours);
        }
        if (config.soil_saturation_index !== undefined) {
            setSoilSaturation(config.soil_saturation_index);
        } else if (config.soil_saturation_ratio !== undefined) {
            setSoilSaturation(config.soil_saturation_ratio);
        }
        if (config.coastal_surge_stage_m !== undefined) {
            setCoastalSurge(config.coastal_surge_stage_m);
        } else if (config.coastal_surge_peak_m !== undefined) {
            setCoastalSurge(config.coastal_surge_peak_m);
        }
        if (config.river_inflow_m3_s !== undefined) {
            setRiverInflow(config.river_inflow_m3_s);
        } else if (config.river_inflow_m3_per_sec !== undefined) {
            setRiverInflow(config.river_inflow_m3_per_sec);
        }
        if (config.total_duration_hours !== undefined) {
            setTotalDuration(config.total_duration_hours);
        }
    };

    // Handle Comparative Scenario Execution
    const handleRunComparison = async (baselineScenario: any, comparisonScenario: any) => {
        if (!isRegionValid) {
            setSimulationError("Please select an official hotspot region before executing comparison.");
            return;
        }

        setIsSimulating(true);
        setSimulationError(null);

        const payload = {
            baseline_scenario: baselineScenario,
            comparison_scenario: comparisonScenario,
        };

        try {
            const res = await fetch(`${API_V1_URL}/simulation/scenarios/compare`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(formatSimulationError(errData, res.status));
            }

            const data = await res.json();
            setComparisonResult(data);
            setComparisonMode(true);
            setOpenSections(prev => ({ ...prev, comparison: true, metrics: true }));
        } catch (err: any) {
            setSimulationError(err.message || "Failed to execute scenario comparison.");
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="w-full p-1 sm:p-2 space-y-3 font-sans">
            {/* Simulation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/60 pb-2.5 px-1">
                <div className="flex items-center gap-2.5">
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 font-mono uppercase">
                        <Waves className="h-5 w-5 text-sky-400" />
                        2D Hydrodynamic Flood Simulation Engine
                    </h1>
                    <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-sky-800/60 text-sky-300 bg-sky-950/40"
                    >
                        v2.1 2D-Storage-Cell
                    </Badge>
                </div>

                {/* Top Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setRainfallIntensity(75);
                            setRainfallDuration(6);
                            setSoilSaturation(0.75);
                            setCoastalSurge(1.5);
                            setRiverInflow(0);
                            setTotalDuration(12);
                            setSimulationResult(null);
                            setComparisonResult(null);
                            setSimulationError(null);
                            setTimelineIndex(0);
                            setIsPlaying(false);
                        }}
                        className="font-mono text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCopilotOpen(true)}
                        className="font-mono text-xs gap-1.5 h-8 border-cyan-800/80 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 shadow-sm cursor-pointer"
                    >
                        <Bot className="h-3.5 w-3.5 text-cyan-400" />
                        AI Copilot
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!isRegionValid || isSimulating}
                        onClick={handleRunSimulation}
                        className={`font-mono text-xs gap-1.5 h-8 px-4 font-semibold shadow-md transition-all cursor-pointer ${
                            !isRegionValid
                                ? "bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed"
                                : isSimulating
                                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                                  : "bg-sky-600 hover:bg-sky-500 text-white"
                        }`}
                    >
                        {isSimulating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="h-3.5 w-3.5" />
                        )}
                        {isSimulating ? "Simulating..." : "Run 2D Simulation"}
                    </Button>
                </div>
            </div>

            {/* Mandatory Hotspot Region Warning Gate Banner */}
            {!isRegionValid && (
                <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-3 text-amber-200 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>
                            <strong>HOTSPOT REGION SELECTION REQUIRED:</strong> Select an official flood hotspot (e.g.
                            Mumbai, Patna, Kochi, Kolkata) to initialize high-resolution terrain rasters before running
                            simulation.
                        </span>
                    </div>
                </div>
            )}

            {/* Simulation Error Alert Banner */}
            {simulationError && (
                <div className="rounded-xl border border-rose-800/80 bg-rose-950/40 p-3 text-rose-200 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                        <span>{simulationError}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSimulationError(null)}
                        className="text-rose-400 hover:text-white"
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Maplibre Map Container */}
                <div className="lg:col-span-8 xl:col-span-9">
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-1 shadow-inner overflow-hidden relative">
                        <FloodMap
                            tideLevel={coastalSurge}
                            rainfall={rainfallIntensity}
                            heightClassName="h-[calc(100vh-11.5rem)] min-h-[620px]"
                            activeRegionId={selectedRegionId}
                            onRegionChange={(rId: string) => setSelectedRegionId(rId)}
                            simulationGeoJson={
                                comparisonMode && comparisonResult
                                    ? null
                                    : (simulationResult?.timeline?.[timelineIndex]?.geojson_output ??
                                      simulationResult?.geojson_output)
                            }
                            comparisonGeoJson={comparisonMode ? comparisonResult?.geojson_delta_output : null}
                        />
                    </div>
                </div>

                {/* Sidebar Controls Console */}
                <div className="lg:col-span-4 xl:col-span-3">
                    <Card className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-sm overflow-hidden">
                        {/* Console Header */}
                        <CardHeader className="py-2.5 px-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-sky-400" />
                                <CardTitle className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
                                    Simulation Console
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                                <span className="text-[10px] font-mono text-zinc-400 uppercase">2D Storage Cell</span>
                            </div>
                        </CardHeader>

                        <CardContent className="p-3 space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar">
                            {/* SECTION 1: Regional Focus & Hotspot Gate */}
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleSection("region")}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/90 hover:bg-zinc-850/80 text-left transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-sky-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Hotspot Domain Focus
                                        </span>
                                    </div>
                                    {openSections.region ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                    )}
                                </button>

                                {openSections.region && (
                                    <div className="p-3 space-y-2 border-t border-zinc-800/60 font-mono text-xs">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-zinc-400 uppercase font-semibold">
                                                Selected Hotspot
                                            </label>
                                            <select
                                                value={selectedRegionId}
                                                onChange={e => setSelectedRegionId(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                                            >
                                                {HOTSPOT_REGIONS.map(region => (
                                                    <option key={region.id} value={region.id}>
                                                        {region.name} ({region.state})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {activePresetRegion && (
                                            <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800 text-[10px] text-zinc-400 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Center:</span>
                                                    <span className="text-zinc-300">
                                                        {activePresetRegion.latitude.toFixed(3)}°N,{" "}
                                                        {activePresetRegion.longitude.toFixed(3)}°E
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Hydro Focus:</span>
                                                    <span className="text-sky-400 capitalize">
                                                        {activePresetRegion.id} Coastal & Riverine Cell
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: Preset Scenario Families & Comparison */}
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleSection("presets")}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/90 hover:bg-zinc-850/80 text-left transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Preset Scenario Families
                                        </span>
                                    </div>
                                    {openSections.presets ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                    )}
                                </button>

                                {openSections.presets && (
                                    <div className="p-3 space-y-2 border-t border-zinc-800/60 font-mono text-xs">
                                        {presetFamilies.length === 0 ? (
                                            <div className="text-[11px] text-zinc-500 italic text-center py-2">
                                                No preset families loaded for this domain.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {presetFamilies.map((preset: any, idx: number) => {
                                                    const cfg = preset.config || preset;
                                                    const rain =
                                                        cfg.rainfall_intensity_mm_h ??
                                                        cfg.rainfall_intensity_mm_per_hr ??
                                                        0;
                                                    const surge =
                                                        cfg.coastal_surge_stage_m ??
                                                        cfg.coastal_surge_peak_m ??
                                                        0;
                                                    const sat = Math.round(
                                                        (cfg.soil_saturation_index ??
                                                            cfg.soil_saturation_ratio ??
                                                            0.75) * 100,
                                                    );

                                                    return (
                                                        <div
                                                            key={preset.preset_id || preset.scenario_id || idx}
                                                            className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5 hover:border-zinc-700 transition-colors"
                                                        >
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-[11px] font-bold text-amber-300 truncate">
                                                                    {preset.title || preset.name || "Preset Scenario"}
                                                                </span>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                                                                    {preset.category || "Scenario"}
                                                                </span>
                                                            </div>

                                                            {preset.description && (
                                                                <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                                                                    {preset.description}
                                                                </p>
                                                            )}

                                                            <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-1 border-t border-zinc-900">
                                                                <span>
                                                                    Rain: <b className="text-sky-400">{rain} mm/h</b> | Surge: <b className="text-teal-400">{surge}m</b> | Soil: <b className="text-amber-400">{sat}%</b>
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    onClick={() => handleApplyPreset(cfg)}
                                                                    className="h-5 px-2 text-[9px] font-mono text-sky-400 hover:text-sky-300 hover:bg-sky-950/50 cursor-pointer"
                                                                >
                                                                    Apply
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {presetFamilies.length >= 2 && (
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() =>
                                                            handleRunComparison(
                                                                presetFamilies[0].config || presetFamilies[0],
                                                                presetFamilies[1].config || presetFamilies[1],
                                                            )
                                                        }
                                                        className="w-full h-7 text-[10px] font-mono text-amber-400 border-amber-900/50 bg-amber-950/20 hover:bg-amber-950/40 gap-1.5 cursor-pointer mt-2"
                                                    >
                                                        <ArrowRightLeft className="h-3 w-3" />
                                                        Compare Baseline vs Extreme
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: Environmental & Hydrodynamic Parameters */}
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleSection("environmental")}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/90 hover:bg-zinc-850/80 text-left transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sliders className="h-3.5 w-3.5 text-blue-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Hydrodynamic Drivers
                                        </span>
                                    </div>
                                    {openSections.environmental ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                    )}
                                </button>

                                {openSections.environmental && (
                                    <div className="p-3 space-y-3 border-t border-zinc-800/60 font-mono text-xs">
                                        {/* Rainfall Intensity Slider */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-zinc-400 flex items-center gap-1">
                                                    <CloudRain className="h-3 w-3 text-sky-400" />
                                                    Rainfall Intensity
                                                </span>
                                                <span className="text-sky-300 font-bold">
                                                    {rainfallIntensity} mm/hr
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="250"
                                                step="5"
                                                value={rainfallIntensity}
                                                onChange={e => setRainfallIntensity(Number(e.target.value))}
                                                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                            />
                                        </div>

                                        {/* Rainfall Duration Slider */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-zinc-400 flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-sky-400" />
                                                    Precipitation Duration
                                                </span>
                                                <span className="text-zinc-200 font-bold">{rainfallDuration} hrs</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="24"
                                                step="1"
                                                value={rainfallDuration}
                                                onChange={e => setRainfallDuration(Number(e.target.value))}
                                                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                            />
                                        </div>

                                        {/* Coastal Surge Peak Slider */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-zinc-400 flex items-center gap-1">
                                                    <Waves className="h-3 w-3 text-teal-400" />
                                                    Coastal Surge Peak
                                                </span>
                                                <span className="text-teal-300 font-bold">{coastalSurge} m</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="6"
                                                step="0.1"
                                                value={coastalSurge}
                                                onChange={e => setCoastalSurge(Number(e.target.value))}
                                                className="w-full accent-teal-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                            />
                                        </div>

                                        {/* Soil Saturation Slider */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-zinc-400 flex items-center gap-1">
                                                    <Droplets className="h-3 w-3 text-amber-400" />
                                                    Soil Saturation
                                                </span>
                                                <span className="text-amber-300 font-bold">
                                                    {Math.round(soilSaturation * 100)}%
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.1"
                                                max="1.0"
                                                step="0.05"
                                                value={soilSaturation}
                                                onChange={e => setSoilSaturation(Number(e.target.value))}
                                                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                            />
                                        </div>

                                        {/* Total Duration Slider */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-zinc-400 flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-zinc-400" />
                                                    Simulation Horizon
                                                </span>
                                                <span className="text-zinc-300 font-bold">{totalDuration} hrs</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="48"
                                                step="1"
                                                value={totalDuration}
                                                onChange={e => setTotalDuration(Number(e.target.value))}
                                                className="w-full accent-zinc-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 4: Comparative Analytics Result (When Comparison Active) */}
                            {comparisonResult && (
                                <div className="rounded-xl border border-amber-800/80 bg-amber-950/20 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("comparison")}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-amber-950/40 hover:bg-amber-950/60 text-left transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ArrowRightLeft className="h-3.5 w-3.5 text-amber-400" />
                                            <span className="text-xs font-mono font-medium text-amber-200">
                                                Comparative Delta Analytics
                                            </span>
                                        </div>
                                        {openSections.comparison ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
                                        )}
                                    </button>

                                    {openSections.comparison && (
                                        <div className="p-3 space-y-2 font-mono text-xs border-t border-amber-900/50">
                                            <div className="flex justify-between items-center text-zinc-300">
                                                <span>Delta Inundated Area:</span>
                                                <span
                                                    className={`font-bold ${
                                                        comparisonResult.delta_inundated_area_sq_km >= 0
                                                            ? "text-rose-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {comparisonResult.delta_inundated_area_sq_km > 0 ? "+" : ""}
                                                    {comparisonResult.delta_inundated_area_sq_km} km²
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-zinc-300">
                                                <span>Delta Max Depth:</span>
                                                <span
                                                    className={`font-bold ${
                                                        comparisonResult.delta_max_depth_m >= 0
                                                            ? "text-rose-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {comparisonResult.delta_max_depth_m > 0 ? "+" : ""}
                                                    {comparisonResult.delta_max_depth_m}m
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-zinc-300">
                                                <span>Delta Pop. at Risk:</span>
                                                <span
                                                    className={`font-bold ${
                                                        comparisonResult.delta_affected_population >= 0
                                                            ? "text-rose-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {comparisonResult.delta_affected_population > 0 ? "+" : ""}
                                                    {comparisonResult.delta_affected_population.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION 5: Real-time Telemetry & Mass Balance Results */}
                            {simulationResult && (
                                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("metrics")}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/90 hover:bg-zinc-850/80 text-left transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Database className="h-3.5 w-3.5 text-emerald-400" />
                                            <span className="text-xs font-mono font-medium text-zinc-200">
                                                2D Hydro Telemetry
                                            </span>
                                        </div>
                                        {openSections.metrics ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </button>

                                    {openSections.metrics && (
                                        <div className="px-3 py-2.5 space-y-2 bg-zinc-950/50 border-t border-zinc-800/60 font-mono text-xs">
                                            <div className="flex justify-between items-center text-zinc-400">
                                                <span>Mass Conservation Error:</span>
                                                <span className="font-bold text-emerald-400">
                                                    {simulationResult.mass_balance_error_pct}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-zinc-400">
                                                <span>Inundated Area:</span>
                                                <span className="font-bold text-white">
                                                    {simulationResult.inundated_area_sq_km} km²
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-zinc-400">
                                                <span>Max Water Depth:</span>
                                                <span className="font-bold text-sky-400">
                                                    {simulationResult.max_water_depth_m}m
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-zinc-400">
                                                <span>Population at Risk:</span>
                                                <span className="font-bold text-amber-400">
                                                    {simulationResult.affected_population.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-zinc-400">
                                                <span>Execution Latency:</span>
                                                <span className="font-bold text-zinc-300">
                                                    {simulationResult.execution_duration_ms} ms
                                                </span>
                                            </div>

                                            {/* Disclaimers Notice */}
                                            <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 text-[9px] text-zinc-500 space-y-0.5">
                                                <div className="flex items-center gap-1 text-zinc-400 font-semibold">
                                                    <Info className="h-2.5 w-2.5" /> Model Notice
                                                </div>
                                                <p>{simulationResult.scenario_config.hypothetical_disclaimer}</p>
                                            </div>

                                            {simulationResult.timeline?.length > 0 && (
                                                <div className="border-t border-zinc-800 pt-2 space-y-2">
                                                    <div className="flex items-center justify-between text-zinc-400">
                                                        <span>Simulation Playback</span>
                                                        <span className="text-sky-400">
                                                            {Math.round(
                                                                simulationResult.timeline[timelineIndex]
                                                                    ?.time_minutes ?? 0,
                                                            )}{" "}
                                                            min
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={simulationResult.timeline.length - 1}
                                                        step="1"
                                                        value={timelineIndex}
                                                        onChange={event => {
                                                            setIsPlaying(false);
                                                            setTimelineIndex(Number(event.target.value));
                                                        }}
                                                        className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                                        aria-label="Simulation time"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsPlaying(value => !value)}
                                                        className="h-7 w-full gap-1.5 text-[10px] border-zinc-700 bg-zinc-900 text-zinc-200"
                                                    >
                                                        {isPlaying ? (
                                                            <Pause className="h-3 w-3" />
                                                        ) : (
                                                            <Play className="h-3 w-3" />
                                                        )}
                                                        {isPlaying ? "Pause" : "Play timeline"}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* AI Copilot Drawer */}
            <AiCopilotPanel
                isOpen={isCopilotOpen}
                onClose={() => setIsCopilotOpen(false)}
                activeZoneId={selectedRegionId}
            />
        </div>
    );
}
