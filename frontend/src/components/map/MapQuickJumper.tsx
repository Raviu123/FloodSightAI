"use client";

import { REGION_PRESETS, type RegionPreset } from "@/data/coastal-map-data";
import { Crosshair, Search } from "lucide-react";
import { useState } from "react";
import { MapOverlayCard } from "./MapOverlayCard";

interface MapQuickJumperProps {
    onSelectRegion: (preset: RegionPreset) => void;
    activeRegionId?: string;
    onClose?: () => void;
}

export function MapQuickJumper({ onSelectRegion, activeRegionId, onClose }: MapQuickJumperProps) {
    const [query, setQuery] = useState("");
    const normalizedQuery = query.trim().toLowerCase();
    const visibleRegions = REGION_PRESETS.filter(preset =>
        `${preset.name} ${preset.code} ${preset.state}`.toLowerCase().includes(normalizedQuery),
    );

    return (
        <MapOverlayCard label="Hotspots" onClose={onClose} className="absolute top-3.5 left-3.5 z-20 hidden md:block">
            <div className="flex items-center gap-1.5 p-1.5">
                <Crosshair className="ml-2 h-3 w-3 shrink-0 text-zinc-400" />
                <label className="flex h-7 w-36 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 text-zinc-500 focus-within:border-zinc-700 focus-within:text-zinc-200">
                    <Search className="h-3 w-3 shrink-0" />
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search region"
                        aria-label="Search region"
                        className="min-w-0 flex-1 bg-transparent text-[10px] font-mono text-zinc-200 outline-none placeholder:text-zinc-600"
                    />
                </label>

                {visibleRegions.map(preset => {
                    const isActive = activeRegionId === preset.id;
                    return (
                        <button
                            key={preset.id}
                            onClick={() => onSelectRegion(preset)}
                            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all cursor-pointer ${
                                isActive
                                    ? "bg-zinc-100 text-zinc-950 font-semibold shadow-xs border border-zinc-200"
                                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 border border-transparent"
                            }`}
                        >
                            <span>{preset.name}</span>
                            <span className="text-[9px] opacity-60">[{preset.code}]</span>
                        </button>
                    );
                })}
            </div>
        </MapOverlayCard>
    );
}
