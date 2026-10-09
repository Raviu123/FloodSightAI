"use client";

import { FloodMap } from "@/components/map/FloodMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REGION_PRESETS } from "@/data/coastal-map-data";
import { API_V1_URL } from "@/lib/api";
import {
    AlertTriangle,
    ArrowRightLeft,
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
                if (item && typeof item === "object" && "msg" in item) return String(item.msg);
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
        }, 800);
        return () => window.clearInterval(timer);
    }, [isPlaying, simulationResult]);

    // Apply preset configuration
    const applyPreset = (preset: any) => {
        if (!preset?.config) return;
        const cfg = preset.config;
        setRainfallIntensity(cfg.rainfall_intensity_mm_h || 75);
        setRainfallDuration(cfg.rainfall_duration_hours || 6);
        setSoilSaturation(cfg.soil_saturation_index || 0.75);
        setCoastalSurge(cfg.coastal_surge_stage_m || 0);
        setRiverInflow(cfg.river_inflow_m3_s || 0);
        setTotalDuration(cfg.total_duration_hours || 12);
    };

    // Execute 2D Hydrodynamic Simulation
    const handleRunSimulation = async () => {
        if (!isRegionValid) {
            setSimulationError("Hotspot Region Selection Required: Select an official flood hotspot before running.");
            return;
        }

        setIsSimulating(true);
        setSimulationError(null);
        setComparisonResult(null);

        const scenarioPayload = {
            scenario_id: `scen_${selectedRegionId}_${rainfallIntensity}mm_${rainfallDuration}h`,
            name: `${activePresetRegion?.name || selectedRegionId} Hydro Run (${rainfallIntensity}mm/h)`,
            description: `${rainfallIntensity} mm/h for ${rainfallDuration}h with ${(soilSaturation * 100).toFixed(0)}% soil saturation`,
            spatial_domain: selectedRegionId,
            rainfall_intensity_mm_h: rainfallIntensity,
            rainfall_duration_hours: rainfallDuration,
            soil_saturation_index: soilSaturation,
            coastal_surge_stage_m: coastalSurge,
            river_inflow_m3_s: riverInflow,
            time_step_minutes: 15.0,
            total_duration_hours: totalDuration,
            hypothetical_disclaimer:
                "Hypothetical 2D hydrodynamic simulation output for planning and sensitivity analysis.",
        };

        try {
            const res = await fetch(`${API_V1_URL}/simulation/scenarios/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(scenarioPayload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ detail: "Simulation request failed" }));
                throw new Error(formatSimulationError(errData, res.status));
            }

            const data: ScenarioRunResultData = await res.json();
            setSimulationResult(data);
            setTimelineIndex(0);
            setIsPlaying(false);
        } catch (err: any) {
            console.error("Simulation error:", err);
            setSimulationError(err.message || "Failed to execute hydrodynamic simulation.");
        } finally {
            setIsSimulating(false);
        }
    };

    // Compare Baseline Simulation with a Counterfactual Run/Preset
    const handleCompareScenario = async (compPreset: any) => {
        if (!simulationResult) {
            setSimulationError("Run a baseline simulation first before comparing scenarios.");
            return;
        }
        if (!compPreset?.config) return;

        setIsSimulating(true);
        setSimulationError(null);

        const compConfig = {
            ...compPreset.config,
            spatial_domain: selectedRegionId,
            scenario_id: `scen_comp_${selectedRegionId}_${compPreset.preset_id}`,
        };

        try {
            // First run comparison scenario to ensure run exists in backend DB
            const compRunRes = await fetch(`${API_V1_URL}/simulation/scenarios/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(compConfig),
            });
            if (!compRunRes.ok) throw new Error("Failed to execute comparison scenario run.");
            const compRunData: ScenarioRunResultData = await compRunRes.json();

            // Compare baseline with comparison run
            const cmpRes = await fetch(`${API_V1_URL}/simulation/scenarios/compare`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseline_run_id: simulationResult.run_id,
                    comparison_run_id: compRunData.run_id,
                }),
            });
            if (!cmpRes.ok) throw new Error("Failed to compute scenario comparison deltas.");
            const cmpData: ScenarioComparisonResultData = await cmpRes.json();

            setComparisonResult(cmpData);
            setComparisonMode(true);
        } catch (err: any) {
            setSimulationError(err.message || "Failed to compare scenarios.");
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
                        v2.0 2D-Storage-Cell
                    </Badge>
                </div>

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
                                <span
                                    className={`h-2 w-2 rounded-full ${isRegionValid ? "bg-emerald-400 animate-pulse" : "bg-amber-500"}`}
                                />
                                <span className="text-[10px] font-mono text-zinc-400 font-medium">
                                    {isRegionValid ? "HOTSPOT ACTIVE" : "GATE LOCKED"}
                                </span>
                            </div>
                        </CardHeader>

                        {/* Control Sections */}
                        <CardContent className="p-0 divide-y divide-zinc-800/60">
                            {/* Section 1: Mandatory Hotspot Selector */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("region")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-rose-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Hotspot Domain <span className="text-rose-400">*</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 border border-sky-850 px-1.5 py-0.5 rounded font-semibold uppercase">
                                            {activePresetRegion?.name.split(" ")[0] || "Select"}
                                        </span>
                                        {openSections.region ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </div>
                                </button>

                                {openSections.region && (
                                    <div className="px-3 py-2.5 bg-zinc-950/50 border-t border-zinc-800/60 space-y-2 font-mono">
                                        <label className="text-[10px] text-zinc-400 block uppercase tracking-wider">
                                            Select Flood Hotspot Region (Required):
                                        </label>
                                        <select
                                            value={selectedRegionId}
                                            onChange={e => setSelectedRegionId(e.target.value)}
                                            className="w-full h-8 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 outline-none focus:border-sky-500 cursor-pointer font-mono"
                                        >
                                            <option value="" disabled>
                                                -- Select Official Flood Hotspot --
                                            </option>
                                            {HOTSPOT_REGIONS.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name} ({r.state}) [{r.code}]
                                                </option>
                                            ))}
                                        </select>
                                        {activePresetRegion && (
                                            <div className="text-[10px] text-zinc-400 pt-0.5 flex justify-between">
                                                <span>Lat: {activePresetRegion.latitude.toFixed(2)}N</span>
                                                <span>Lon: {activePresetRegion.longitude.toFixed(2)}E</span>
                                                <span className="text-emerald-400 font-semibold">MERIT 90m Ready</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Scenario Parameters */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("environmental")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sliders className="h-3.5 w-3.5 text-sky-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Scenario Drivers
                                        </span>
                                    </div>
                                    {openSections.environmental ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                    )}
                                </button>

                                {openSections.environmental && (
                                    <div className="px-3 py-2.5 space-y-2.5 bg-zinc-950/50 border-t border-zinc-800/60 font-mono">
                                        {/* Rainfall Intensity */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <CloudRain className="h-3.5 w-3.5 text-blue-400" /> Rain Rate
                                                </span>
                                                <span className="font-bold text-sky-400">{rainfallIntensity} mm/h</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="250"
                                                step="5"
                                                value={rainfallIntensity}
                                                onChange={e => setRainfallIntensity(parseFloat(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                        </div>

                                        {/* Rainfall Duration */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5 text-purple-400" /> Duration
                                                </span>
                                                <span className="font-bold text-purple-400">{rainfallDuration}h</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="24"
                                                step="1"
                                                value={rainfallDuration}
                                                onChange={e => setRainfallDuration(parseFloat(e.target.value))}
                                                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                        </div>

                                        {/* Soil Saturation Index (SCS CN) */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <Droplets className="h-3.5 w-3.5 text-amber-400" /> Soil Saturation
                                                </span>
                                                <span className="font-bold text-amber-400">
                                                    {(soilSaturation * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.10"
                                                max="0.95"
                                                step="0.05"
                                                value={soilSaturation}
                                                onChange={e => setSoilSaturation(parseFloat(e.target.value))}
                                                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                        </div>

                                        {/* Coastal Storm Surge Stage */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <Waves className="h-3.5 w-3.5 text-cyan-400" /> Coastal Surge Stage
                                                </span>
                                                <span className="font-bold text-cyan-400">
                                                    +{coastalSurge.toFixed(1)}m
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.0"
                                                max="5.0"
                                                step="0.2"
                                                value={coastalSurge}
                                                onChange={e => setCoastalSurge(parseFloat(e.target.value))}
                                                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 3: Preset Scenario Families */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("presets")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Preset Families
                                        </span>
                                    </div>
                                    {openSections.presets ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                    )}
                                </button>

                                {openSections.presets && (
                                    <div className="p-2.5 grid grid-cols-1 gap-2 bg-zinc-950/50 border-t border-zinc-800/60 font-mono">
                                        {presetFamilies.map(p => (
                                            <div
                                                key={p.preset_id}
                                                className="p-2 rounded-xl border border-zinc-800/70 bg-zinc-900/60 hover:border-zinc-700 text-left transition-all space-y-1"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-zinc-200 truncate">
                                                        {p.title}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400"
                                                    >
                                                        {p.category}
                                                    </Badge>
                                                </div>
                                                <p className="text-[10px] text-zinc-400 leading-tight">
                                                    {p.description}
                                                </p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <button
                                                        onClick={() => applyPreset(p)}
                                                        className="px-2 py-0.5 rounded text-[10px] bg-sky-950 border border-sky-800/60 text-sky-300 hover:bg-sky-900 cursor-pointer"
                                                    >
                                                        Load Driver
                                                    </button>
                                                    {simulationResult && (
                                                        <button
                                                            onClick={() => handleCompareScenario(p)}
                                                            className="px-2 py-0.5 rounded text-[10px] bg-purple-950 border border-purple-800/60 text-purple-300 hover:bg-purple-900 cursor-pointer flex items-center gap-1"
                                                        >
                                                            <ArrowRightLeft className="h-2.5 w-2.5" /> Compare Delta
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section 4: Hydro Telemetry & Mass Conservation */}
                            {simulationResult && (
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("metrics")}
                                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Database className="h-3.5 w-3.5 text-cyan-400" />
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
                                            <div className="p-2 rounded border border-zinc-800 bg-zinc-900/60 text-[10px] text-zinc-400 space-y-1">
                                                <div className="flex items-center gap-1 font-semibold text-zinc-300">
                                                    <Info className="h-3 w-3 text-sky-400" /> Provenance Notice
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
        </div>
    );
}
