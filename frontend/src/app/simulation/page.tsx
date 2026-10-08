"use client";

import { FloodMap } from "@/components/map/FloodMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ChevronDown,
    ChevronUp,
    Clock,
    CloudRain,
    MapPin,
    Pause,
    Play,
    RotateCcw,
    ShieldAlert,
    Sliders,
    SlidersHorizontal,
    Sparkles,
    Waves,
} from "lucide-react";
import { useState } from "react";

interface ScenarioPreset {
    name: string;
    tide: number;
    rain: number;
    hours: number;
}

const SCENARIOS: ScenarioPreset[] = [
    { name: "Monsoon Surge", tide: 3.2, rain: 95, hours: 6 },
    { name: "Spring Tide", tide: 4.5, rain: 40, hours: 8 },
    { name: "Cyclone Inundation", tide: 5.2, rain: 140, hours: 12 },
    { name: "Baseline Normal", tide: 1.8, rain: 20, hours: 4 },
];

export default function SimulationPage() {
    const [tideLevel, setTideLevel] = useState(2.8);
    const [rainfall, setRainfall] = useState(75);
    const [forecastHours, setForecastHours] = useState(6);
    const [isSimulating, setIsSimulating] = useState(false);
    const [selectedZone, setSelectedZone] = useState<any>(null);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        environmental: true,
        scenarios: true,
        threat: true,
        zone: true,
    });

    const toggleSection = (sectionKey: string) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey],
        }));
    };

    const floodRiskScore = tideLevel * 18 + rainfall * 0.45;
    const riskStatus =
        floodRiskScore > 80
            ? { label: "CRITICAL", variant: "destructive" as const }
            : floodRiskScore > 50
              ? { label: "HIGH", variant: "warning" as const }
              : floodRiskScore > 30
                ? { label: "MODERATE", variant: "default" as const }
                : { label: "SAFE", variant: "success" as const };

    const applyScenario = (sc: ScenarioPreset) => {
        setTideLevel(sc.tide);
        setRainfall(sc.rain);
        setForecastHours(sc.hours);
    };

    return (
        <div className="w-full p-1 sm:p-2 space-y-3">
            {/* Simulation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/60 pb-2.5 px-1">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 font-mono uppercase">
                    Flood Simulation Engine
                </h1>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setTideLevel(1.8);
                            setRainfall(20);
                            setForecastHours(4);
                        }}
                        className="font-mono text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        className={`font-mono text-xs gap-1.5 h-8 ${
                            isSimulating ? "bg-amber-600 hover:bg-amber-500" : "bg-sky-600 hover:bg-sky-500"
                        }`}
                        onClick={() => setIsSimulating(!isSimulating)}
                    >
                        {isSimulating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {isSimulating ? "Pause" : "Run"}
                    </Button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Flood Map */}
                <div className="lg:col-span-8 xl:col-span-9">
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-1 shadow-inner overflow-hidden">
                        <FloodMap
                            tideLevel={tideLevel}
                            rainfall={rainfall}
                            heightClassName="h-[calc(100vh-10.5rem)] min-h-[620px]"
                            onZoneSelect={zone => setSelectedZone(zone)}
                        />
                    </div>
                </div>

                {/* Sidebar Console */}
                <div className="lg:col-span-4 xl:col-span-3">
                    <Card className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-sm overflow-hidden">
                        {/* Console Header */}
                        <CardHeader className="py-2.5 px-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-sky-400" />
                                <CardTitle className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
                                    Simulation Controls
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-mono text-zinc-400 font-medium">LIVE</span>
                            </div>
                        </CardHeader>

                        {/* Nested Control Sections */}
                        <CardContent className="p-0 divide-y divide-zinc-800/60">
                            {/* Section 1: Environmental Sliders */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("environmental")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sliders className="h-3.5 w-3.5 text-sky-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">Environment</span>
                                    </div>
                                    {openSections.environmental ? (
                                        <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                    )}
                                </button>

                                {openSections.environmental && (
                                    <div className="px-3 py-2.5 space-y-2.5 bg-zinc-950/50 border-t border-zinc-800/60">
                                        {/* Tide Slider */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <Waves className="h-3.5 w-3.5 text-sky-400" /> Tide
                                                </span>
                                                <span className="font-bold text-sky-400">+{tideLevel.toFixed(1)}m</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="6"
                                                step="0.1"
                                                value={tideLevel}
                                                onChange={e => setTideLevel(parseFloat(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                            <div className="flex justify-between text-[10px] font-mono text-zinc-500 leading-none">
                                                <span>0m</span>
                                                <span>3m</span>
                                                <span>6m</span>
                                            </div>
                                        </div>

                                        {/* Rainfall Slider */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <CloudRain className="h-3.5 w-3.5 text-blue-400" /> Rainfall
                                                </span>
                                                <span className="font-bold text-sky-400">{rainfall} mm/h</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="200"
                                                step="5"
                                                value={rainfall}
                                                onChange={e => setRainfall(parseInt(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                            <div className="flex justify-between text-[10px] font-mono text-zinc-500 leading-none">
                                                <span>0mm</span>
                                                <span>100mm</span>
                                                <span>200mm</span>
                                            </div>
                                        </div>

                                        {/* Forecast Horizon Slider */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-zinc-400 flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5 text-purple-400" /> Horizon
                                                </span>
                                                <span className="font-bold text-sky-400">+{forecastHours}h</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="24"
                                                step="1"
                                                value={forecastHours}
                                                onChange={e => setForecastHours(parseInt(e.target.value))}
                                                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800/80 rounded-full appearance-none"
                                            />
                                            <div className="flex justify-between text-[10px] font-mono text-zinc-500 leading-none">
                                                <span>+1h</span>
                                                <span>+12h</span>
                                                <span>+24h</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Preset Scenarios */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("scenarios")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">Presets</span>
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

                            {/* Section 3: Risk Index */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("threat")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">Risk Index</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={riskStatus.variant}
                                            className="text-[9px] px-1.5 py-0 h-4 font-mono font-normal"
                                        >
                                            {riskStatus.label}
                                        </Badge>
                                        {openSections.threat ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </div>
                                </button>

                                {openSections.threat && (
                                    <div className="px-3 py-2 bg-zinc-950/50 border-t border-zinc-800/60">
                                        <div className="flex items-center justify-between font-mono">
                                            <span className="text-xs text-zinc-400">Threat Score</span>
                                            <div className="text-base font-bold text-white tracking-tight">
                                                {Math.round(floodRiskScore)}
                                                <span className="text-xs text-zinc-500 font-normal"> / 100</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 4: Zone Inspector */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection("zone")}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-rose-400" />
                                        <span className="text-xs font-mono font-medium text-zinc-200">
                                            Zone Inspector
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-850 px-1.5 py-0.5 rounded border border-zinc-750/60">
                                            {selectedZone ? selectedZone.id : "None"}
                                        </span>
                                        {openSections.zone ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                        ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                        )}
                                    </div>
                                </button>

                                {openSections.zone && (
                                    <div className="px-3 py-2 font-mono bg-zinc-950/50 border-t border-zinc-800/60">
                                        {selectedZone ? (
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold text-white truncate pr-2">
                                                        {selectedZone.name}
                                                    </span>
                                                    <Badge
                                                        variant="destructive"
                                                        className="text-[9px] px-1.5 py-0 h-4 font-mono font-normal shrink-0"
                                                    >
                                                        {selectedZone.riskLevel}
                                                    </Badge>
                                                </div>
                                                <div className="text-[11px] text-zinc-400 flex justify-between pt-0.5">
                                                    <span>Elev: {selectedZone.elevationMeters}m</span>
                                                    <span>Pop: {Number(selectedZone.population).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-zinc-500 block text-center py-0.5">
                                                Click any map sector to inspect
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
