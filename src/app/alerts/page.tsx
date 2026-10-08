"use client";

import { Bell, AlertTriangle, ShieldCheck, PhoneCall, Users, Navigation, MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const mockZones = [
  {
    id: "ZONE-A",
    name: "Coastal Estuary South (Mangalore Sector 4)",
    riskLevel: "CRITICAL",
    elevation: "0.8m",
    predictedPeak: "14:30 IST",
    population: 12400,
    evacStatus: "In Progress",
    badgeVariant: "destructive" as const,
  },
  {
    id: "ZONE-B",
    name: "River Confluence Basin (Udupi Lowlands)",
    riskLevel: "HIGH",
    elevation: "1.4m",
    predictedPeak: "16:00 IST",
    population: 8650,
    evacStatus: "Standby Notice",
    badgeVariant: "warning" as const,
  },
  {
    id: "ZONE-C",
    name: "Harbor & Fishery Terminal",
    riskLevel: "MEDIUM",
    elevation: "2.5m",
    predictedPeak: "18:15 IST",
    population: 4300,
    evacStatus: "Advisory Issued",
    badgeVariant: "default" as const,
  },
  {
    id: "ZONE-D",
    name: "Upper Ridge Residential Area",
    riskLevel: "NO_DANGER",
    elevation: "14.2m",
    predictedPeak: "N/A",
    population: 29000,
    evacStatus: "Safe / Shelter Zone",
    badgeVariant: "success" as const,
  },
];

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2.5">
          <Bell className="h-7 w-7 text-amber-500" />
          Alerts & Evacuation Priority Center
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Ranked zone prioritization, critical facility status, and emergency notification broadcasting.
        </p>
      </div>

      {/* Top Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">1 Zone</div>
              <div className="text-xs text-red-600/80 dark:text-red-300/80 font-medium">
                Immediate Evacuation Triggered
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">21,050</div>
              <div className="text-xs text-zinc-500 font-medium">Citizens in Monitored Reach</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">4 Designated</div>
              <div className="text-xs text-emerald-600/80 dark:text-emerald-300/80 font-medium">
                High-Elevation Safe Shelters
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone Priority Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Zone Risk Classification</CardTitle>
            <CardDescription>
              Ranked by AI risk model for evacuation prioritization
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5">
            <PhoneCall className="h-3.5 w-3.5" />
            Broadcast SMS Alert
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="pb-3">Zone ID</th>
                  <th className="pb-3">Location & Region</th>
                  <th className="pb-3">Risk Level</th>
                  <th className="pb-3">Elevation</th>
                  <th className="pb-3">Peak Inundation</th>
                  <th className="pb-3">Population</th>
                  <th className="pb-3">Action Status</th>
                  <th className="pb-3 text-right">Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {mockZones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="py-3.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {zone.id}
                    </td>
                    <td className="py-3.5 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                      {zone.name}
                    </td>
                    <td className="py-3.5">
                      <Badge variant={zone.badgeVariant}>{zone.riskLevel}</Badge>
                    </td>
                    <td className="py-3.5 text-zinc-600 dark:text-zinc-400">{zone.elevation}</td>
                    <td className="py-3.5 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                      {zone.predictedPeak}
                    </td>
                    <td className="py-3.5 text-zinc-600 dark:text-zinc-400">
                      {zone.population.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {zone.evacStatus}
                    </td>
                    <td className="py-3.5 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <Navigation className="h-3 w-3" />
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
