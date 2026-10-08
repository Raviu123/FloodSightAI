"use client";

import { Bell, AlertTriangle, ShieldCheck, Radio, Users, Navigation, MapPin, Send, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";

const mockZones = [
  {
    id: "ZONE-CRIT-01",
    name: "Netravati River Confluence (Sector 4)",
    region: "Mangalore Coast",
    riskLevel: "CRITICAL",
    elevation: "0.6m MSL",
    predictedPeak: "14:30 IST",
    population: 14200,
    evacStatus: "Order Dispatched",
    badgeVariant: "destructive" as const,
  },
  {
    id: "ZONE-HIGH-02",
    name: "Ullal Spit & Lowland Estuary",
    region: "Mangalore South",
    riskLevel: "HIGH",
    elevation: "1.2m MSL",
    predictedPeak: "15:15 IST",
    population: 9800,
    evacStatus: "Standby Alert",
    badgeVariant: "warning" as const,
  },
  {
    id: "ZONE-MED-03",
    name: "Bengre Sand Spit & Fishery Dock",
    region: "Port Basin",
    riskLevel: "MEDIUM",
    elevation: "2.1m MSL",
    predictedPeak: "16:45 IST",
    population: 5300,
    evacStatus: "Marine Advisory",
    badgeVariant: "default" as const,
  },
  {
    id: "ZONE-SAFE-04",
    name: "Kadri & Highlands Assembly Area",
    region: "Ridge Sector",
    riskLevel: "NO_DANGER",
    elevation: "18.5m MSL",
    predictedPeak: "Safe Zone",
    population: 34000,
    evacStatus: "Shelter Operational",
    badgeVariant: "success" as const,
  },
];

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <StatusIndicator status="warning" label="High Tidal Warning Active" />
            <Badge variant="outline" className="text-[10px]">
              Broadcast Channel Armed
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
            <Bell className="h-5 w-5 text-amber-400" />
            Emergency Response & Evacuation Command Center
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Multi-criteria zone prioritization, critical facility status, and automated emergency broadcast registry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-rose-600 hover:bg-rose-500 border border-rose-400/40 gap-1.5 font-mono">
            <Send className="h-3.5 w-3.5" />
            Broadcast Red Alert
          </Button>
        </div>
      </div>

      {/* Top Telemetry KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-rose-500/30 bg-rose-950/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-850 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-mono font-bold text-rose-300">01 Sector</div>
              <div className="text-[11px] font-mono text-zinc-400">
                Mandatory Evacuation Triggered
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-zinc-850 border border-zinc-750 text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-mono font-bold text-white">29,300 Pax</div>
              <div className="text-[11px] font-mono text-zinc-400">Total Monitored Lowland Reach</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-850 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-mono font-bold text-emerald-300">04 Facilities</div>
              <div className="text-[11px] font-mono text-zinc-400">Highland Shelters Prepared</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority Classification Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-850">
          <div>
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300">
              Zone Risk & Priority Classification
            </CardTitle>
            <CardDescription className="text-xs">
              Ranked dynamically by the Juve Multi-Criteria Decision Framework
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            Updated Just Now
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Identifier</th>
                  <th className="py-3 px-4">Location Sector</th>
                  <th className="py-3 px-4">Threat Level</th>
                  <th className="py-3 px-4">Elevation</th>
                  <th className="py-3 px-4">Peak Surge</th>
                  <th className="py-3 px-4">At Risk</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {mockZones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-zinc-850/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-sky-400">
                      {zone.id}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{zone.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={zone.badgeVariant}>{zone.riskLevel}</Badge>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{zone.elevation}</td>
                    <td className="py-3 px-4 text-amber-400">
                      {zone.predictedPeak}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {zone.population.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {zone.evacStatus}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 font-mono">
                        <Navigation className="h-3 w-3 text-emerald-400" />
                        Safe Path
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
