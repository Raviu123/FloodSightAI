import Link from "next/link";
import {
  ShieldAlert,
  Sliders,
  Bell,
  BarChart3,
  Waves,
  MapPin,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  ArrowUpRight,
  Compass,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { FloodMap } from "@/components/map/FloodMap";

const quickStats = [
  {
    title: "Monitored Estuary Sectors",
    value: "14",
    detail: "4 Indian Maritime States",
    icon: MapPin,
    badgeText: "ACTIVE",
    badgeVariant: "default" as const,
  },
  {
    title: "Critical Inundation Risk",
    value: "02",
    detail: "Netravati & Vembanad lowlands",
    icon: AlertTriangle,
    badgeText: "HIGH ALERT",
    badgeVariant: "destructive" as const,
  },
  {
    title: "Predicted Astronomical Tide",
    value: "+3.8m",
    detail: "Peak horizon in +03h 40m",
    icon: Waves,
    badgeText: "SPRING TIDE",
    badgeVariant: "warning" as const,
  },
  {
    title: "AI Evacuation Readiness",
    value: "98.4%",
    detail: "Juve & Laya routing armed",
    icon: CheckCircle2,
    badgeText: "OPTIMAL",
    badgeVariant: "success" as const,
  },
];

const featureModules = [
  {
    title: "Simulation & Surge Engine",
    description:
      "Adjust tidal surge parameters, rainfall rates, and cyclonic force to model real-time coastal flood propagation on vector terrain.",
    href: "/simulation",
    icon: Sliders,
    cta: "Launch Simulation Console",
    tag: "HYDROLOGICAL ENGINE",
  },
  {
    title: "Early Warning & Evacuation Dispatch",
    description:
      "Priority-ranked evacuation matrix, multi-channel SMS alert dispatching, and critical shelter capacity allocation.",
    href: "/alerts",
    icon: Bell,
    cta: "Open Evacuation Board",
    tag: "RESPONSE DISPATCH",
  },
  {
    title: "AI Decision Intelligence",
    description:
      "Juve multi-criteria ranking model, Laya dynamic evacuation route solver, and natural-language disaster intelligence assistant.",
    href: "/analytics",
    icon: Cpu,
    cta: "Access Decision Model",
    tag: "NEURAL ANALYTICS",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* Top Telemetry Header */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-950/80 to-zinc-950 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2">
              <StatusIndicator status="online" label="Operational Grid Online" />
              <Badge variant="outline" className="text-[10px]">
                Coastal Sentinel v0.1
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Coastal Flood Intelligence & Early Warning System
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Multi-spectral geospatial platform engineered for tidal surge forecasting,
              low-elevation terrain vulnerability analysis, and autonomous AI emergency response routing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/simulation"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-semibold tracking-tight transition-all border border-blue-400/40 shadow-sm"
            >
              <Sliders className="h-4 w-4" />
              <span>Simulation Console</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </Link>

            <Link
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-850/80 hover:bg-zinc-800 text-zinc-200 px-4 py-2.5 text-xs font-semibold tracking-tight transition-all"
            >
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span>Active Hazard Matrix</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Real-Time Telemetry Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:border-zinc-700 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className="rounded-md p-1.5 bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                  <Icon className="h-3.5 w-3.5 text-sky-400" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="text-2xl font-mono font-black text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Badge variant={stat.badgeVariant}>{stat.badgeText}</Badge>
                  <span className="text-[11px] text-zinc-400 truncate">
                    {stat.detail}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Geospatial Map Canvas */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight uppercase font-mono">
                Live Geospatial Intelligence Feed
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Vector terrain overlays, bathymetric water channels, and dynamic surge simulation.
            </p>
          </div>

          <Link
            href="/simulation"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            <span>Interactive Controls</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <FloodMap tideLevel={2.6} rainfall={65} heightClassName="h-[580px]" />
      </section>

      {/* Core Intelligence Modules */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight uppercase font-mono">
            Mission Control Subsystems
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hydrological modeling, automated alert dispatch, and neural decision trees.
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
