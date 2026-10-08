"use client";

import { useState } from "react";
import { BarChart3, Bot, Send, Sparkles, TrendingUp, HelpCircle, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am FloodShield AI assistant. You can ask me about current zone risks, peak tide predictions, or evacuation route optimizations.",
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
          content: `AI Analysis for "${userText}": Based on current simulated tide height (+2.4m) and rainfall (65mm/h), Sector 4 lowlands are at peak threat at 14:30 IST. Evacuation Route #2 is recommended with 0 flood crossings.`,
        },
      ]);
    }, 600);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2.5">
          <BarChart3 className="h-7 w-7 text-emerald-500" />
          AI Intelligence & Decision Models
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Predictive modeling, time-series forecasting, and conversational decision intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AI Decision Models Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  Decision Optimization Pipeline (Juve & Laya Integration)
                </CardTitle>
                <Badge variant="success">Model Active</Badge>
              </div>
              <CardDescription>
                Multi-criteria ranking for resource allocation and evacuation safety
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Juve Decision Framework
                    </span>
                    <Badge variant="outline">Priority Engine</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Evaluates elevation, population density, vulnerable infrastructure, and water encroachment speed to assign priority weights.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Laya Route Optimizer
                    </span>
                    <Badge variant="outline">Pathfinding</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Dynamically recalculates safe transit routes avoiding low-elevation bridges and flooded roadways.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Model Confidence & Anomaly Detection
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Forecast Confidence</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">94.2%</span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full w-[94%]"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversational AI Assistant */}
        <div className="space-y-6">
          <Card className="flex flex-col h-[500px]">
            <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                AI Emergency Assistant
              </CardTitle>
              <CardDescription className="text-xs">
                Ask natural language queries about flood risks
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </CardContent>

            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about risk in Zone A..."
                className="flex-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button type="submit" size="sm" className="h-8 px-3">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
