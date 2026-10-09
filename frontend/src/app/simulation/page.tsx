"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FloodMap } from "@/components/map/FloodMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Activity,
    AlertOctagon,
    AlertTriangle,
    ArrowRight,
    Bot,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    CloudRain,
    FastForward,
    Gauge,
    Info,
    Layers,
    MapPin,
    Navigation,
    Pause,
    Play,
    Radio,
    RefreshCw,
    RotateCcw,
    Send,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Sliders,
    SlidersHorizontal,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Users,
    Waves,
    Zap,
} from "lucide-react";
import {
    checkBackendHealth,
    runSimulation,
    fetch24hTimeline,
    fetchWhatIfAnalysis,
    broadcastAlert,
} from "@/lib/api";
import { AiCopilotPanel } from "@/components/chat/AiCopilotPanel";
import { REGION_PRESETS, type RegionPreset } from "@/data/coastal-map-data";
import type {
    SimulationInput,
    SimulationResponse,
    EnhancedZoneResult,
    Timeline24hResponse,
    TimelineHourStep,
    WhatIfResponse,
    ThreatLevel,
} from "@/types";

interface ScenarioPreset {
    name: string;
    tide: number;
    rain: number;
    hours: number;
    cyclone?: boolean;
    description: string;
}

const SCENARIOS: ScenarioPreset[] = [
    { name: "Monsoon Inflow Peak", tide: 3.2, rain: 95, hours: 6, cyclone: false, description: "Heavy monsoon with estuarine channel backing" },
    { name: "Spring Tide Surge", tide: 4.5, rain: 35, hours: 8, cyclone: false, description: "Astronomical syzygy tide at full moon" },
    { name: "Cyclone Inundation", tide: 5.2, rain: 150, hours: 12, cyclone: true, description: "Severe cyclonic storm surge and cloudburst" },
    { name: "River Basin Cloudburst", tide: 0.0, rain: 180, hours: 8, cyclone: false, description: "Extreme riverine catchment precipitation" },
];

export default function SimulationPage() {
    // Active Regional Hotspot Focus
    const [activeRegionId, setActiveRegionId] = useState<string>("mangalore");

    // Environmental Simulation Parameters
    const [tideLevel, setTideLevel] = useState<number>(2.8);
    const [rainfall, setRainfall] = useState<number>(75);
    const [forecastHours, setForecastHours] = useState<number>(6);
    const [cycloneActive, setCycloneActive] = useState<boolean>(false);
    const [soilSaturation, setSoilSaturation] = useState<number>(0.75);
    const [riverDischarge, setRiverDischarge] = useState<number>(350);

    // Backend Connection & Engine State
    const [backendOnline, setBackendOnline] = useState<boolean>(false);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<"simulation" | "timeline" | "whatif">("simulation");

    // Simulation Data Payloads
    const [simulationResult, setSimulationResult] = useState<SimulationResponse | null>(null);
    const [timelineData, setTimelineData] = useState<Timeline24hResponse | null>(null);
    const [selectedZone, setSelectedZone] = useState<EnhancedZoneResult | null>(null);
    const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

    // 24h Timeline Playback Controls
    const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
    const [currentHourIndex, setCurrentHourIndex] = useState<number>(0);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // ms per step
    const playTimerRef = useRef<NodeJS.Timeout | null>(null);

    // What-If Sensitivity Inputs & Results
    const [whatIfTideDelta, setWhatIfTideDelta] = useState<number>(0.5);
    const [whatIfRainDeltaPct, setWhatIfRainDeltaPct] = useState<number>(30);
    const [whatIfDrainagePct, setWhatIfDrainagePct] = useState<number>(20);
    const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);
    const [isCalculatingWhatIf, setIsCalculatingWhatIf] = useState<boolean>(false);

    // Localized Sector Override State
    const [overrideEnabled, setOverrideEnabled] = useState<boolean>(false);
    const [overrideZoneId, setOverrideZoneId] = useState<string>("");
    const [overrideRainfall, setOverrideRainfall] = useState<number>(120);
    const [overrideDrainageBlocked, setOverrideDrainageBlocked] = useState<number>(40);

    // Accordion Sections
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        environmental: true,
        sectorOverride: true,
        scenarios: true,
        timeline: true,
        whatif: true,
        threat: true,
        zone: true,
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Determine whether current region is coastal or inland riverine
    const currentRegionPreset = REGION_PRESETS.find(p => p.id === activeRegionId) || REGION_PRESETS[1];
    const isInlandRiverine = ["guwahati", "patna", "srinagar"].includes(activeRegionId);

    // 1. Initial Health Check & Initial Simulation Inference
    useEffect(() => {
        checkBackendHealth().then(res => {
            setBackendOnline(res.status === "online");
        });
        executeSimulation();
    }, []);

    // 2. Execute Primary ML Simulation
    const executeSimulation = useCallback(
        async (customParams?: Partial<SimulationInput>) => {
            setIsCalculating(true);
            const overrides = [];
            if (overrideEnabled && overrideZoneId) {
                overrides.push({
                    zone_id: overrideZoneId,
                    rainfall_mm_per_hour: overrideRainfall,
                    drainage_blocked_pct: overrideDrainageBlocked,
                });
            }

            const input: SimulationInput = {
                tide_level_meters: isInlandRiverine ? 0.0 : (customParams?.tide_level_meters ?? tideLevel),
                rainfall_mm_per_hour: customParams?.rainfall_mm_per_hour ?? rainfall,
                forecast_hours: customParams?.forecast_hours ?? forecastHours,
                cyclone_active: isInlandRiverine ? false : (customParams?.cyclone_active ?? cycloneActive),
                soil_saturation: customParams?.soil_saturation ?? soilSaturation,
                river_discharge_m3_s: customParams?.river_discharge_m3_s ?? riverDischarge,
                region_id: customParams?.region_id ?? activeRegionId,
                zone_overrides: overrides.length > 0 ? overrides : undefined,
            };

            try {
                const [simRes, timeRes] = await Promise.all([
                    runSimulation(input),
                    fetch24hTimeline(input),
                ]);

                setSimulationResult(simRes);
                setTimelineData(timeRes);

                if (simRes.zones && simRes.zones.length > 0) {
                    setSelectedZone(prev => {
                        if (!prev) return simRes.zones[0];
                        const found = simRes.zones.find(z => z.zone_id === prev.zone_id);
                        return found || simRes.zones[0];
                    });
                }
            } catch (err) {
                console.error("Simulation run failed:", err);
            } finally {
                setIsCalculating(false);
            }
        },
        [tideLevel, rainfall, forecastHours, cycloneActive, soilSaturation, riverDischarge, activeRegionId, isInlandRiverine, overrideEnabled, overrideZoneId, overrideRainfall, overrideDrainageBlocked],
    );

    // 3. Trigger Simulation on Input or Region Change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            executeSimulation();
        }, 300);
        return () => clearTimeout(timer);
    }, [tideLevel, rainfall, forecastHours, cycloneActive, soilSaturation, riverDischarge, activeRegionId, overrideEnabled, overrideZoneId, overrideRainfall, overrideDrainageBlocked, executeSimulation]);

    // 4. Timeline Animation Loop
    useEffect(() => {
        if (isPlayingTimeline && timelineData && timelineData.timeline_steps.length > 0) {
            playTimerRef.current = setInterval(() => {
                setCurrentHourIndex(prev => {
                    const next = prev + 1;
                    if (next >= timelineData.timeline_steps.length) {
                        setIsPlayingTimeline(false);
                        return 0;
                    }
                    return next;
                });
            }, playbackSpeed);
        } else {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        }

        return () => {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        };
    }, [isPlayingTimeline, timelineData, playbackSpeed]);

    // Active Timeline Step for 24h Playback
    const activeStep: TimelineHourStep | null =
        timelineData && timelineData.timeline_steps[currentHourIndex]
            ? timelineData.timeline_steps[currentHourIndex]
            : null;

    const displayTide = activeTab === "timeline" && activeStep ? activeStep.tide_level_meters : tideLevel;
    const displayRain = activeTab === "timeline" && activeStep ? activeStep.rainfall_mm_per_hour : rainfall;

    // Active KPI Values (synced dynamically with active timeline step during playback)
    const activeThreatIndex =
        activeTab === "timeline" && activeStep
            ? Math.min(100, Math.round((activeStep.total_population_at_risk > 0 ? 45 : 15) + (activeStep.tide_level_meters * 12) + (activeStep.rainfall_mm_per_hour * 0.25)))
            : (simulationResult?.threat_index ?? 48);

    const activeThreatLevel =
        activeTab === "timeline" && activeStep
            ? activeStep.overall_risk
            : (simulationResult?.overall_risk ?? "NO_DANGER");

    const activePopAtRisk =
        activeTab === "timeline" && activeStep
            ? activeStep.total_population_at_risk
            : (simulationResult?.total_population_at_risk ?? 0);

    const activeInundatedArea =
        activeTab === "timeline" && activeStep
            ? activeStep.inundated_area_sq_km
            : (simulationResult?.estimated_inundated_area_sq_km ?? 0.0);

    const activeCriticalCount =
        activeTab === "timeline" && activeStep
            ? activeStep.critical_zones_count
            : (simulationResult?.critical_zones_count ?? 0);

    // 5. Run What-If Sensitivity Analysis
    const runWhatIf = async () => {
        setIsCalculatingWhatIf(true);
        try {
            const res = await fetchWhatIfAnalysis({
                base_params: {
                    tide_level_meters: isInlandRiverine ? 0.0 : tideLevel,
                    rainfall_mm_per_hour: rainfall,
                    forecast_hours: forecastHours,
                    cyclone_active: cycloneActive,
                    soil_saturation: soilSaturation,
                    region_id: activeRegionId,
                },
                tide_delta_m: isInlandRiverine ? 0.0 : whatIfTideDelta,
                rain_delta_pct: whatIfRainDeltaPct,
                drainage_clearance_pct: whatIfDrainagePct,
            });
            setWhatIfResult(res);
        } catch (err) {
            console.error("What-If failed:", err);
        } finally {
            setIsCalculatingWhatIf(false);
        }
    };

    useEffect(() => {
        if (activeTab === "whatif") {
            runWhatIf();
        }
    }, [activeTab, whatIfTideDelta, whatIfRainDeltaPct, whatIfDrainagePct]);

    // Preset Applicator
    const applyScenario = (sc: ScenarioPreset) => {
        setTideLevel(sc.tide);
        setRainfall(sc.rain);
        setForecastHours(sc.hours);
        setCycloneActive(Boolean(sc.cyclone));
    };

    const threatBadgeVariant =
        activeThreatLevel === "CRITICAL"
            ? "destructive"
            : activeThreatLevel === "HIGH"
              ? "warning"
              : activeThreatLevel === "MEDIUM"
                ? "default"
                : "success";

    return (
        <div className="w-full p-1 sm:p-2 space-y-3 font-sans">
            {/* Command Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-zinc-800/80 pb-2.5 px-1 bg-zinc-950/60 rounded-xl p-2.5">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-sky-950/70 border border-sky-800/50">
                        <Activity className="h-4 w-4 text-sky-400 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white font-mono uppercase">
                                Coastal & Riverine Simulation Engine
                            </h1>
                            <span
                                className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase border font-semibold ${
                                    backendOnline
                                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-600/40"
                                        : "bg-amber-950/60 text-amber-400 border-amber-600/40"
                                }`}
                            >
                                {backendOnline ? "ML Inundation Live" : "Local Projection Cache"}
                            </span>

                            {/* Hotspot Basin Indicator */}
                            <span
                                className={`text-[9px] font-mono px-2 py-0.5 rounded font-semibold uppercase border ${
                                    isInlandRiverine
                                        ? "bg-purple-950/60 text-purple-300 border-purple-800/50"
                                        : "bg-cyan-950/60 text-cyan-300 border-cyan-800/50"
                                }`}
                            >
                                {isInlandRiverine ? "Inland River Basin (0% Tide)" : "Coastal & Estuarine Basin"}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-mono">
                            Multi-Physics Hydrodynamic & Gradient-Boosted Inundation Solver across 11 Indian Hotspot Hubs
                        </p>
                    </div>
                </div>

                {/* Hotspot Region Quick Selector & Mode Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Hotspot Region Dropdown */}
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 font-mono text-xs text-zinc-300">
                        <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        <select
                            value={activeRegionId}
                            onChange={e => {
                                setActiveRegionId(e.target.value);
                                setCurrentHourIndex(0);
                                setIsPlayingTimeline(false);
                            }}
                            className="bg-transparent text-xs font-mono text-white outline-none cursor-pointer pr-1"
                        >
                            {REGION_PRESETS.map(preset => (
                                <option key={preset.id} value={preset.id} className="bg-zinc-900 text-white">
                                    {preset.name} [{preset.code}]
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex rounded-lg bg-zinc-900/90 p-1 border border-zinc-800 font-mono text-xs">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("simulation");
                                setIsPlayingTimeline(false);
                            }}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                                activeTab === "simulation"
                                    ? "bg-sky-600 text-white font-semibold shadow-xs"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Live Controls
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("timeline")}
                            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                                activeTab === "timeline"
                                    ? "bg-purple-600 text-white font-semibold shadow-xs"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            <Clock className="h-3 w-3" />
                            24h Propagation
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("whatif");
                                setIsPlayingTimeline(false);
                            }}
                            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                                activeTab === "whatif"
                                    ? "bg-amber-600 text-white font-semibold shadow-xs"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            <Zap className="h-3 w-3" />
                            What-If Studio
                        </button>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setTideLevel(1.8);
                            setRainfall(20);
                            setForecastHours(4);
                            setCycloneActive(false);
                            setCurrentHourIndex(0);
                            setIsPlayingTimeline(false);
                        }}
                        className="font-mono text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCopilotOpen(true)}
                        className="font-mono text-xs gap-1.5 h-8 border-cyan-800/80 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 shadow-sm"
                    >
                        <Bot className="h-3.5 w-3.5 text-cyan-400" />
                        AI Copilot
                    </Button>
                </div>
            </div>

            {/* Quick KPI Summary Banner (Live & Dynamic for active hour / inputs) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-zinc-400 uppercase">System Threat Index</div>
                        <div className="text-base font-bold text-white mt-0.5">
                            {activeThreatIndex.toFixed(0)}
                            <span className="text-[10px] text-zinc-500 font-normal"> / 100</span>
                        </div>
                    </div>
                    <Badge variant={threatBadgeVariant} className="text-[9px] px-1.5 py-0.5 uppercase">
                        {activeThreatLevel}
                    </Badge>
                </div>

                <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-zinc-400 uppercase">Population at Risk</div>
                        <div className="text-base font-bold text-rose-400 mt-0.5">
                            {activePopAtRisk.toLocaleString()}
                        </div>
                    </div>
                    <Users className="h-4 w-4 text-rose-500/70" />
                </div>

                <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-zinc-400 uppercase">Inundated Surface</div>
                        <div className="text-base font-bold text-sky-400 mt-0.5">
                            {activeInundatedArea.toFixed(1)}
                            <span className="text-[10px] text-zinc-400 font-normal"> km²</span>
                        </div>
                    </div>
                    <Waves className="h-4 w-4 text-sky-500/70" />
                </div>

                <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-zinc-400 uppercase">Critical Lowlands</div>
                        <div className="text-base font-bold text-amber-400 mt-0.5">
                            {activeCriticalCount}
                            <span className="text-[10px] text-zinc-400 font-normal"> sectors</span>
                        </div>
                    </div>
                    <ShieldAlert className="h-4 w-4 text-amber-500/70" />
                </div>
            </div>

            {/* 24-Hour Timeline Scrubber & Animation Deck */}
            {activeTab === "timeline" && timelineData && (
                <div className="rounded-xl border border-purple-800/40 bg-purple-950/20 p-3 space-y-2 backdrop-blur-md">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                            <span className="font-mono text-xs font-bold text-purple-300 uppercase tracking-wider">
                                24-Hour Propagation Progression
                            </span>
                            <span className="font-mono text-xs px-2 py-0.5 bg-purple-900/60 text-purple-200 border border-purple-700/50 rounded">
                                Hour {activeStep?.hour ?? 1} / 24
                            </span>
                        </div>

                        {/* Player Controls */}
                        <div className="flex items-center gap-2 font-mono">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentHourIndex(Math.max(0, currentHourIndex - 1))}
                                className="h-7 px-2 border-zinc-700 bg-zinc-900 text-xs"
                            >
                                -1h
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                                className={`h-7 px-3 text-xs gap-1 ${
                                    isPlayingTimeline
                                        ? "bg-amber-600 hover:bg-amber-500"
                                        : "bg-purple-600 hover:bg-purple-500"
                                }`}
                            >
                                {isPlayingTimeline ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                {isPlayingTimeline ? "Pause" : "Simulate 24h Run"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    setCurrentHourIndex(
                                        Math.min(timelineData.timeline_steps.length - 1, currentHourIndex + 1),
                                    )
                                }
                                className="h-7 px-2 border-zinc-700 bg-zinc-900 text-xs"
                            >
                                +1h
                            </Button>

                            <select
                                value={playbackSpeed}
                                onChange={e => setPlaybackSpeed(Number(e.target.value))}
                                className="h-7 px-2 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-300 font-mono"
                            >
                                <option value={1500}>0.7x</option>
                                <option value={1000}>1.0x</option>
                                <option value={500}>2.0x</option>
                                <option value={250}>4.0x</option>
                            </select>
                        </div>
                    </div>

                    {/* Timeline Slider */}
                    <div className="space-y-1 pt-1">
                        <input
                            type="range"
                            min="0"
                            max={timelineData.timeline_steps.length - 1}
                            step="1"
                            value={currentHourIndex}
                            onChange={e => {
                                setCurrentHourIndex(Number(e.target.value));
                                setIsPlayingTimeline(false);
                            }}
                            className="w-full accent-purple-500 cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>T+0h (Onset)</span>
                            <span className="text-purple-400 font-bold">
                                Peak Hour: T+{timelineData.peak_hour}h ({timelineData.peak_water_depth_m}m MSL)
                            </span>
                            <span>T+24h (Ebb)</span>
                        </div>
                    </div>

                    {/* Micro telemetry readout for active hour */}
                    {activeStep && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                            <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800 flex justify-between">
                                <span className="text-zinc-400">
                                    {isInlandRiverine ? "River Discharge:" : "Oscillating Tide:"}
                                </span>
                                <span className="font-bold text-sky-400">
                                    {isInlandRiverine
                                        ? `${Math.round(riverDischarge * (1.0 + Math.sin(activeStep.hour / 4) * 0.3))} m³/s`
                                        : `+${activeStep.tide_level_meters}m`}
                                </span>
                            </div>
                            <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800 flex justify-between">
                                <span className="text-zinc-400">Hyetograph Rain:</span>
                                <span className="font-bold text-blue-400">{activeStep.rainfall_mm_per_hour} mm/h</span>
                            </div>
                            <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800 flex justify-between">
                                <span className="text-zinc-400">At-Risk Pop:</span>
                                <span className="font-bold text-rose-400">
                                    {activeStep.total_population_at_risk.toLocaleString()}
                                </span>
                            </div>
                            <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800 flex justify-between">
                                <span className="text-zinc-400">Threat Level:</span>
                                <span className="font-bold text-amber-400">{activeStep.overall_risk}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* 3D Map Visual Engine Container */}
                <div className="lg:col-span-8 xl:col-span-8 space-y-3">
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-1 shadow-inner overflow-hidden relative">
                        {isCalculating && (
                            <div className="absolute top-3 right-3 z-10 bg-zinc-900/90 border border-sky-500/50 px-2.5 py-1 rounded-full text-xs font-mono text-sky-300 flex items-center gap-1.5 backdrop-blur-md shadow-lg">
                                <RefreshCw className="h-3 w-3 animate-spin text-sky-400" />
                                Computing Hydrodynamic Solver...
                            </div>
                        )}
                        <FloodMap
                            tideLevel={displayTide}
                            rainfall={displayRain}
                            heightClassName="h-[calc(100vh-14rem)] min-h-[580px]"
                            onZoneSelect={zone => {
                                if (simulationResult && simulationResult.zones) {
                                    const match = simulationResult.zones.find(
                                        z =>
                                            z.zone_id.toUpperCase() === String(zone.id).toUpperCase() ||
                                            z.zone_name.toLowerCase().includes(String(zone.name).toLowerCase()),
                                    );
                                    if (match) setSelectedZone(match);
                                    else {
                                        setSelectedZone(zone as any);
                                    }
                                }
                            }}
                        />
                    </div>

                    {/* Tactical Directive Recommendation Box */}
                    {simulationResult?.recommendation && (
                        <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md font-mono text-xs flex items-start gap-3">
                            <div className="p-1.5 rounded-lg bg-sky-950 border border-sky-800/60 text-sky-400 shrink-0 mt-0.5">
                                <Navigation className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-[10px] uppercase font-bold text-zinc-400">
                                    Incident Command Tactical Directive ({currentRegionPreset.name})
                                </div>
                                <div className="text-zinc-200 text-xs leading-relaxed">
                                    {simulationResult.recommendation}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Control Console & Inspector */}
                <div className="lg:col-span-4 xl:col-span-4 space-y-3">
                    {/* Mode 1: Standard Simulation Sliders */}
                    {activeTab === "simulation" && (
                        <Card className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-sm overflow-hidden">
                            <CardHeader className="py-2.5 px-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-4 w-4 text-sky-400" />
                                    <CardTitle className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
                                        Environmental Telemetry
                                    </CardTitle>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[10px] font-mono text-zinc-400 font-medium">REALTIME</span>
                                </div>
                            </CardHeader>

                            <CardContent className="p-0 divide-y divide-zinc-800/60">
                                {/* Environmental Sliders */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("environmental")}
                                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sliders className="h-3.5 w-3.5 text-sky-400" />
                                            <span className="text-xs font-mono font-medium text-zinc-200">
                                                Forcing Variables ({isInlandRiverine ? "Riverine" : "Coastal"})
                                            </span>
                                        </div>
                                        {openSections.environmental ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </button>

                                    {openSections.environmental && (
                                        <div className="px-3 py-2.5 space-y-3 bg-zinc-950/50 border-t border-zinc-800/60">
                                            {/* Tide Slider (Dimmed for Inland River Basins) */}
                                            <div className={`space-y-1 ${isInlandRiverine ? "opacity-50 pointer-events-none" : ""}`}>
                                                <div className="flex items-center justify-between text-xs font-mono">
                                                    <span className="text-zinc-400 flex items-center gap-1.5">
                                                        <Waves className="h-3.5 w-3.5 text-sky-400" /> Astronomical Tide
                                                    </span>
                                                    <span className="font-bold text-sky-400">
                                                        {isInlandRiverine ? "0.0m MSL (Inland Basin)" : `+${tideLevel.toFixed(1)}m MSL`}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.0"
                                                    max="6.0"
                                                    step="0.1"
                                                    disabled={isInlandRiverine}
                                                    value={isInlandRiverine ? 0 : tideLevel}
                                                    onChange={e => setTideLevel(parseFloat(e.target.value))}
                                                    className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                                />
                                                <div className="flex justify-between text-[10px] font-mono text-zinc-500 leading-none">
                                                    <span>0m (Neap)</span>
                                                    <span>3m (Spring)</span>
                                                    <span>6m (Surge)</span>
                                                </div>
                                            </div>

                                            {/* Upstream River Discharge (Active for Inland Basins) */}
                                            {isInlandRiverine && (
                                                <div className="space-y-1 p-2 rounded-lg bg-purple-950/30 border border-purple-800/40">
                                                    <div className="flex items-center justify-between text-xs font-mono">
                                                        <span className="text-purple-300 flex items-center gap-1.5">
                                                            <Activity className="h-3.5 w-3.5 text-purple-400" /> River Catchment Discharge
                                                        </span>
                                                        <span className="font-bold text-purple-300">{riverDischarge} m³/s</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="200"
                                                        max="8000"
                                                        step="100"
                                                        value={riverDischarge}
                                                        onChange={e => setRiverDischarge(parseInt(e.target.value))}
                                                        className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                                    />
                                                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 leading-none">
                                                        <span>200 m³/s (Base)</span>
                                                        <span>4,000 m³/s (Spill)</span>
                                                        <span>8,000 m³/s (Flash)</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Rainfall Slider */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs font-mono">
                                                    <span className="text-zinc-400 flex items-center gap-1.5">
                                                        <CloudRain className="h-3.5 w-3.5 text-blue-400" /> Precipitation
                                                    </span>
                                                    <span className="font-bold text-blue-400">{rainfall} mm/h</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="200"
                                                    step="5"
                                                    value={rainfall}
                                                    onChange={e => setRainfall(parseInt(e.target.value))}
                                                    className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                                />
                                                <div className="flex justify-between text-[10px] font-mono text-zinc-500 leading-none">
                                                    <span>0mm (Drizzle)</span>
                                                    <span>100mm (Heavy)</span>
                                                    <span>200mm (Cloudburst)</span>
                                                </div>
                                            </div>

                                            {/* Soil Saturation & Cyclone Toggle */}
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-mono text-zinc-400">
                                                        Soil Saturation: {Math.round(soilSaturation * 100)}%
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="0.2"
                                                        max="1.0"
                                                        step="0.05"
                                                        value={soilSaturation}
                                                        onChange={e => setSoilSaturation(parseFloat(e.target.value))}
                                                        className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                                    />
                                                </div>

                                                <div className={`flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 ${isInlandRiverine ? "opacity-40 pointer-events-none" : ""}`}>
                                                    <span className="text-[10px] font-mono text-zinc-300">
                                                        Cyclonic Surge
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={isInlandRiverine}
                                                        onClick={() => setCycloneActive(!cycloneActive)}
                                                        className={`w-8 h-4 rounded-full transition-colors relative ${
                                                            cycloneActive ? "bg-rose-600" : "bg-zinc-700"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                                                                cycloneActive ? "translate-x-4" : "translate-x-0.5"
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Localized Sector Override Section */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("sectorOverride")}
                                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-amber-400" />
                                            <span className="text-xs font-mono font-medium text-zinc-200">
                                                Sector Parameter Injection
                                            </span>
                                            {overrideEnabled && (
                                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-300 border-amber-500/40 bg-amber-950/40">
                                                    ACTIVE
                                                </Badge>
                                            )}
                                        </div>
                                        {openSections.sectorOverride ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </button>

                                    {openSections.sectorOverride && (
                                        <div className="p-3 space-y-3 bg-zinc-950/50 border-t border-zinc-800/60 font-mono text-xs">
                                            {/* Enable toggle */}
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                                                <span className="text-zinc-300 text-xs">Inject Local Sector Cloudburst</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = !overrideEnabled;
                                                        setOverrideEnabled(next);
                                                        if (next && !overrideZoneId && simulationResult?.zones?.length) {
                                                            setOverrideZoneId(selectedZone?.zone_id || simulationResult.zones[0].zone_id);
                                                        }
                                                    }}
                                                    className={`w-8 h-4 rounded-full transition-colors relative ${
                                                        overrideEnabled ? "bg-amber-500" : "bg-zinc-700"
                                                    }`}
                                                >
                                                    <span
                                                        className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                                                            overrideEnabled ? "translate-x-4" : "translate-x-0.5"
                                                        }`}
                                                    />
                                                </button>
                                            </div>

                                            {overrideEnabled && (
                                                <div className="space-y-2.5 pt-1">
                                                    {/* Select Zone */}
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] text-zinc-400 uppercase">Target Operational Sector:</span>
                                                        <select
                                                            value={overrideZoneId || (selectedZone?.zone_id ?? "")}
                                                            onChange={e => setOverrideZoneId(e.target.value)}
                                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-xs text-white outline-none cursor-pointer"
                                                        >
                                                            {simulationResult?.zones?.map(z => (
                                                                <option key={z.zone_id} value={z.zone_id} className="bg-zinc-900 text-white">
                                                                    {z.zone_name} [{z.zone_id}]
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Local Rainfall */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-zinc-400">Sector Local Rainfall:</span>
                                                            <span className="font-bold text-amber-400">{overrideRainfall} mm/h</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="250"
                                                            step="10"
                                                            value={overrideRainfall}
                                                            onChange={e => setOverrideRainfall(Number(e.target.value))}
                                                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                                        />
                                                    </div>

                                                    {/* Drainage Clog % */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-zinc-400">Culvert / Drain Clogged:</span>
                                                            <span className="font-bold text-rose-400">{overrideDrainageBlocked}%</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="90"
                                                            step="5"
                                                            value={overrideDrainageBlocked}
                                                            onChange={e => setOverrideDrainageBlocked(Number(e.target.value))}
                                                            className="w-full accent-rose-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Presets Section */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection("scenarios")}
                                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                            <span className="text-xs font-mono font-medium text-zinc-200">
                                                Benchmark Scenarios
                                            </span>
                                        </div>
                                        {openSections.scenarios ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </button>

                                    {openSections.scenarios && (
                                        <div className="p-2.5 grid grid-cols-2 gap-2 bg-zinc-950/50 border-t border-zinc-800/60">
                                            {SCENARIOS.map(sc => (
                                                <button
                                                    key={sc.name}
                                                    onClick={() => applyScenario(sc)}
                                                    className="p-2 rounded-xl border border-zinc-800/70 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-zinc-700/80 text-left transition-all cursor-pointer group shadow-xs"
                                                >
                                                    <div className="text-[11px] font-mono font-medium text-zinc-200 group-hover:text-white truncate">
                                                        {sc.name}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                                        +{sc.tide}m · {sc.rain}mm
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mode 2: What-If Sensitivity Studio */}
                    {activeTab === "whatif" && (
                        <Card className="rounded-2xl border border-amber-800/50 bg-zinc-900/40 backdrop-blur-md shadow-sm overflow-hidden">
                            <CardHeader className="py-2.5 px-3 border-b border-zinc-800/80 bg-amber-950/30 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-400" />
                                    <CardTitle className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-200">
                                        What-If Counterfactual Studio
                                    </CardTitle>
                                </div>
                                {isCalculatingWhatIf && (
                                    <RefreshCw className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                                )}
                            </CardHeader>

                            <CardContent className="p-3 space-y-3 bg-zinc-950/60 font-mono text-xs">
                                <p className="text-[11px] text-zinc-400 leading-snug">
                                    Simulate counterfactual civil interventions and climate deviations against baseline.
                                </p>

                                {/* Sensitivity Deltas */}
                                <div className="space-y-2.5">
                                    <div className={`space-y-1 ${isInlandRiverine ? "opacity-40 pointer-events-none" : ""}`}>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Sea Level Surge Delta:</span>
                                            <span className="font-bold text-amber-400">
                                                {isInlandRiverine ? "0.0m (Inland)" : `${whatIfTideDelta >= 0 ? "+" : ""}${whatIfTideDelta.toFixed(1)}m`}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="-1.5"
                                            max="2.5"
                                            step="0.1"
                                            disabled={isInlandRiverine}
                                            value={whatIfTideDelta}
                                            onChange={e => setWhatIfTideDelta(parseFloat(e.target.value))}
                                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Rainfall Variance:</span>
                                            <span className="font-bold text-sky-400">
                                                {whatIfRainDeltaPct >= 0 ? "+" : ""}
                                                {whatIfRainDeltaPct}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="-50"
                                            max="100"
                                            step="5"
                                            value={whatIfRainDeltaPct}
                                            onChange={e => setWhatIfRainDeltaPct(parseInt(e.target.value))}
                                            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Drainage Desilting Clearance:</span>
                                            <span className="font-bold text-emerald-400">+{whatIfDrainagePct}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="80"
                                            step="5"
                                            value={whatIfDrainagePct}
                                            onChange={e => setWhatIfDrainagePct(parseInt(e.target.value))}
                                            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-full appearance-none"
                                        />
                                    </div>
                                </div>

                                {/* Counterfactual Result Card */}
                                {whatIfResult && (
                                    <div className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/90 space-y-2 mt-2">
                                        <div className="text-[10px] uppercase font-bold text-zinc-400">
                                            Intervention Outcome Delta
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                                                <span className="text-[10px] text-zinc-400 block">Flooded Land</span>
                                                <span
                                                    className={`text-sm font-bold flex items-center gap-1 ${
                                                        whatIfResult.avoided_or_added_inundation_sq_km > 0
                                                            ? "text-rose-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {whatIfResult.avoided_or_added_inundation_sq_km > 0 ? (
                                                        <TrendingUp className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <TrendingDown className="h-3.5 w-3.5" />
                                                    )}
                                                    {whatIfResult.avoided_or_added_inundation_sq_km > 0 ? "+" : ""}
                                                    {whatIfResult.avoided_or_added_inundation_sq_km} km²
                                                </span>
                                            </div>

                                            <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                                                <span className="text-[10px] text-zinc-400 block">At-Risk Pop</span>
                                                <span
                                                    className={`text-sm font-bold flex items-center gap-1 ${
                                                        whatIfResult.avoided_or_added_population_at_risk > 0
                                                            ? "text-rose-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {whatIfResult.avoided_or_added_population_at_risk > 0 ? (
                                                        <TrendingUp className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <TrendingDown className="h-3.5 w-3.5" />
                                                    )}
                                                    {whatIfResult.avoided_or_added_population_at_risk > 0 ? "+" : ""}
                                                    {whatIfResult.avoided_or_added_population_at_risk.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-zinc-300 leading-tight">
                                            {whatIfResult.scenario_summary}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Zone Inspector & XAI Telemetry Breakdown */}
                    <Card className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-sm overflow-hidden">
                        <CardHeader className="py-2.5 px-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-rose-400" />
                                <CardTitle className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
                                    Sector Inspector & XAI Drivers
                                </CardTitle>
                            </div>
                            <Badge
                                variant={
                                    selectedZone?.threat_level === "CRITICAL"
                                        ? "destructive"
                                        : selectedZone?.threat_level === "HIGH"
                                          ? "warning"
                                          : "default"
                                }
                                className="text-[9px] px-1.5 py-0 h-4 font-mono font-normal"
                            >
                                {selectedZone?.zone_id || "ZONE"}
                            </Badge>
                        </CardHeader>

                        <CardContent className="p-3 space-y-3 bg-zinc-950/50 font-mono text-xs">
                            {selectedZone ? (
                                <div className="space-y-3">
                                    {/* Sector Header */}
                                    <div>
                                        <div className="font-bold text-sm text-white font-sans">
                                            {selectedZone.zone_name}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-0.5">
                                            <span>
                                                {selectedZone.region || "Coastal Reach"}, {selectedZone.state}
                                            </span>
                                            <span>
                                                Elev: <b className="text-white">{selectedZone.elevation_meters}m MSL</b>
                                            </span>
                                        </div>
                                    </div>

                                    {/* ML Inundation Predictor Stats */}
                                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                                        <div>
                                            <span className="text-[10px] text-zinc-400 block">Projected Water Depth</span>
                                            <span className="text-sm font-bold text-sky-400">
                                                {selectedZone.projected_depth_meters?.toFixed(2) || "0.00"}m
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-zinc-400 block">Flood Probability</span>
                                            <span className="text-sm font-bold text-rose-400">
                                                {Math.round((selectedZone.flood_probability || 0.8) * 100)}%
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-zinc-400 block">Onset Time</span>
                                            <span className="text-xs font-semibold text-amber-300">
                                                {selectedZone.onset_time_minutes || 30} mins
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-zinc-400 block">Peak Time</span>
                                            <span className="text-xs font-semibold text-purple-300">
                                                {selectedZone.peak_time_minutes || 120} mins
                                            </span>
                                        </div>
                                    </div>

                                    {/* Explainable AI (XAI) Attribution Bars */}
                                    {selectedZone.primary_drivers && selectedZone.primary_drivers.length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center justify-between">
                                                <span>XAI Flood Risk Attribution</span>
                                                <span className="text-[9px] text-zinc-500 font-normal">SHAP Weights</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {selectedZone.primary_drivers.map(driver => (
                                                    <div key={driver.factor_key} className="space-y-0.5">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-zinc-300">{driver.factor_name}</span>
                                                            <span className="text-sky-400 font-bold">
                                                                {Math.round(driver.contribution_pct)}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                                                            <div
                                                                className="bg-sky-500 h-1 rounded-full transition-all duration-500"
                                                                style={{ width: `${driver.contribution_pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Decision Infrastructure Impact */}
                                    <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                                        <div className="text-[10px] uppercase font-bold text-zinc-400">
                                            Infrastructure & Safe Corridors
                                        </div>

                                        {selectedZone.safe_shelters && selectedZone.safe_shelters.length > 0 && (
                                            <div className="p-1.5 rounded bg-emerald-950/30 border border-emerald-800/40 text-[10px] text-emerald-300 flex items-center gap-1.5">
                                                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">
                                                    Shelter: <b>{selectedZone.safe_shelters[0].name}</b> (+
                                                    {selectedZone.safe_shelters[0].elevation_meters}m)
                                                </span>
                                            </div>
                                        )}

                                        {selectedZone.submerged_roads && selectedZone.submerged_roads.length > 0 ? (
                                            <div className="p-1.5 rounded bg-rose-950/30 border border-rose-800/40 text-[10px] text-rose-300 flex items-center gap-1.5">
                                                <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">
                                                    Submerged: <b>{selectedZone.submerged_roads[0].name}</b>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 flex items-center gap-1.5">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                <span>All primary arterial corridors passable</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Emergency Mobile Broadcast Preview */}
                                    {selectedZone.sms_text && (
                                        <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                <span className="flex items-center gap-1">
                                                    <Radio className="h-3 w-3 text-sky-400" />
                                                    SMS Broadcast Draft
                                                </span>
                                                <span className="text-[9px] text-zinc-500">
                                                    ~{selectedZone.population.toLocaleString()} recipients
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-zinc-300 italic font-sans leading-relaxed">
                                                "{selectedZone.sms_text}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-zinc-500 text-xs">
                                    <MapPin className="h-6 w-6 mx-auto mb-2 text-zinc-600" />
                                    Click any sector on the map or select above to inspect ML driver diagnostics.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* AI Copilot Slide-over Panel */}
            <AiCopilotPanel
                isOpen={isCopilotOpen}
                onClose={() => setIsCopilotOpen(false)}
                activeZoneId={selectedZone?.zone_id}
            />
        </div>
    );
}
