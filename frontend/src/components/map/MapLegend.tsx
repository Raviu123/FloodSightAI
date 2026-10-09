"use client";

import { ChevronDown, ChevronUp, Crosshair } from "lucide-react";
import { useState } from "react";
import { MapOverlayCard } from "./MapOverlayCard";

export function MapLegend({
    onClose,
    elevationSafetyActive = false,
    indiaBaselineActive = false,
    indiaHotspotsActive = false,
}: {
    onClose?: () => void;
    elevationSafetyActive?: boolean;
    indiaBaselineActive?: boolean;
    indiaHotspotsActive?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <MapOverlayCard
            label="Flood Symbology Key"
            onClose={onClose}
            className="absolute bottom-4 left-4 z-20 max-w-xs text-xs"
        >
            <div className="p-3">
                <div
                    className="flex items-center justify-between cursor-pointer font-mono font-bold text-xs uppercase tracking-wider text-zinc-300"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-1.5">
                        <Crosshair className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Flood Symbology Key</span>
                    </div>
                    <button className="text-zinc-500 hover:text-zinc-300">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                </div>

                {isOpen && (
                    <div className="mt-2.5 space-y-2.5 pt-2 border-t border-zinc-850 font-mono text-[11px]">
                        {/* Threat Zones */}
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                                Topographic Risk Tiers (DEM)
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-[#dc2626] border border-rose-400" />
                                    <span className="text-zinc-300">Extreme (&lt;1.0m MSL)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-[#ea580c] border border-orange-400" />
                                    <span className="text-zinc-300">Danger (1.0 - 2.5m)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-[#eab308] border border-yellow-400" />
                                    <span className="text-zinc-300">Warning (2.5 - 5.0m)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-[#10b981] border border-emerald-400" />
                                    <span className="text-zinc-300">Safe Ridge (&gt;15m)</span>
                                </div>
                            </div>
                        </div>

                        {/* Regional Floodplain & Hydrology */}
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                                Regional Hydrology & Corridors
                            </span>
                            <div className="space-y-1.5 text-[10px]">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-purple-500/40 border border-purple-400" />
                                    <span className="text-zinc-300">Flood Hub Regional Extent</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-4 rounded-xs bg-cyan-400 border border-cyan-300" />
                                    <span className="text-zinc-300">Active River Channels (Gurupura / Netravati)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-4 rounded-full bg-emerald-400 border border-emerald-300" />
                                    <span className="text-zinc-300">NH-66 Highway Evacuation Corridor</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-rose-500 border border-rose-300 ring-2 ring-rose-500/30" />
                                    <span className="text-zinc-300">Critical Medical / Incident Command Facility</span>
                                </div>
                            </div>
                        </div>

                        {elevationSafetyActive && (
                            <div className="border-t border-zinc-850 pt-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                                    Terrain Flood Susceptibility (MERIT Hydro)
                                </span>
                                <div className="space-y-1.5 text-[10px]">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/70 border border-emerald-300" />
                                        <span className="text-zinc-300">Lower Terrain Susceptibility</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-orange-500/70 border border-orange-300" />
                                        <span className="text-zinc-300">Moderate Terrain Susceptibility</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-red-500/70 border border-red-300" />
                                        <span className="text-zinc-300">Higher Terrain Susceptibility</span>
                                    </div>
                                    <p className="pt-1 text-[9px] leading-relaxed text-zinc-500">
                                        Multi-criteria GIS model (HAND, UPA, slope, relative elev). Physical terrain assessment; does not predict live weather events.
                                    </p>
                                </div>
                            </div>
                        )}

                        {indiaBaselineActive && (
                            <div className="border-t border-zinc-850 pt-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                                    Terrain Flood Susceptibility
                                </span>
                                <div className="space-y-1.5 text-[10px]">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/70 border border-emerald-300" />
                                        <span className="text-zinc-300">Lower Susceptibility</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-amber-500/70 border border-amber-300" />
                                        <span className="text-zinc-300">Moderate Susceptibility</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-red-500/70 border border-red-300" />
                                        <span className="text-zinc-300">Higher Susceptibility</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {indiaHotspotsActive && (
                            <div className="border-t border-zinc-850 pt-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                                    India Flood Hotspots (IMERG)
                                </span>
                                <div className="space-y-1.5 text-[10px]">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-red-500/80 border border-red-300" />
                                        <span className="text-zinc-300">High Risk Hotspot (&gt;0.6)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-orange-500/80 border border-orange-300" />
                                        <span className="text-zinc-300">Moderate Risk (0.3 - 0.6)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-xs bg-blue-500/70 border border-blue-300" />
                                        <span className="text-zinc-300">Low Hotspot Score (&lt;0.3)</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MapOverlayCard>
    );
}
