"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  ShieldCheck,
  Users,
  Navigation,
  MapPin,
  Send,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { runSimulation, broadcastAlert, checkBackendHealth } from "@/lib/api";
import { SimulationResponse, EnhancedZoneResult, ThreatLevel, BroadcastResponse } from "@/types";
import { useLanguage } from "@/context/LanguageContext";

export default function AlertsPage() {
  const { t } = useLanguage();
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [broadcastingZoneId, setBroadcastingZoneId] = useState<string | null>(null);
  const [broadcastLog, setBroadcastLog] = useState<BroadcastResponse[]>([]);
  const [selectedZone, setSelectedZone] = useState<EnhancedZoneResult | null>(null);
  const [backendStatus, setBackendStatus] = useState<"online" | "offline">("online");

  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendStatus(res.status === "online" ? "online" : "offline");
    });
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await runSimulation({
        tide_level_meters: 2.8,
        rainfall_mm_per_hour: 85,
        forecast_hours: 6,
        cyclone_active: false,
      });
      setSimulationData(res);
      if (res.zones.length > 0) {
        setSelectedZone(res.zones[0]);
      }
    } catch (err) {
      console.error("Alerts page fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBroadcast = async (zone?: EnhancedZoneResult) => {
    const targetZones = zone ? [zone.zone_id] : (simulationData?.zones.map((z) => z.zone_id) || ["ZONE-01"]);
    const title = zone ? zone.alert_headline : "RED ALERT: Coastal Flood Warning";
    const msg = zone ? zone.sms_text : (simulationData?.recommendation || "Emergency alert issued.");

    setBroadcastingZoneId(zone ? zone.zone_id : "ALL");
    try {
      const res = await broadcastAlert({
        zone_ids: targetZones,
        alert_title: title,
        alert_message: msg,
      });
      setBroadcastLog((prev) => [res, ...prev.slice(0, 4)]);
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setTimeout(() => setBroadcastingZoneId(null), 800);
    }
  };

  const getThreatBadge = (level: ThreatLevel | string) => {
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

  const criticalCount = simulationData?.critical_zones_count ?? 0;
  const totalPop = simulationData?.total_population_at_risk ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <StatusIndicator
              status={criticalCount > 0 ? "critical" : "online"}
              label={criticalCount > 0 ? `${criticalCount} ${t.home.criticalRiskZonesTitle}` : t.alerts.activeWarningsBadge}
            />
            <Badge variant="outline" className="text-[10px] font-mono">
              Cell-Broadcast Gateway
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
            <Bell className="h-5 w-5 text-amber-400" />
            {t.alerts.headline}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t.alerts.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 font-mono text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Telemetry</span>
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 hover:bg-rose-500 border border-rose-400/40 gap-1.5 font-mono text-xs cursor-pointer"
            onClick={() => handleBroadcast()}
            disabled={broadcastingZoneId !== null}
          >
            <Send className="h-3.5 w-3.5" />
            <span>{broadcastingZoneId === "ALL" ? "Broadcasting..." : t.alerts.sendBroadcastBtn}</span>
          </Button>
        </div>
      </div>

      {/* Top Telemetry KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <Card className="border-rose-500/30 bg-rose-950/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-850 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-rose-300">
                {String(criticalCount).padStart(2, "0")} {t.common.sectors}
              </div>
              <div className="text-[11px] text-zinc-400 font-sans">
                {t.alerts.evacuateAdvised}
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
              <div className="text-xl font-bold text-white">
                {totalPop.toLocaleString()} {t.common.pax}
              </div>
              <div className="text-[11px] text-zinc-400 font-sans">
                {t.home.populationAtRiskTitle}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-850 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-300">
                06 {t.simulation.safeSheltersTitle}
              </div>
              <div className="text-[11px] text-zinc-400 font-sans">
                {t.simulation.operationalLabel}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Broadcast Feedback Confirmation */}
      {broadcastLog.length > 0 && (
        <div className="p-3.5 rounded-xl border border-emerald-900/60 bg-emerald-950/30 font-mono text-xs space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t.alerts.dispatchedSuccess}</span>
          </div>
          <div className="text-zinc-300 text-[11px]">
            Broadcast ID: <b className="text-white">{broadcastLog[0].broadcast_id}</b> | {t.alerts.recipientEstimateLabel}:{" "}
            <b className="text-emerald-300">{broadcastLog[0].recipient_count.toLocaleString()} {t.common.pax}</b> | Time:{" "}
            <span className="text-zinc-400">{new Date(broadcastLog[0].sent_timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Live Generated SMS Alert Console & Inspector */}
      {selectedZone && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <Card className="border-sky-900/50 bg-zinc-900/90 h-full">
              <CardHeader className="pb-3 border-b border-zinc-850">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
                    {t.simulation.smsAlertTitle}
                  </CardTitle>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {selectedZone.zone_id}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-zinc-400">
                  {t.alerts.broadcastSub}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 font-mono">
                {/* Headline */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/80 space-y-1">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    Alert Headline:
                  </div>
                  <div className="text-sm font-bold text-white font-sans">
                    {selectedZone.alert_headline}
                  </div>
                </div>

                {/* SMS Body */}
                <div className="p-3.5 rounded-lg border border-sky-800/60 bg-sky-950/30 space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-sky-300 uppercase tracking-wider">
                    <span>SMS Body:</span>
                    <span className="text-zinc-400">{selectedZone.sms_text.length} chars</span>
                  </div>
                  <p className="text-xs font-sans text-white leading-relaxed bg-zinc-950/60 p-3 rounded border border-sky-900/40">
                    "{selectedZone.sms_text}"
                  </p>
                </div>

                {/* Action Directives */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                    {t.simulation.recommendedTacticalActionTitle}:
                  </div>
                  <div className="font-sans text-zinc-200">
                    {selectedZone.recommended_action}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-zinc-400 font-sans">
                    {t.alerts.recipientEstimateLabel}: <b>{selectedZone.population.toLocaleString()} {t.common.pax}</b> ({selectedZone.zone_name})
                  </span>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-xs font-mono gap-1 cursor-pointer"
                    onClick={() => handleBroadcast(selectedZone)}
                    disabled={broadcastingZoneId === selectedZone.zone_id}
                  >
                    <Send className="h-3 w-3" />
                    {broadcastingZoneId === selectedZone.zone_id ? "Broadcasting..." : t.alerts.tableDispatch}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Card className="h-full">
              <CardHeader className="pb-3 border-b border-zinc-850">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                  {t.simulation.infrastructureStatusTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedZone.zone_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 font-mono text-xs">
                {/* Safe Shelters */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1.5">
                    {t.simulation.safeSheltersTitle}:
                  </div>
                  {selectedZone.safe_shelters.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedZone.safe_shelters.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded border border-emerald-900/60 bg-emerald-950/20 text-[11px] flex justify-between items-center"
                        >
                          <span className="text-emerald-200 font-sans">{s.name}</span>
                          <span className="text-emerald-400 text-[10px]">
                            {s.elevation_meters}{t.common.meters} MSL ({s.capacity} {t.common.pax})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 italic">{t.simulation.noThreatsDetected}</div>
                  )}
                </div>

                {/* Submerged Road Arteries */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-rose-400 font-bold mb-1.5">
                    {t.simulation.submergedRoadsTitle}:
                  </div>
                  {selectedZone.submerged_roads.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedZone.submerged_roads.map((r, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded border border-rose-900/60 bg-rose-950/20 text-[11px] flex justify-between items-center"
                        >
                          <span className="text-rose-200 font-sans">{r.name}</span>
                          <Badge variant="destructive" className="text-[9px]">
                            {t.simulation.submergedLabel} (+{r.depth_over_road_m}m)
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-400 italic">{t.simulation.noRoadSubmergence}</div>
                  )}
                </div>

                {/* Passable Corridors */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold mb-1.5">
                    {t.map.layerEvacuationRoutes}:
                  </div>
                  {selectedZone.passable_roads.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedZone.passable_roads.map((r, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded border border-zinc-800 bg-zinc-950/40 text-[11px] flex justify-between items-center"
                        >
                          <span className="text-zinc-200 font-sans">{r.name}</span>
                          <span className="text-sky-400 text-[10px]">{t.simulation.passableLabel} ({r.elevation_meters}m MSL)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 italic">{t.simulation.noRoadSubmergence}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Priority Classification Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-850">
          <div>
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-300">
              {t.alerts.priorityEvacuationMatrixTitle}
            </CardTitle>
            <CardDescription className="text-xs">
              {t.alerts.description}
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {t.home.telemetrySyncBadge}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t.alerts.tableRank}</th>
                  <th className="py-3 px-4">{t.alerts.tableZone}</th>
                  <th className="py-3 px-4">{t.alerts.tableRisk}</th>
                  <th className="py-3 px-4">{t.alerts.tableDepth}</th>
                  <th className="py-3 px-4">{t.alerts.tableOnset}</th>
                  <th className="py-3 px-4">{t.home.populationAtRiskTitle}</th>
                  <th className="py-3 px-4">{t.simulation.safeSheltersTitle}</th>
                  <th className="py-3 px-4 text-right">{t.alerts.tableDispatch}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {simulationData?.zones.map((zone) => {
                  const isSelected = selectedZone?.zone_id === zone.zone_id;
                  return (
                    <tr
                      key={zone.zone_id}
                      className={`hover:bg-zinc-850/40 transition-colors cursor-pointer ${
                        isSelected ? "bg-sky-950/30 border-l-2 border-l-sky-400" : ""
                      }`}
                      onClick={() => setSelectedZone(zone)}
                    >
                      <td className="py-3 px-4 font-bold text-sky-400">
                        #{zone.evacuation_priority_rank}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-white">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                          <span>{zone.zone_name}</span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 pl-5">
                          {zone.state} | {zone.elevation_meters}m MSL
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getThreatBadge(zone.threat_level)}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {zone.projected_depth_meters > 0.5 ? (
                          <b className="text-rose-400">{zone.projected_depth_meters} {t.common.meters}</b>
                        ) : (
                          <span>{zone.projected_depth_meters} {t.common.meters}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-amber-400">
                        {zone.is_flooded ? `T+${zone.onset_time_minutes} min` : t.common.safe}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {zone.population.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 text-[11px] font-sans">
                        {zone.safe_shelters[0]?.name || "Designated Shelter"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1 font-mono cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedZone(zone);
                            handleBroadcast(zone);
                          }}
                          disabled={broadcastingZoneId === zone.zone_id}
                        >
                          <Send className="h-3 w-3 text-sky-400" />
                          <span>{broadcastingZoneId === zone.zone_id ? "Sent" : t.alerts.tableDispatch}</span>
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
  );
}
