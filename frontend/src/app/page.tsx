"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Sliders,
  Bell,
  Waves,
  MapPin,
  ArrowRight,
  AlertTriangle,
  Cpu,
  Layers,
  Activity,
  ArrowUpRight,
  Users,
  Radio,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { FloodMap } from "@/components/map/FloodMap";
import { runSimulation, generateSITREP, checkBackendHealth } from "@/lib/api";
import { SimulationResponse, SITREPReport, ThreatLevel } from "@/types";
import { useLanguage } from "@/context/LanguageContext";
import { formatSitrep } from "@/locales";

export default function Home() {
  const { t } = useLanguage();
  const [tideLevel, setTideLevel] = useState<number>(2.6);
  const [rainfall, setRainfall] = useState<number>(65);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [sitrepData, setSitrepData] = useState<SITREPReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendStatus, setBackendStatus] = useState<"online" | "offline">("online");

  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendStatus(res.status === "online" ? "online" : "offline");
    });
  }, []);

  // Fetch simulation and SITREP on load and slider change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const input = {
      tide_level_meters: tideLevel,
      rainfall_mm_per_hour: rainfall,
      forecast_hours: 6,
    };

    Promise.all([runSimulation(input), generateSITREP(input)])
      .then(([simRes, sitrepRes]) => {
        if (isMounted) {
          setSimulationData(simRes);
          setSitrepData(sitrepRes);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tideLevel, rainfall]);

  const featureModules = [
    {
      title: t.home.modules.simulationTitle,
      description: t.home.modules.simulationDesc,
      href: "/simulation",
      icon: Sliders,
      cta: t.home.modules.simulationCta,
      tag: t.home.modules.simulationTag,
    },
    {
      title: t.home.modules.alertsTitle,
      description: t.home.modules.alertsDesc,
      href: "/alerts",
      icon: Bell,
      cta: t.home.modules.alertsCta,
      tag: t.home.modules.alertsTag,
    },
    {
      title: t.home.modules.analyticsTitle,
      description: t.home.modules.analyticsDesc,
      href: "/analytics",
      icon: Cpu,
      cta: t.home.modules.analyticsCta,
      tag: t.home.modules.analyticsTag,
    },
  ];

  const getThreatBadge = (level?: ThreatLevel | string) => {
    switch (level) {
      case "CRITICAL":
        return <Badge variant="destructive">{t.common.critical}</Badge>;
      case "HIGH":
        return <Badge variant="warning">{t.common.high}</Badge>;
      case "MEDIUM":
        return <Badge variant="default">{t.common.moderate}</Badge>;
      default:
        return <Badge variant="success">{t.common.safe}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Telemetry Header */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-950/80 to-zinc-950 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusIndicator
                status={backendStatus === "online" ? "online" : "warning"}
                label={backendStatus === "online" ? t.home.telemetryOnline : t.home.telemetryLocal}
              />
              <Badge variant="outline" className="text-[10px] font-mono">
                {t.home.versionBadge}
              </Badge>
              {simulationData && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-[10px] font-mono text-zinc-300">
                  <Activity className="h-3 w-3 text-sky-400" />
                  <span>
                    {t.home.threatIndex}: <b className="text-white">{simulationData.threat_index}/100</b>
                  </span>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white font-mono uppercase">
              {t.home.headline}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {t.home.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/simulation"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-semibold tracking-tight transition-all border border-blue-400/40 shadow-sm"
            >
              <Sliders className="h-4 w-4" />
              <span>{t.home.simulationBtn}</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </Link>

            <Link
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-850/80 hover:bg-zinc-800 text-zinc-200 px-4 py-2.5 text-xs font-semibold tracking-tight transition-all"
            >
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span>{t.home.activeHazardBtn}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Simulation Telemetry Sliders Bar */}
      <section className="p-4 rounded-xl border border-zinc-850 bg-zinc-900/70 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
              {t.home.liveModelerTitle}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-xl">
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">{t.home.tideLevelLabel}</span>
                <span className="text-sky-400 font-bold">+{tideLevel.toFixed(1)}{t.common.meters} MSL</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.1"
                value={tideLevel}
                aria-label={t.home.tideLevelLabel}
                onChange={(e) => setTideLevel(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
              />
            </div>
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">{t.home.rainfallLabel}</span>
                <span className="text-sky-400 font-bold">{rainfall} mm/h</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={rainfall}
                aria-label={t.home.rainfallLabel}
                onChange={(e) => setRainfall(parseInt(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Telemetry Counters Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono">
        {/* Total Population At Risk */}
        <Card className="hover:border-zinc-700 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {t.home.populationAtRiskTitle}
            </CardTitle>
            <div className="rounded-md p-1.5 bg-zinc-800/80 text-rose-400 border border-zinc-700/60">
              <Users className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-black text-white tracking-tight">
              {simulationData ? simulationData.total_population_at_risk.toLocaleString() : "..."}{" "}
              <span className="text-xs text-zinc-500 font-normal">{t.common.pax}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={simulationData && simulationData.total_population_at_risk > 0 ? "destructive" : "success"}>
                {simulationData && simulationData.total_population_at_risk > 0
                  ? t.home.exposureDetectedBadge
                  : t.home.safeBufferBadge}
              </Badge>
              <span className="text-[11px] text-zinc-400 truncate font-sans">
                {t.home.monitoredLowlands}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Inundated Area */}
        <Card className="hover:border-zinc-700 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {t.home.inundatedAreaTitle}
            </CardTitle>
            <div className="rounded-md p-1.5 bg-zinc-800/80 text-sky-400 border border-zinc-700/60">
              <Waves className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-black text-white tracking-tight">
              {simulationData ? `${simulationData.estimated_inundated_area_sq_km}` : "..."}{" "}
              <span className="text-xs text-zinc-500 font-normal">{t.common.sqKm}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t.home.terrainOverflowBadge}</Badge>
              <span className="text-[11px] text-zinc-400 truncate font-sans">
                {t.home.bathymetricIngress}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Critical Zones Count */}
        <Card className="hover:border-zinc-700 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {t.home.criticalRiskZonesTitle}
            </CardTitle>
            <div className="rounded-md p-1.5 bg-zinc-800/80 text-amber-400 border border-zinc-700/60">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-black text-white tracking-tight">
              {simulationData ? `${String(simulationData.critical_zones_count).padStart(2, "0")}` : "..."}{" "}
              <span className="text-xs text-zinc-500 font-normal">
                / {simulationData?.zones.length ?? 6} {t.common.sectors}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getThreatBadge(simulationData?.overall_risk)}
              <span className="text-[11px] text-zinc-400 truncate font-sans">
                {t.home.breachingHazardLimits}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Coastal Monitored State Grid */}
        <Card className="hover:border-zinc-700 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {t.home.monitoredEstuariesTitle}
            </CardTitle>
            <div className="rounded-md p-1.5 bg-zinc-800/80 text-emerald-400 border border-zinc-700/60">
              <MapPin className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-black text-white tracking-tight">
              06 <span className="text-xs text-zinc-500 font-normal">{t.common.sectors}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">{t.home.telemetrySyncBadge}</Badge>
              <span className="text-[11px] text-zinc-400 truncate font-sans">
                {t.home.coastalCoverageDesc}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Active Tactical Directive Recommendation Banner */}
      {(() => {
        const localized = formatSitrep(sitrepData, simulationData, t);
        return (
          <section className="rounded-xl border border-blue-900/60 bg-blue-950/30 p-5 font-mono space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <Radio className="h-4 w-4 animate-pulse" />
                <span>{t.home.tacticalDirectiveTitle}</span>
              </div>
              <Badge variant="outline" className="text-[9px]">
                {t.home.sitrepBadge}
              </Badge>
            </div>

            <div className="text-xs sm:text-sm text-zinc-200 font-sans leading-relaxed">
              {localized.executiveSummary}
            </div>

            {localized.directives.length > 0 && (
              <div className="pt-2 border-t border-blue-900/50 space-y-1.5 text-xs text-zinc-300">
                <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold">
                  {t.home.immediateDirectivesTitle}
                </div>
                <ul className="space-y-1 list-disc list-inside font-sans text-xs">
                  {localized.directives.map((dir, idx) => (
                    <li key={idx} className="text-zinc-200">
                      {dir}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })()}

      {/* Geospatial Map Canvas */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight uppercase font-mono">
                {t.home.geospatialFeedTitle}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {t.home.geospatialFeedDesc}
            </p>
          </div>

          <Link
            href="/simulation"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            <span>{t.home.fullStudioLink}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <FloodMap tideLevel={tideLevel} rainfall={rainfall} heightClassName="h-[560px]" />
      </section>

      {/* Core Intelligence Modules */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight uppercase font-mono">
            {t.home.missionControlTitle}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t.home.missionControlDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {featureModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                className="flex flex-col justify-between hover:border-zinc-700 transition-all duration-200"
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-950/60 border border-blue-800/60 text-sky-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className="text-[9px]">
                      {module.tag}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold">{module.title}</CardTitle>
                  <CardDescription className="pt-1.5">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href={module.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors group"
                  >
                    <span>{module.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
