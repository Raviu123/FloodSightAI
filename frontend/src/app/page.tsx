import Link from "next/link";
import {
  ShieldAlert,
  Sliders,
  Bell,
  BarChart3,
  Waves,
  Map,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FloodMap } from "@/components/map/FloodMap";

const quickStats = [
  {
    title: "Monitored Coastal Zones",
    value: "14",
    change: "Across 4 Indian coastal states",
    icon: Map,
    badgeVariant: "default" as const,
  },
  {
    title: "High Risk Danger Zones",
    value: "2",
    change: "Critical alert in low-lying estuaries",
    icon: AlertTriangle,
    badgeVariant: "destructive" as const,
  },
  {
    title: "Avg. Predicted Peak Tide",
    value: "+3.8m",
    change: "Peak expected in 3h 40m",
    icon: Waves,
    badgeVariant: "warning" as const,
  },
  {
    title: "AI Response Readiness",
    value: "98.4%",
    change: "Automated alert dispatch active",
    icon: CheckCircle2,
    badgeVariant: "success" as const,
  },
];

const featureModules = [
  {
    title: "Interactive Simulation Engine",
    description:
      "Adjust tide levels, rainfall intensity, tsunami/storm surges, and inspect flood propagation in real time.",
    href: "/simulation",
    icon: Sliders,
    cta: "Launch Simulator",
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
  },
  {
    title: "Early Warning & Evacuation",
    description:
      "Priority-ranked evacuation plans, critical infrastructure risk detection (hospitals, shelters), and automated alerts.",
    href: "/alerts",
    icon: Bell,
    cta: "View Evacuation Board",
    color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
  },
  {
    title: "AI Flood Intelligence & Decision Model",
    description:
      "Machine learning risk categorization (Juve / Laya decision models), anomaly detection, and conversational AI assistant.",
    href: "/analytics",
    icon: Cpu,
    cta: "Explore AI Models",
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-blue-200/70 dark:border-blue-900/50 bg-gradient-to-br from-blue-900/10 via-sky-500/5 to-transparent p-6 sm:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Layers className="h-3.5 w-3.5" />
            MapLibre GL JS + AI Coastal Intelligence Platform
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-zinc-950 dark:text-white">
            Predict, Simulate, and Protect{" "}
            <span className="text-blue-600 dark:text-blue-400">
              Vulnerable Coastal Regions
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
            Multi-layer interactive map with satellite, terrain, risk classifications, water bodies,
            and real-time flood simulation overlays for coastal India.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/simulation"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Sliders className="h-4 w-4" />
              Open Simulation Dashboard
            </Link>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Risk Zone Alerts
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:border-blue-500/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {stat.title}
                </CardTitle>
                <div className="rounded-lg p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold text-zinc-950 dark:text-white">
                  {stat.value}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={stat.badgeVariant}>Live</Badge>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {stat.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Live Map Preview Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Live Interactive Coastal Intelligence Map
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Switch base styles (Satellite, 3D Topo, Tactical Dark) and toggle vector layers on the fly.
            </p>
          </div>

          <Link
            href="/simulation"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Full Simulation Controls
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <FloodMap tideLevel={2.4} rainfall={60} heightClassName="h-[550px]" />
      </section>

      {/* Feature Modules Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Core System Modules
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Access simulations, alert feeds, and decision intelligence tools.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {featureModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                className="flex flex-col justify-between hover:shadow-md transition-all duration-200"
              >
                <CardHeader>
                  <div
                    className={`h-11 w-11 rounded-lg flex items-center justify-center mb-3 ${module.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription className="pt-2 leading-relaxed">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href={module.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 group"
                  >
                    {module.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
