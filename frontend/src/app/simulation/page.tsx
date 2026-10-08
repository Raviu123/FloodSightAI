"use client";

import { useState } from "react";
import {
  Sliders,
  Waves,
  CloudRain,
  Clock,
  Play,
  RotateCcw,
  AlertTriangle,
  Radio,
  Shield,
  Zap,
  Activity,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { FloodMap } from "@/components/map/FloodMap";

interface ScenarioPreset {
  name: string;
  tide: number;
  rain: number;
  hours: number;
}

const SCENARIOS: ScenarioPreset[] = [
  { name: "Monsoon Surge", tide: 3.2, rain: 95, hours: 6 },
  { name: "Astronomical Spring Tide", tide: 4.5, rain: 40, hours: 8 },
  { name: "Severe Cyclone Inundation", tide: 5.2, rain: 140, hours: 12 },
  { name: "Baseline Normal", tide: 1.8, rain: 20, hours: 4 },
];

export default function SimulationPage() {
  const [tideLevel, setTideLevel] = useState(2.8);
  const [rainfall, setRainfall] = useState(75);
  const [forecastHours, setForecastHours] = useState(6);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any>(null);

  const floodRiskScore = tideLevel * 18 + rainfall * 0.45;
  const riskStatus =
    floodRiskScore > 80
      ? { label: "CRITICAL THREAT", variant: "destructive" as const }
      : floodRiskScore > 50
      ? { label: "HIGH HAZARD", variant: "warning" as const }
      : floodRiskScore > 30
      ? { label: "MODERATE", variant: "default" as const }
      : { label: "NORMAL / SAFE", variant: "success" as const };

  const applyScenario = (sc: ScenarioPreset) => {
    setTideLevel(sc.tide);
    setRainfall(sc.rain);
    setForecastHours(sc.hours);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Simulation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <StatusIndicator status="online" label="Hydrological Engine Armed" />
            <Badge variant="outline" className="text-[10px]">
              FastAPI Synchronized
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
            <Sliders className="h-5 w-5 text-sky-400" />
            Hydrological Flood Simulation Engine
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Adjust environmental telemetry to dynamically model coastal water ingress and terrain inundation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTideLevel(1.8);
              setRainfall(20);
              setForecastHours(4);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Baseline
          </Button>
          <Button
            size="sm"
            className={isSimulating ? "bg-amber-600 hover:bg-amber-500 border-amber-400/40" : ""}
            onClick={() => setIsSimulating(!isSimulating)}
          >
            <Play className="h-3.5 w-3.5" />
            {isSimulating ? "Pause Telemetry" : "Run Live Simulation"}
          </Button>
        </div>
      </div>

      {/* Scenario Presets Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-zinc-850 bg-zinc-900/60 backdrop-blur-md">
        <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider px-2">
          Scenario Presets:
        </span>
        {SCENARIOS.map((sc) => (
          <button
            key={sc.name}
            onClick={() => applyScenario(sc)}
            className="px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-zinc-750 bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            {sc.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulation Controls Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-sky-400" />
                  Environmental Parameters
                </CardTitle>
                <Badge variant="outline" className="text-[9px]">
                  Real-time
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-5">
              {/* Tide Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <label className="text-zinc-300 flex items-center gap-1.5">
                    <Waves className="h-3.5 w-3.5 text-sky-400" />
                    Tide Surge (Above MSL)
                  </label>
                  <span className="font-bold text-sky-400">
                    +{tideLevel.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.1"
                  value={tideLevel}
                  onChange={(e) => setTideLevel(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>0.0m (Neap)</span>
                  <span>3.0m (Normal)</span>
                  <span>6.0m (Storm)</span>
                </div>
              </div>

              {/* Rainfall Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <label className="text-zinc-300 flex items-center gap-1.5">
                    <CloudRain className="h-3.5 w-3.5 text-blue-400" />
                    Precipitation Inflow Rate
                  </label>
                  <span className="font-bold text-sky-400">
                    {rainfall} mm/h
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="5"
                  value={rainfall}
                  onChange={(e) => setRainfall(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>0mm</span>
                  <span>75mm (Heavy)</span>
                  <span>200mm (Cloudburst)</span>
                </div>
              </div>

              {/* Forecast Window Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <label className="text-zinc-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-purple-400" />
                    Forecast Window
                  </label>
                  <span className="font-bold text-sky-400">
                    +{forecastHours} Hours
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  step="1"
                  value={forecastHours}
                  onChange={(e) => setForecastHours(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>+1h</span>
                  <span>+12h</span>
                  <span>+24h Horizon</span>
                </div>
              </div>

              {/* Threat Computation Matrix */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                    Computed Threat Index
                  </span>
                  <Badge variant={riskStatus.variant}>{riskStatus.label}</Badge>
                </div>
                <div className="text-2xl font-black text-white">
                  {Math.round(floodRiskScore)} <span className="text-xs text-zinc-500 font-normal">/ 100</span>
                </div>
                <p className="text-[11px] font-sans text-zinc-400 leading-snug">
                  {floodRiskScore > 65
                    ? "Inundation alert: Overtopping predicted across low-elevation estuaries and barrier spits."
                    : "Stable drainage buffer: Siphon discharge capacity sufficient for anticipated runoff."}
                </p>
              </div>

              {/* Active Zone Inspector */}
              {selectedZone && (
                <div className="rounded-lg border border-sky-500/40 bg-sky-950/30 p-3.5 space-y-2 font-mono">
                  <div className="flex items-center justify-between border-b border-sky-900/60 pb-1.5">
                    <span className="text-xs font-bold text-sky-300">
                      {selectedZone.id}
                    </span>
                    <Badge variant="destructive">{selectedZone.riskLevel}</Badge>
                  </div>
                  <div className="text-xs font-bold font-sans text-white">
                    {selectedZone.name}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-zinc-300">
                    <div>Elevation: <b className="text-white">{selectedZone.elevationMeters}m MSL</b></div>
                    <div>Population: <b className="text-white">{Number(selectedZone.population).toLocaleString()}</b></div>
                  </div>
                  <div className="text-[10px] font-sans text-zinc-400 pt-1 border-t border-sky-950">
                    Action: <span className="text-sky-300 font-medium">{selectedZone.recommendation}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* MapLibre Map Canvas (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <FloodMap
            tideLevel={tideLevel}
            rainfall={rainfall}
            heightClassName="h-[680px]"
            onZoneSelect={(zone) => setSelectedZone(zone)}
          />
        </div>
      </div>
    </div>
  );
}
