"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    broadcastAlert,
    checkBackendHealth,
    fetchSMSGatewayStatus,
    fetchSMSLogs,
    runSimulation,
    sendSingleSMS,
} from "@/lib/api";
import { EnhancedZoneResult, SimulationResponse, ThreatLevel } from "@/types";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    MapPin,
    Phone,
    Radio,
    RefreshCw,
    Send,
    ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function AlertsPage() {
    // Model Predictions & Telemetry State
    const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [backendStatus, setBackendStatus] = useState<"online" | "offline">("online");
    const [gatewayStatus, setGatewayStatus] = useState<any | null>(null);

    // Selected Zone & SMS Inspector State
    const [selectedZone, setSelectedZone] = useState<EnhancedZoneResult | null>(null);
    const [customSmsBody, setCustomSmsBody] = useState<string>("");
    const [broadcastingTarget, setBroadcastingTarget] = useState<string | null>(null);
    const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);

    // Automatic Critical Dispatch Tracking
    const [autoDispatchTriggered, setAutoDispatchTriggered] = useState<boolean>(false);
    const [autoDispatchTime, setAutoDispatchTime] = useState<string | null>(null);

    // Single Phone Test Dispatcher State
    const [testPhone, setTestPhone] = useState<string>("+919876543210");
    const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
    const [testStatusMsg, setTestStatusMsg] = useState<string | null>(null);

    // Initial Fetch & Health Check
    const fetchPredictionData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [backendRes, gwRes, logsRes, simRes] = await Promise.all([
                checkBackendHealth(),
                fetchSMSGatewayStatus(),
                fetchSMSLogs(),
                runSimulation({
                    tide_level_meters: 2.8,
                    rainfall_mm_per_hour: 85,
                    forecast_hours: 6,
                    cyclone_active: false,
                }),
            ]);

            setBackendStatus(backendRes.status === "online" ? "online" : "offline");
            if (gwRes) setGatewayStatus(gwRes);
            if (logsRes?.logs) setBroadcastLogs(logsRes.logs.slice(0, 6));

            setSimulationData(simRes);
            if (simRes.zones.length > 0) {
                const firstZone = simRes.zones[0];
                setSelectedZone(firstZone);
                setCustomSmsBody(firstZone.sms_text || "");
            }

            // Check if model returned any CRITICAL threat zones requiring automatic emergency dispatch
            const criticalZones = simRes.zones.filter(z => z.threat_level === "CRITICAL");
            if (criticalZones.length > 0) {
                setAutoDispatchTriggered(true);
                setAutoDispatchTime(new Date().toLocaleTimeString());
            } else {
                setAutoDispatchTriggered(false);
            }
        } catch (err) {
            console.error("Alerts page fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPredictionData();
    }, [fetchPredictionData]);

    // Update custom SMS body when selected zone changes
    const handleSelectZone = (zone: EnhancedZoneResult) => {
        setSelectedZone(zone);
        setCustomSmsBody(zone.sms_text || "");
    };

    // Categorized Zone Collections derived from Model Classifications
    const dangerZones =
        simulationData?.zones.filter(z => z.threat_level === "CRITICAL" || z.threat_level === "HIGH") || [];
    const neutralZones = simulationData?.zones.filter(z => z.threat_level === "MEDIUM") || [];
    const safeZones =
        simulationData?.zones.filter(z => z.threat_level === "LOW" || z.threat_level === "NO_DANGER") || [];

    const dangerPopulation = dangerZones.reduce((acc, z) => acc + z.population, 0);
    const neutralPopulation = neutralZones.reduce((acc, z) => acc + z.population, 0);
    const totalPopulationAtRisk = simulationData?.total_population_at_risk || 0;

    // Dispatch Targeted SMS Broadcast across Danger Zones
    const handleBroadcastDangerZones = async () => {
        if (dangerZones.length === 0) return;
        setBroadcastingTarget("DANGER_ZONES");
        const dangerZoneIds = dangerZones.map(z => z.zone_id);
        const title = "CRITICAL EMERGENCY EVACUATION WARNING";
        const message = `RED ALERT: ${dangerZones.length} coastal zone(s) classified as DANGER. Ingress expected within 25-40 min. Move to designated high ground shelters immediately.`;

        try {
            const res = await broadcastAlert({
                zone_ids: dangerZoneIds,
                alert_title: title,
                alert_message: message,
                target_channels: ["sms", "push_notification", "cell_broadcast"],
            });
            setBroadcastLogs(prev => [res, ...prev.slice(0, 5)]);
        } catch (err) {
            console.error("Danger zone broadcast failed:", err);
        } finally {
            setTimeout(() => setBroadcastingTarget(null), 800);
        }
    };

    // Dispatch Targeted SMS Broadcast across Neutral/Advisory Zones
    const handleBroadcastNeutralZones = async () => {
        if (neutralZones.length === 0) return;
        setBroadcastingTarget("NEUTRAL_ZONES");
        const neutralZoneIds = neutralZones.map(z => z.zone_id);
        const title = "NEUTRAL ZONE WATERLOGGING ADVISORY";
        const message = `ADVISORY: ${neutralZones.length} zone(s) under moderate waterlogging alert. Avoid low-lying coastal causeways and monitor estuary water levels.`;

        try {
            const res = await broadcastAlert({
                zone_ids: neutralZoneIds,
                alert_title: title,
                alert_message: message,
                target_channels: ["sms", "push_notification"],
            });
            setBroadcastLogs(prev => [res, ...prev.slice(0, 5)]);
        } catch (err) {
            console.error("Neutral zone broadcast failed:", err);
        } finally {
            setTimeout(() => setBroadcastingTarget(null), 800);
        }
    };

    // Dispatch Global Regional Broadcast
    const handleBroadcastAll = async () => {
        if (!simulationData || simulationData.zones.length === 0) return;
        setBroadcastingTarget("ALL");
        const allZoneIds = simulationData.zones.map(z => z.zone_id);
        const title = "REGIONAL COASTAL SURGE BROADCAST";
        const message =
            simulationData.recommendation ||
            "Emergency surge broadcast dispatched across all monitored coastal sectors.";

        try {
            const res = await broadcastAlert({
                zone_ids: allZoneIds,
                alert_title: title,
                alert_message: message,
                target_channels: ["sms", "push_notification", "siren"],
            });
            setBroadcastLogs(prev => [res, ...prev.slice(0, 5)]);
        } catch (err) {
            console.error("Global broadcast failed:", err);
        } finally {
            setTimeout(() => setBroadcastingTarget(null), 800);
        }
    };

    // Dispatch Single Selected Zone Custom SMS
    const handleDispatchSelectedZoneSMS = async () => {
        if (!selectedZone) return;
        setBroadcastingTarget(selectedZone.zone_id);
        try {
            const res = await broadcastAlert({
                zone_ids: [selectedZone.zone_id],
                alert_title: selectedZone.alert_headline || `ALERT: ${selectedZone.zone_name}`,
                alert_message: customSmsBody || selectedZone.sms_text,
                target_channels: ["sms", "push_notification"],
            });
            setBroadcastLogs(prev => [res, ...prev.slice(0, 5)]);
        } catch (err) {
            console.error("Single zone SMS dispatch failed:", err);
        } finally {
            setTimeout(() => setBroadcastingTarget(null), 800);
        }
    };

    // Dispatch Single Test SMS to Custom Phone Number
    const handleSendSingleTestSMS = async () => {
        if (!testPhone.trim() || !selectedZone) return;
        setIsSendingTest(true);
        setTestStatusMsg(null);
        try {
            const res = await sendSingleSMS(
                testPhone.trim(),
                `[${selectedZone.zone_id}] ${customSmsBody || selectedZone.sms_text}`,
            );
            if (res) {
                setTestStatusMsg(`SMS dispatched to ${testPhone} (Status: ${res.status || "SENT"})`);
            } else {
                setTestStatusMsg(`Simulated SMS dispatched to ${testPhone}`);
            }
        } catch (err: any) {
            setTestStatusMsg(`Test SMS failed: ${err.message || "Gateway error"}`);
        } finally {
            setIsSendingTest(false);
        }
    };

    const getThreatBadge = (level: ThreatLevel | string) => {
        switch (level) {
            case "CRITICAL":
                return (
                    <Badge variant="destructive" className="font-mono text-[10px]">
                        CRITICAL DANGER
                    </Badge>
                );
            case "HIGH":
                return (
                    <Badge className="bg-amber-600 hover:bg-amber-500 text-white font-mono text-[10px]">
                        HIGH HAZARD
                    </Badge>
                );
            case "MEDIUM":
                return (
                    <Badge className="bg-sky-600 hover:bg-sky-500 text-white font-mono text-[10px]">
                        NEUTRAL ADVISORY
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px]">SAFE</Badge>
                );
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                    <div className="flex items-center gap-2"></div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2 font-mono uppercase">
                        Emergency Response & Evacuation Dispatch Board
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchPredictionData}
                        className="gap-1.5 font-mono text-xs border-zinc-800 bg-zinc-900 text-zinc-300"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        Re-Fetch
                    </Button>
                    <Button
                        size="sm"
                        className="bg-rose-600 hover:bg-rose-500 border border-rose-400/40 gap-1.5 font-mono text-xs text-white"
                        onClick={handleBroadcastAll}
                        disabled={broadcastingTarget !== null || isLoading}
                    >
                        <Radio className="h-3.5 w-3.5" />
                        {broadcastingTarget === "ALL" ? "Broadcasting..." : "Broadcast"}
                    </Button>
                </div>
            </div>

            <Card className="border-sky-900/40 bg-zinc-950/80 backdrop-blur-md rounded-xl overflow-hidden shadow-xl">
                {/* Console Header */}
                <CardHeader className="py-2.5 px-4 border-b border-zinc-850 bg-zinc-950/90 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Radio className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                        <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-sky-200">
                            Emergency SMS Broadcast Engine
                        </CardTitle>
                    </div>
                </CardHeader>

                <CardContent className="p-3.5 space-y-3 font-mono text-xs">
                    {/* 1. Target Audience Cards */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                                <span className="text-sky-400">01.</span> Target Audience & Priority Layer
                            </span>
                            <span className="text-zinc-500">
                                Est. Reach:{" "}
                                <b className="text-zinc-200 font-sans">
                                    {broadcastingTarget === "DANGER_ZONES"
                                        ? dangerPopulation.toLocaleString()
                                        : broadcastingTarget === "NEUTRAL_ZONES"
                                          ? neutralPopulation.toLocaleString()
                                          : broadcastingTarget === "ALL_ZONES"
                                            ? totalPopulationAtRisk.toLocaleString()
                                            : selectedZone
                                              ? selectedZone.population.toLocaleString()
                                              : "0"}
                                </b>{" "}
                                Citizens
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {/* Danger Target */}
                            <button
                                type="button"
                                onClick={() => {
                                    setBroadcastingTarget("DANGER_ZONES");
                                    setSelectedZone(null);
                                }}
                                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                    broadcastingTarget === "DANGER_ZONES"
                                        ? "border-rose-500/80 bg-rose-950/30 text-rose-200 shadow-sm shadow-rose-950"
                                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                                        <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Danger Zones
                                    </span>
                                    <Badge variant="destructive" className="font-mono text-[9px] px-1 py-0 h-4">
                                        {dangerZones.length} ZONES
                                    </Badge>
                                </div>
                                <div className="text-sm font-bold text-white font-sans mt-1 tabular-nums">
                                    {dangerPopulation.toLocaleString()}{" "}
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">pax</span>
                                </div>
                                <p className="text-[10px] text-rose-300/70 mt-0.5 truncate">
                                    Critical/High • Imminent Inundation
                                </p>
                            </button>

                            {/* Neutral Target */}
                            <button
                                type="button"
                                onClick={() => {
                                    setBroadcastingTarget("NEUTRAL_ZONES");
                                    setSelectedZone(null);
                                }}
                                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                    broadcastingTarget === "NEUTRAL_ZONES"
                                        ? "border-sky-500/80 bg-sky-950/30 text-sky-200 shadow-sm shadow-sky-950"
                                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                                        <AlertTriangle className="h-3.5 w-3.5 text-sky-400" /> Advisory Zones
                                    </span>
                                    <Badge className="bg-sky-600/80 text-white font-mono text-[9px] px-1 py-0 h-4">
                                        {neutralZones.length} ZONES
                                    </Badge>
                                </div>
                                <div className="text-sm font-bold text-white font-sans mt-1 tabular-nums">
                                    {neutralPopulation.toLocaleString()}{" "}
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">pax</span>
                                </div>
                                <p className="text-[10px] text-sky-300/70 mt-0.5 truncate">
                                    Moderate Risk • Waterlogging Alert
                                </p>
                            </button>

                            {/* Regional Target */}
                            <button
                                type="button"
                                onClick={() => {
                                    setBroadcastingTarget("ALL_ZONES");
                                    setSelectedZone(null);
                                }}
                                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                    broadcastingTarget === "ALL_ZONES"
                                        ? "border-emerald-500/80 bg-emerald-950/30 text-emerald-200 shadow-sm shadow-emerald-950"
                                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Regional All
                                    </span>
                                    <Badge className="bg-emerald-600/80 text-white font-mono text-[9px] px-1 py-0 h-4">
                                        {simulationData?.zones.length || 0} ZONES
                                    </Badge>
                                </div>
                                <div className="text-sm font-bold text-white font-sans mt-1 tabular-nums">
                                    {totalPopulationAtRisk.toLocaleString()}{" "}
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">total</span>
                                </div>
                                <p className="text-[10px] text-emerald-300/70 mt-0.5 truncate">
                                    All Sectors • General Advisory
                                </p>
                            </button>

                            {/* Specific Zone Target */}
                            <button
                                type="button"
                                disabled={!selectedZone}
                                onClick={() => selectedZone && setBroadcastingTarget(selectedZone.zone_id)}
                                className={`p-2.5 rounded-lg border text-left transition-all ${
                                    !selectedZone
                                        ? "border-zinc-850 bg-zinc-950/20 text-zinc-600 cursor-not-allowed opacity-40"
                                        : broadcastingTarget === selectedZone?.zone_id
                                          ? "border-amber-500/80 bg-amber-950/30 text-amber-200 shadow-sm shadow-amber-950 cursor-pointer"
                                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300 truncate pr-1">
                                        <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                        {selectedZone ? selectedZone.zone_id : "Single Sector"}
                                    </span>
                                    {selectedZone && (
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] px-1 py-0 h-4 border-amber-500/50 text-amber-300"
                                        >
                                            SELECTED
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm font-bold text-white font-sans mt-1 truncate">
                                    {selectedZone ? (
                                        <>
                                            {selectedZone.population.toLocaleString()}{" "}
                                            <span className="text-[10px] text-zinc-400 font-mono font-normal">pax</span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-zinc-500 font-normal">Pick from Table</span>
                                    )}
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                                    {selectedZone ? selectedZone.zone_name : "Click a table row below"}
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* 2. Message Payload Customizer & Optional Dispatcher */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 pt-0.5">
                        {/* Left 8 Cols: SMS Text Payload */}
                        <div className="lg:col-span-8 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                                    <span className="text-sky-400">02.</span> SMS Payload Configuration
                                </span>
                                <span
                                    className={`font-mono px-1.5 py-0.2 rounded border ${
                                        customSmsBody.length > 160
                                            ? "text-rose-300 bg-rose-950/40 border-rose-800"
                                            : "text-zinc-400 bg-zinc-900 border-zinc-800"
                                    }`}
                                >
                                    {customSmsBody.length} / 160 GSM Chars
                                </span>
                            </div>

                            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 space-y-1.5 focus-within:border-sky-500/60 transition-colors">
                                {selectedZone?.alert_headline && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-sans font-semibold text-white pb-1 border-b border-zinc-850">
                                        <span className="text-[9px] font-mono text-sky-400 uppercase tracking-wider">
                                            HEADLINE:
                                        </span>
                                        <span className="truncate">{selectedZone.alert_headline}</span>
                                    </div>
                                )}
                                <textarea
                                    rows={3}
                                    value={customSmsBody}
                                    onChange={e => setCustomSmsBody(e.target.value)}
                                    className="w-full text-xs font-sans text-white leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-800 focus:outline-none focus:border-sky-400/80 resize-none placeholder:text-zinc-600"
                                    placeholder="Type high-priority evacuation instructions, assembly points, and emergency helpline..."
                                />
                                {selectedZone?.recommended_action && (
                                    <div className="text-[10px] font-sans text-zinc-400 pt-0.5 flex items-center gap-1.5 truncate">
                                        <span className="text-sky-400 font-mono font-bold uppercase shrink-0">
                                            MODEL DIRECTIVE:
                                        </span>
                                        <span className="truncate text-zinc-300">
                                            {selectedZone.recommended_action}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right 4 Cols: Infrastructure Quick Glance & Test Mobile */}
                        <div className="lg:col-span-4 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                                    <span className="text-emerald-400">03.</span> Commander Dispatch
                                </span>
                                <span className="text-zinc-500">TEST LINK</span>
                            </div>

                            <div className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-1.5 flex flex-col justify-between h-[122px]">
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">
                                        Direct Gateway Override Phone:
                                    </label>
                                    <input
                                        type="text"
                                        value={testPhone}
                                        onChange={e => setTestPhone(e.target.value)}
                                        className="w-full text-xs font-mono text-white bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800 focus:outline-none focus:border-emerald-400/80 placeholder:text-zinc-600"
                                        placeholder="+919876543210"
                                    />
                                </div>
                                {testStatusMsg && (
                                    <div className="p-1 rounded border border-emerald-900/50 bg-emerald-950/30 text-[10px] text-emerald-300 truncate">
                                        {testStatusMsg}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. Action & Execution Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-850">
                        <div className="flex items-center gap-2 text-[11px] font-sans text-zinc-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                            <span>Broadcasting to:</span>
                            <span className="font-mono font-semibold text-zinc-200 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px]">
                                {broadcastingTarget === "DANGER_ZONES"
                                    ? "CRITICAL DANGER ZONES"
                                    : broadcastingTarget === "NEUTRAL_ZONES"
                                      ? "NEUTRAL / ADVISORY ZONES"
                                      : broadcastingTarget === "ALL_ZONES"
                                        ? "ALL REGIONAL WARDS"
                                        : selectedZone
                                          ? `${selectedZone.zone_id} • ${selectedZone.zone_name}`
                                          : "NO TARGET SELECTED"}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {testPhone.trim() && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSendSingleTestSMS}
                                    disabled={isSendingTest}
                                    className="font-mono text-xs gap-1.5 h-8 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-850 hover:text-white cursor-pointer"
                                >
                                    {isSendingTest ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Phone className="h-3.5 w-3.5 text-emerald-400" />
                                    )}
                                    Send Test SMS
                                </Button>
                            )}

                            <Button
                                type="button"
                                size="sm"
                                disabled={!broadcastingTarget || isSendingTest}
                                onClick={() => {
                                    if (broadcastingTarget === "DANGER_ZONES") handleBroadcastDangerZones();
                                    else if (broadcastingTarget === "NEUTRAL_ZONES") handleBroadcastNeutralZones();
                                    else if (broadcastingTarget === "ALL_ZONES") handleBroadcastAll();
                                    else if (selectedZone) handleDispatchSelectedZoneSMS();
                                }}
                                className={`font-mono text-xs gap-1.5 h-8 px-3.5 cursor-pointer transition-colors ${
                                    broadcastingTarget === "DANGER_ZONES"
                                        ? "bg-rose-600 hover:bg-rose-500 text-white"
                                        : broadcastingTarget === "NEUTRAL_ZONES"
                                          ? "bg-sky-600 hover:bg-sky-500 text-white"
                                          : broadcastingTarget === "ALL_ZONES"
                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                            : "bg-sky-600 hover:bg-sky-500 text-white"
                                }`}
                            >
                                <Send className="h-3.5 w-3.5" />
                                {broadcastingTarget && broadcastingTarget.startsWith("BROADCASTING")
                                    ? "Broadcasting Emergency SMS..."
                                    : "Trigger Mass Broadcast"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Broadcast Transmission Audit Logs */}
            {broadcastLogs.length > 0 && (
                <Card className="border-zinc-800 bg-zinc-950/80">
                    <CardHeader className="py-3 px-4 border-b border-zinc-800">
                        <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-bold">
                            <Clock className="h-3.5 w-3.5 text-sky-400" />
                            Recent Transmission Audit Feed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2 font-mono text-xs">
                        {broadcastLogs.map((log, idx) => (
                            <div
                                key={idx}
                                className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]"
                            >
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <div>
                                        <span className="font-bold text-white">
                                            ID: {log.broadcast_id || log.id || "BC-7891"}
                                        </span>
                                        <span className="text-zinc-400 ml-2">
                                            Recipients:{" "}
                                            <b className="text-emerald-300">
                                                {(log.recipient_count || log.recipients_count || 4500).toLocaleString()}{" "}
                                                residents
                                            </b>
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-zinc-400">
                                    <span>
                                        Zones:{" "}
                                        <b className="text-sky-300">
                                            {Array.isArray(log.zones_notified)
                                                ? log.zones_notified.join(", ")
                                                : log.zone_id || "ALL"}
                                        </b>
                                    </span>
                                    <span className="text-zinc-500">
                                        {new Date(
                                            log.sent_timestamp || log.timestamp || Date.now(),
                                        ).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
