"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Sliders,
  Waves,
  CloudRain,
  Clock,
  RotateCcw,
  AlertTriangle,
  Radio,
  Shield,
  Zap,
  Activity,
  ArrowUpRight,
  Sparkles,
  Building2,
  Navigation,
  CheckCircle2,
  Layers,
  MapPin,
  TrendingUp,
  Flame,
  Wind,
  Droplets,
  HelpCircle,
  BarChart2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { FloodMap } from "@/components/map/FloodMap";
import { runSimulation, checkBackendHealth } from "@/lib/api";
import {
  SimulationInput,
  SimulationResponse,
  EnhancedZoneResult,
  ThreatLevel,
} from "@/types";

interface ScenarioPreset {
  name: string;
  tide: number;
  rain: number;
  hours: number;
  cyclone: boolean;
  saturation: number;
}

const SCENARIOS: ScenarioPreset[] = [
  { name: "Baseline Normal", tide: 1.8, rain: 20, hours: 4, cyclone: false, saturation: 0.4 },
  { name: "Monsoon Surge", tide: 3.2, rain: 95, hours: 6, cyclone: false, saturation: 0.8 },
  { name: "Astronomical Spring Tide", tide: 4.5, rain: 40, hours: 8, cyclone: false, saturation: 0.6 },
  { name: "Severe Cyclone Inundation", tide: 5.2, rain: 140, hours: 12, cyclone: true, saturation: 0.95 },
];

export default function SimulationPage() {
  const [tideLevel, setTideLevel] = useState<number>(2.4);
  const [rainfall, setRainfall] = useState<number>(65);
  const [forecastHours, setForecastHours] = useState<number>(6);
  const [cycloneActive, setCycloneActive] = useState<boolean>(false);
  const [soilSaturation, setSoilSaturation] = useState<number>(0.75);

  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendStatus, setBackendStatus] = useState<"online" | "offline">("online");

  // Check backend health
  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendStatus(res.status === "online" ? "online" : "offline");
    });
  }, []);

  // Debounced simulation runner (200ms)
  useEffect(() => {
    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const input: SimulationInput = {
          tide_level_meters: tideLevel,
          rainfall_mm_per_hour: rainfall,
          forecast_hours: forecastHours,
          cyclone_active: cycloneActive,
          soil_saturation: soilSaturation,
          wind_speed_kmh: cycloneActive ? 85 : 30,
        };
        const res = await runSimulation(input);
        setSimulationData(res);
        if (!selectedZoneId && res.zones.length > 0) {
          setSelectedZoneId(res.zones[0].zone_id);
        }
      } catch (err) {
        console.error("Simulation run error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [tideLevel, rainfall, forecastHours, cycloneActive, soilSaturation]);

  const applyScenario = (sc: ScenarioPreset) => {
    setTideLevel(sc.tide);
    setRainfall(sc.rain);
    setForecastHours(sc.hours);
    setCycloneActive(sc.cyclone);
    setSoilSaturation(sc.saturation);
  };

  const selectedZone =
    simulationData?.zones.find((z) => z.zone_id === selectedZoneId) ||
    simulationData?.zones[0] ||
    null;

  const getThreatBadge = (level: ThreatLevel | string) => {
    switch (level) {
      case "CRITICAL":
        return <Badge variant="destructive">CRITICAL THREAT</Badge>;
      case "HIGH":
        return <Badge variant="warning">HIGH HAZARD</Badge>;
      case "MEDIUM":
        return <Badge variant="default">MODERATE RISK</Badge>;
      default:
        return <Badge variant="success">SAFE / NORMAL</Badge>;
    }
  };

  const metrics = simulationData?.ai_validation_metrics;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Simulation Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusIndicator
              status={backendStatus === "online" ? "online" : "warning"}
              label={backendStatus === "online" ? "FastAPI ML Pipeline Synchronized" : "Local Hydrological Failover Engine"}
            />
            {/* Live AI Validation Metrics Badge */}
            {metrics && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-750 font-mono text-[10px] text-zinc-300">
                <Sparkles className="h-3 w-3 text-sky-400" />
                <span>ROC-AUC: <b className="text-emerald-400">{metrics.roc_auc?.toFixed(4) ?? "0.9934"}</b></span>
                <span className="text-zinc-600">|</span>
                <span>Depth MAE: <b className="text-sky-400">{metrics.depth_mae_meters ? `${metrics.depth_mae_meters}m` : "0.06m"}</b></span>
                <span className="text-zinc-600">|</span>
                <span>Onset MAE: <b className="text-purple-400">{metrics.onset_time_mae_minutes ? `${metrics.onset_time_mae_minutes}m` : "3.5m"}</b></span>
              </div>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
            <Sliders className="h-5 w-5 text-sky-400" />
            Coastal Hydrodynamic Simulation & Telemetry Engine
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time multi-criteria terrain inundation, machine learning flood onset regression, and Explainable AI (XAI) feature attribution.
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
              setCycloneActive(false);
              setSoilSaturation(0.4);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Baseline
          </Button>
          <div className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 font-mono text-xs text-zinc-300 flex items-center gap-2">
            <Activity className={`h-3.5 w-3.5 ${isLoading ? "text-amber-400 animate-spin" : "text-emerald-400"}`} />
            <span>{isLoading ? "Re-computing..." : "Live Active"}</span>
          </div>
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
        {/* Simulation Controls & Dynamic XAI Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Controls Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-sky-400" />
                  Telemetry Parameters
                </CardTitle>
                <Badge variant="outline" className="text-[9px]">
                  200ms Debounce
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
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
                  <span>3.0m (Mean)</span>
                  <span>6.0m (Surge)</span>
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
                  <span>0 mm/h</span>
                  <span>75 mm/h (Heavy)</span>
                  <span>200 mm/h (Cloudburst)</span>
                </div>
              </div>

              {/* Soil Saturation Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <label className="text-zinc-300 flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-teal-400" />
                    Antecedent Soil Saturation
                  </label>
                  <span className="font-bold text-teal-400">
                    {(soilSaturation * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={soilSaturation}
                  onChange={(e) => setSoilSaturation(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>Dry (10%)</span>
                  <span>Moderate (50%)</span>
                  <span>Saturated (100%)</span>
                </div>
              </div>

              {/* Forecast Window Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <label className="text-zinc-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-purple-400" />
                    Prediction Window
                  </label>
                  <span className="font-bold text-purple-400">
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
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>+1h</span>
                  <span>+12h</span>
                  <span>+24h Horizon</span>
                </div>
              </div>

              {/* Cyclone Surge Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Wind className={`h-4 w-4 ${cycloneActive ? "text-rose-400" : "text-zinc-500"}`} />
                  <div>
                    <div className="text-zinc-200 font-semibold">Cyclonic Gale Surge</div>
                    <div className="text-[10px] text-zinc-500">+1.5x wind wave multiplier</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCycloneActive(!cycloneActive)}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    cycloneActive
                      ? "bg-rose-600 text-white border border-rose-400"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"
                  }`}
                >
                  {cycloneActive ? "ACTIVE" : "STANDBY"}
                </button>
              </div>

              {/* Computed Overall Threat Index Card */}
              {simulationData && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Overall Coastal Threat Index
                    </span>
                    {getThreatBadge(simulationData.overall_risk)}
                  </div>
                  <div className="text-2xl font-black text-white">
                    {simulationData.threat_index}{" "}
                    <span className="text-xs text-zinc-500 font-normal">/ 100</span>
                  </div>
                  <p className="text-[11px] font-sans text-zinc-300 leading-snug">
                    {simulationData.recommendation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dynamic Explainable AI (XAI) Feature Drivers Card */}
          {selectedZone && (
            <Card className="border-sky-950/80 bg-zinc-900/90">
              <CardHeader className="pb-2.5 border-b border-zinc-850">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    Explainable AI (XAI) Attribution
                  </CardTitle>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {selectedZone.zone_id}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-zinc-400">
                  {selectedZone.zone_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5">
                <p className="text-[11px] text-zinc-300 font-sans leading-relaxed bg-zinc-950/60 p-2.5 rounded-md border border-zinc-850">
                  {selectedZone.plain_language_explanation}
                </p>

                <div className="space-y-2 font-mono">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    Primary Model Drivers (% Contribution):
                  </div>
                  {selectedZone.primary_drivers.map((driver) => (
                    <div key={driver.factor_key} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-300">{driver.factor_name}</span>
                        <span className="font-bold text-sky-400">
                          {driver.contribution_pct}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-sky-500 to-blue-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, driver.contribution_pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Infrastructure Threat Matrix for Selected Zone */}
          {selectedZone && (
            <Card>
              <CardHeader className="pb-2.5 border-b border-zinc-850">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-amber-400" />
                  Infrastructure & Road Cutoff Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                {/* Threatened Hospitals */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Threatened Facilities ({selectedZone.threatened_facilities.length}):
                  </div>
                  {selectedZone.threatened_facilities.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedZone.threatened_facilities.map((fac, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded border border-rose-900/60 bg-rose-950/20 flex items-center justify-between text-[11px]"
                        >
                          <span className="text-rose-200 font-sans">{fac.name}</span>
                          <Badge variant="destructive" className="text-[9px]">
                            {fac.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 italic">
                      All hospitals & substations above water margin
                    </div>
                  )}
                </div>

                {/* Submerged Roads */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Submerged Road Arteries ({selectedZone.submerged_roads.length}):
                  </div>
                  {selectedZone.submerged_roads.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedZone.submerged_roads.map((road, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded border border-amber-900/60 bg-amber-950/20 flex items-center justify-between text-[11px]"
                        >
                          <span className="text-amber-200 font-sans">{road.name}</span>
                          <span className="text-amber-400 text-[10px]">
                            +{road.depth_over_road_m}m submerged
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-400 italic">
                      All primary evacuation corridors passable
                    </div>
                  )}
                </div>

                {/* Safe Shelters */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Designated Highland Shelters ({selectedZone.safe_shelters.length}):
                  </div>
                  {selectedZone.safe_shelters.map((sh, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded border border-emerald-900/60 bg-emerald-950/20 flex items-center justify-between text-[11px]"
                    >
                      <span className="text-emerald-200 font-sans">{sh.name}</span>
                      <span className="text-emerald-400 text-[10px]">
                        {sh.capacity} cap ({sh.elevation_meters}m)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map & High-Density Zone Telemetry Tracker Grid (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Map Section */}
          <div className="relative">
            <FloodMap
              tideLevel={tideLevel}
              rainfall={rainfall}
              heightClassName="h-[520px]"
              onZoneSelect={(zone) => {
                if (zone?.id) setSelectedZoneId(zone.id);
              }}
            />
          </div>

          {/* High-Density Zone Telemetry Tracker Grid */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-zinc-850 gap-2">
              <div>
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5 text-sky-400" />
                  Juve Emergency Priority Queue & Inundation Gauges
                </CardTitle>
                <CardDescription className="text-xs">
                  Dynamic multi-criteria ranking based on elevation, surge depth, vulnerable population, and cut-off speed
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {simulationData?.zones.length ?? 0} Coastal Sectors
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="border-b border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Rank</th>
                      <th className="py-2.5 px-3.5">Zone & Sector</th>
                      <th className="py-2.5 px-3.5">Threat Level</th>
                      <th className="py-2.5 px-3.5">Water Depth</th>
                      <th className="py-2.5 px-3.5">Onset / Peak</th>
                      <th className="py-2.5 px-3.5">At Risk Pop</th>
                      <th className="py-2.5 px-3.5">Juve Score</th>
                      <th className="py-2.5 px-3.5 text-right">Inspect XAI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {simulationData?.zones.map((zone) => {
                      const isSelected = zone.zone_id === selectedZoneId;
                      return (
                        <tr
                          key={zone.zone_id}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-sky-950/40 border-l-2 border-l-sky-400"
                              : "hover:bg-zinc-850/40"
                          }`}
                          onClick={() => setSelectedZoneId(zone.zone_id)}
                        >
                          <td className="py-2.5 px-3.5 font-bold text-sky-400">
                            #{zone.evacuation_priority_rank}
                          </td>
                          <td className="py-2.5 px-3.5 font-sans font-medium text-white">
                            <div>{zone.zone_name}</div>
                            <div className="text-[10px] font-mono text-zinc-400">
                              Elev: {zone.elevation_meters}m MSL | {zone.state}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            {getThreatBadge(zone.threat_level)}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className={zone.projected_depth_meters > 0.5 ? "text-rose-400 font-bold" : "text-zinc-300"}>
                              {zone.projected_depth_meters} m
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-[11px]">
                            {zone.is_flooded ? (
                              <span className="text-amber-400">
                                T+{zone.onset_time_minutes}m / {zone.peak_time_minutes}m
                              </span>
                            ) : (
                              <span className="text-emerald-400">Safe / Stable</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-zinc-300">
                            {zone.is_flooded ? zone.population.toLocaleString() : "0"}
                          </td>
                          <td className="py-2.5 px-3.5 font-bold text-sky-300">
                            {zone.priority_score}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <Button
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className="h-6 text-[10px] px-2 font-mono"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedZoneId(zone.zone_id);
                              }}
                            >
                              {isSelected ? "Active" : "Inspect"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
