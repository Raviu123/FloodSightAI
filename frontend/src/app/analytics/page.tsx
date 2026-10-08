"use client";

import { useState } from "react";
import { BarChart3, Bot, Send, Sparkles, TrendingUp, HelpCircle, Layers, Cpu, Compass, CheckCircle2, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";

export default function AnalyticsPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "FloodShield AI Intelligence Core online. Inquire about multi-criteria zone risk indices, peak astronomical tide projections, or optimal route clearances.",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userText = inputMessage;
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInputMessage("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `AI Analysis for [${userText}]: Juve Framework calculates Netravati Sector 4 threat index at 86/100 based on +2.8m tidal elevation. Laya Pathfinding confirms Corridor Alpha remains unobstructed with zero submerged bridge crossings.`,
        },
      ]);
    }, 500);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <StatusIndicator status="online" label="Neural Analytics Core Online" />
            <Badge variant="outline" className="text-[10px]">
              Juve & Laya Active
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
            <Cpu className="h-5 w-5 text-emerald-400" />
            AI Decision Intelligence & Neural Forecaster
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Predictive hydrological modeling, time-series anomaly detection, and conversational emergency intelligence.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Decision Models Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  Decision Optimization Pipeline
                </CardTitle>
                <Badge variant="success">Armed</Badge>
              </div>
              <CardDescription className="text-xs">
                Multi-factor risk evaluation matrix integrated with dynamic pathfinding
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">
                      Juve Ranking Model
                    </span>
                    <Badge variant="outline" className="text-[9px]">Priority</Badge>
                  </div>
                  <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                    Evaluates elevation contours, population density, vulnerable infrastructure, and surge speed to establish ranked emergency response queue.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">
                      Laya Route Optimizer
                    </span>
                    <Badge variant="outline" className="text-[9px]">Corridors</Badge>
                  </div>
                  <p className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                    Continuously recalculates safe evacuation transit routes avoiding low-elevation bridges, submerged culverts, and heavy runoff zones.
                  </p>
                </div>
              </div>

              {/* Confidence Telemetry */}
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/40 space-y-2 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Forecasting Model Confidence</span>
                  <span className="font-bold text-emerald-400">94.8%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-[94.8%]" />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 pt-1">
                  <span>Ensemble Variance: +/-0.12m</span>
                  <span>Sensor Sync: 100%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversational Assistant Column (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="flex flex-col h-[480px]">
            <CardHeader className="pb-2.5 border-b border-zinc-850">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-sky-400" />
                  Disaster Intelligence Assistant
                </CardTitle>
                <Badge variant="outline" className="text-[9px]">FastAPI AI</Badge>
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
                    className={`max-w-[88%] rounded-lg p-2.5 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-blue-600 text-white border border-blue-400/40"
                        : "bg-zinc-850 text-zinc-200 border border-zinc-750"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </CardContent>

            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-zinc-850 flex gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Inquire about risk in Zone 01..."
                className="flex-1 rounded-md border border-zinc-750 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
              />
              <Button type="submit" size="sm" className="h-8 px-3 font-mono">
                <Send className="h-3 w-3" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
