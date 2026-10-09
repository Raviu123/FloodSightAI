"use client";

import { REGION_PRESETS, type RegionPreset } from "@/data/coastal-map-data";
import { MapPin, Search } from "lucide-react";
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
        <MapOverlayCard
            label="Hotspots HUD"
            onClose={onClose}
            className="absolute top-14 left-3.5 z-20 hidden md:flex w-72 max-h-[75vh] flex-col"
        >
            <div className="flex flex-col gap-2 p-2.5 font-mono">
                <label className="flex h-8 w-full items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 text-zinc-500 focus-within:border-zinc-700 focus-within:text-zinc-200">
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search 10+ flood hotspots..."
                        aria-label="Search region"
                        className="min-w-0 flex-1 bg-transparent text-xs font-mono text-zinc-200 outline-none placeholder:text-zinc-600"
                    />
                </label>

                <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto no-scrollbar pt-1 pr-0.5">
                    {visibleRegions.map(preset => {
                        const isActive = activeRegionId === preset.id;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => onSelectRegion(preset)}
                                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-mono transition-all cursor-pointer border ${
                                    isActive
                                        ? "bg-zinc-100 text-zinc-950 font-semibold border-zinc-200 shadow-xs"
                                        : "text-zinc-300 hover:text-white hover:bg-zinc-800/80 border-zinc-850 bg-zinc-900/40"
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <MapPin className={`h-3 w-3 shrink-0 ${isActive ? "text-zinc-900" : "text-zinc-400"}`} />
                                    <span className="truncate">{preset.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-[10px] uppercase ${isActive ? "text-zinc-700 font-semibold" : "text-zinc-500"}`}>{preset.state}</span>
                                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isActive ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800/80 text-zinc-400"}`}>[{preset.code}]</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </MapOverlayCard>
    );
}
