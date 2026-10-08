"use client";

import { useState } from "react";
import { Sliders, Waves, CloudRain, Clock, Play, RotateCcw, AlertTriangle, Radio, Shield, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloodMap } from "@/components/map/FloodMap";

export default function SimulationPage() {
  const [tideLevel, setTideLevel] = useState(2.8);
  const [rainfall, setRainfall] = useState(75);
  const [forecastHours, setForecastHours] = useState(6);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any>(null);

  // Compute calculated risk level dynamically based on simulation sliders
  const floodRiskScore = tideLevel * 18 + rainfall * 0.45;
  const riskStatus =
    floodRiskScore > 80
      ? { label: "CRITICAL DANGER", variant: "destructive" as const }
      : floodRiskScore > 50
      ? { label: "HIGH RISK", variant: "warning" as const }
      : floodRiskScore > 30
      ? { label: "MODERATE", variant: "default" as const }
      : { label: "NORMAL / SAFE", variant: "success" as const };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2.5">
            <Sliders className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Coastal Flood Simulation & Multi-Layer Map
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            MapLibre GL JS powered interactive engine with satellite, 3D terrain, danger polygons, and dynamic inundation spread.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTideLevel(2.0);
              setRainfall(30);
              setForecastHours(6);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>
          <Button
            size="sm"
            className={isSimulating ? "bg-amber-600 hover:bg-amber-700" : ""}
            onClick={() => setIsSimulating(!isSimulating)}
          >
            <Play className="h-3.5 w-3.5" />
            {isSimulating ? "Pause Simulation" : "Run Live Simulation"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulation Controls Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-blue-600" />
                  Simulation Parameters
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Live Sync
                </div>
              </div>
              <CardDescription>
                Adjust tide surge and precipitation intensity to watch vector water layers update
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Tide Level Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Waves className="h-4 w-4 text-sky-500" />
                    Tide Surge (Meters above MSL)
                  </label>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
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
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>0.0m (Low Tide)</span>
                  <span>3.0m (Normal)</span>
                  <span>6.0m (Storm Surge)</span>
                </div>
              </div>

              {/* Rainfall Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <CloudRain className="h-4 w-4 text-blue-500" />
                    Precipitation Rate (mm / hr)
                  </label>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
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
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>0mm (Dry)</span>
                  <span>75mm (Heavy Rain)</span>
                  <span>200mm (Extreme)</span>
                </div>
              </div>

              {/* Time Window Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-purple-500" />
                    Forecast Horizon
                  </label>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
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
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>1h</span>
                  <span>12h</span>
                  <span>24h Window</span>
                </div>
              </div>

              {/* Dynamic Threat Index Card */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Calculated Threat Index
                  </span>
                  <Badge variant={riskStatus.variant}>{riskStatus.label}</Badge>
                </div>
                <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  {Math.round(floodRiskScore)} / 100
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {floodRiskScore > 65
                    ? "High flood ingress predicted across low-lying coastal estuaries and river mouths."
                    : "Water levels within standard stormwater drainage buffer capacity."}
                </p>
              </div>

              {/* Selected Zone Inspector (if user clicked on map) */}
              {selectedZone && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                      Active Zone Inspector
                    </span>
                    <Badge variant="destructive">{selectedZone.riskLevel}</Badge>
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedZone.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300 pt-1">
                    <div>Elevation: <b>{selectedZone.elevationMeters}m MSL</b></div>
                    <div>Population: <b>{Number(selectedZone.population).toLocaleString()}</b></div>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                    Recommended: <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedZone.recommendation}</span>
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
