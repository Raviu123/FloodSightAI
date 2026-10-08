"use client";

import { useState } from "react";
import { Sliders, Waves, CloudRain, Clock, Play, RotateCcw, AlertTriangle, Layers, MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SimulationPage() {
  const [tideLevel, setTideLevel] = useState(2.4);
  const [rainfall, setRainfall] = useState(65);
  const [forecastHours, setForecastHours] = useState(6);
  const [isSimulating, setIsSimulating] = useState(false);

  // Compute calculated risk level dynamically based on simulation sliders
  const floodRiskScore = tideLevel * 20 + rainfall * 0.5;
  const riskStatus =
    floodRiskScore > 80
      ? { label: "CRITICAL", variant: "destructive" as const }
      : floodRiskScore > 50
      ? { label: "HIGH", variant: "warning" as const }
      : floodRiskScore > 30
      ? { label: "MEDIUM", variant: "default" as const }
      : { label: "LOW / SAFE", variant: "success" as const };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2.5">
            <Sliders className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Coastal Flood Simulation Engine
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Adjust environmental parameters to simulate tide surges, heavy precipitation, and flood propagation.
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
            {isSimulating ? "Pause Simulation" : "Run Simulation"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Simulation Controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-600" />
                Environmental Controls
              </CardTitle>
              <CardDescription>
                Simulate real-time tide levels and storm surges
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Tide Level Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Waves className="h-4 w-4 text-sky-500" />
                    Tide Level (Meters)
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
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>0.0m (Low)</span>
                  <span>3.0m (Normal)</span>
                  <span>6.0m (Storm Tide)</span>
                </div>
              </div>

              {/* Rainfall Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <CloudRain className="h-4 w-4 text-blue-500" />
                    Rainfall (mm / hour)
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
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>0mm (Dry)</span>
                  <span>75mm (Heavy)</span>
                  <span>200mm (Cloudburst)</span>
                </div>
              </div>

              {/* Time Horizon Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-purple-500" />
                    Forecast Window
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
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>1 Hour</span>
                  <span>12 Hours</span>
                  <span>24 Hours</span>
                </div>
              </div>

              {/* Projected Risk Result */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Calculated Threat Index
                  </span>
                  <Badge variant={riskStatus.variant}>{riskStatus.label}</Badge>
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {Math.round(floodRiskScore)} / 100
                </div>
                <p className="text-xs text-zinc-500">
                  {floodRiskScore > 60
                    ? "Inundation predicted for low-lying coastal estuaries and river mouths."
                    : "Water levels within manageable drainage thresholds."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Visualization Container */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-full min-h-[480px] flex flex-col justify-between border-dashed">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Interactive Map Canvas
                </CardTitle>
                <CardDescription>
                  Ready for Leaflet / MapLibre / Deck.gl map integration
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline">Satellite</Badge>
                <Badge variant="outline">Terrain 3D</Badge>
                <Badge variant="outline">Danger Zones</Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-900/5 dark:bg-zinc-950/40 rounded-lg m-6 mt-0 border border-zinc-200/50 dark:border-zinc-800/50">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                <MapPin className="h-8 w-8 animate-bounce" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Map Viewport Placeholder
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                This area is pre-configured for your map library of choice (e.g. Leaflet, Mapbox, or Deck.gl) to render Indian coastal contour overlays, water body layers, and dynamic risk polygon shading.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
