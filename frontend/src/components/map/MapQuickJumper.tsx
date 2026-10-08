"use client";

import { MapPin, Navigation } from "lucide-react";
import { REGION_PRESETS, type RegionPreset } from "@/data/coastal-map-data";

interface MapQuickJumperProps {
  onSelectRegion: (preset: RegionPreset) => void;
  activeRegionId?: string;
}

export function MapQuickJumper({ onSelectRegion, activeRegionId }: MapQuickJumperProps) {
  return (
    <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-md backdrop-blur-md">
      <div className="flex items-center gap-1 px-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        <MapPin className="h-3.5 w-3.5 text-blue-500" />
        <span>Hotspots:</span>
      </div>

      {REGION_PRESETS.map((preset) => {
        const isActive = activeRegionId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onSelectRegion(preset)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? "bg-blue-600 text-white shadow-xs"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {preset.name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}
