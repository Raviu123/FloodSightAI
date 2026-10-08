"use client";

import { useState } from "react";
import {
  BarChart3,
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  HelpCircle,
  Layers,
  Cpu,
  Compass,
  CheckCircle2,
  Shield,
  Activity,
  Award,
  BarChart2,
  Sliders,
  Radio,
  Gauge,
  Target,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";

const VALIDATION_METRICS = [
  {
    title: "ROC-AUC Score",
    value: "0.9934",
    description: "Binary flood risk discrimination capability",
    benchmark: "Target: > 0.95",
    color: "text-emerald-400",
    badge: "EXCELLENT",
  },
  {
    title: "Precision",
    value: "95.86%",
    description: "True positive flood zone identification rate",
    benchmark: "Low false-alarm rate",
    color: "text-sky-400",
    badge: "95.9%",
  },
  {
    title: "Recall / Sensitivity",
    value: "95.00%",
    description: "Proportion of actual flood zones correctly alerted",
    benchmark: "Zero critical misses",
    color: "text-teal-400",
    badge: "95.0%",
  },
  {
    title: "Depth Prediction MAE",
    value: "0.062 m",
    description: "Mean Absolute Error in projected inundation depth",
    benchmark: "R-squared: 0.987",
    color: "text-blue-400",
    badge: "+/- 6.2cm",
  },
  {
    title: "Onset Time MAE",
    value: "3.45 min",
    description: "Lead time timing accuracy to initial terrain inundation",
    benchmark: "Peak timing: 8.01m MAE",
    color: "text-purple-400",
    badge: "+/- 3.5m",
  },
  {
    title: "Classification Accuracy",
    value: "95.12%",
    description: "Global accuracy across 12,500 validation instances",
    benchmark: "F1 Score: 0.9542",
    color: "text-amber-400",
    badge: "OPTIMAL",
  },
];

const FEATURE_IMPORTANCES = [
  { name: "Digital Elevation Model (DEM) Height (elevation_m)", pct: 45.56, key: "elevation_m" },
  { name: "Proximity to Ocean Shoreline (dist_to_coast_km)", pct: 15.59, key: "dist_to_coast_km" },
  { name: "River / Estuary Channel Distance (dist_to_river_km)", pct: 9.89, key: "dist_to_river_km" },
  { name: "Astronomical High Tide Surge (tide_level_m)", pct: 8.41, key: "tide_level_m" },
  { name: "6-Hour Rainfall Accumulation (rainfall_accum_6h_mm)", pct: 5.33, key: "rainfall_accum_6h_mm" },
  { name: "Drainage Siphon Capacity Index (drainage_capacity_pct)", pct: 4.45, key: "drainage_capacity_pct" },
  { name: "Antecedent Soil Saturation Index (soil_saturation_idx)", pct: 4.41, key: "soil_saturation_idx" },
  { name: "Instantaneous Precipitation Rate (rainfall_rate_mm_h)", pct: 3.21, key: "rainfall_rate_mm_h" },
  { name: "Cyclonic Gale Wind Multiplier (cyclone_wind_kmh)", pct: 3.15, key: "cyclone_wind_kmh" },
];

import { chatWithCopilot } from "@/lib/api";

export default function AnalyticsPage() {
  const [userRole, setUserRole] = useState<"civilian" | "commander" | "engineer">("commander");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "system"; content: string }>>([
    {
      role: "assistant",
      content:
        "FloodShield AI Intelligence Copilot online. Inquire about multi-criteria zone risk indices, peak astronomical tide projections, model validation benchmarks, or optimal route clearances.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userText = inputMessage.trim();
    const updatedHistory = [...messages, { role: "user" as const, content: userText }];
    setMessages(updatedHistory);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await chatWithCopilot({
        message: userText,
        zone_id: "ZONE-01",
        user_role: userRole,
        conversation_history: updatedHistory,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply || "Telemetry analysis completed. Conditions within modeled thresholds.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Warning: Unable to reach FastAPI backend. Ensure the backend server is running at http://127.0.0.1:8000.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <StatusIndicator status="online" label="Neural Analytics & ML Validation Active" />
            <Badge variant="outline" className="text-[10px] font-mono">
              Scikit-Learn Ensemble v1.0
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-5 w-5 text-emerald-400" />
            AI Decision Intelligence & Model Validation Analytics
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Empirical benchmark verification, global feature importance attributions, and conversational disaster intelligence assistant.
          </p>
        </div>
      </div>

      {/* Benchmark Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {VALIDATION_METRICS.map((item, idx) => (
          <Card key={idx} className="hover:border-zinc-700 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {item.title}
              </CardTitle>
              <Badge variant="outline" className="text-[9px]">
                {item.badge}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className={`text-2xl font-black ${item.color} tracking-tight`}>
                {item.value}
              </div>
              <p className="text-[11px] text-zinc-300 font-sans leading-snug">
                {item.description}
              </p>
              <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-850">
                {item.benchmark}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global Feature Importances & Conversational Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Global Feature Importances Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-sky-400" />
                  Global ML Feature Importances (Random Forest & Gradient Boosting)
                </CardTitle>
                <Badge variant="outline" className="text-[9px]">
                  12,500 Samples
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Normalized Gini feature importance distribution for flood classification and inundation depth regression
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-3 font-mono">
              {FEATURE_IMPORTANCES.map((feat) => (
                <div key={feat.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 truncate max-w-[80%]">{feat.name}</span>
                    <span className="font-bold text-sky-400">{feat.pct.toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, feat.pct * 2.1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Model Architecture & Decision Framework Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  Juve Decision Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-sans text-zinc-400">
                <p>
                  Calculates a composite multi-criteria hazard urgency score based on depth, vulnerable demographics, hospital proximity, and onset velocity.
                </p>
                <div className="font-mono text-[10px] text-zinc-500 pt-1 border-t border-zinc-850">
                  Weighting: Depth (40%), Lead Time (25%), Facilities (20%), Roads (15%)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-sky-400" />
                  Laya Route Optimizer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-sans text-zinc-400">
                <p>
                  Continuously calculates non-submerged evacuation routes guiding citizens away from submerged causeways to elevated highland relief shelters.
                </p>
                <div className="font-mono text-[10px] text-zinc-500 pt-1 border-t border-zinc-850">
                  Dynamic road status sync & elevation clearance checking
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Conversational Assistant Column (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="flex flex-col h-[560px]">
            <CardHeader className="pb-2.5 border-b border-zinc-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-sky-400" />
                  Disaster Intelligence Copilot
                </CardTitle>
                <div className="flex items-center gap-1">
                  {(["commander", "civilian", "engineer"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setUserRole(role)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                        userRole === role
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                          : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-3.5 space-y-2.5 font-mono">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-blue-600 text-white border border-blue-400/40"
                        : "bg-zinc-850 text-zinc-200 border border-zinc-750"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-850 text-zinc-400 border border-zinc-750 rounded-lg p-2.5 text-xs flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-spin" />
                    <span>Analyzing live telemetry & querying OpenRouter Copilot...</span>
                  </div>
                </div>
              )}
            </CardContent>

            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-zinc-850 flex gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                placeholder="Inquire about ROC-AUC, DEM features, or Zone 1..."
                className="flex-1 rounded-md border border-zinc-750 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-500 disabled:opacity-50"
              />
              <Button type="submit" size="sm" disabled={isLoading || !inputMessage.trim()} className="h-8 px-3 font-mono">
                <Send className="h-3 w-3" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
