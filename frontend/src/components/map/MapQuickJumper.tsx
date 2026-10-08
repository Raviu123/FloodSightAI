"use client";

import { Crosshair } from "lucide-react";
import { REGION_PRESETS, type RegionPreset } from "@/data/coastal-map-data";
import { useLanguage } from "@/context/LanguageContext";

interface MapQuickJumperProps {
  onSelectRegion: (preset: RegionPreset) => void;
  activeRegionId?: string;
}

export function MapQuickJumper({ onSelectRegion, activeRegionId }: MapQuickJumperProps) {
  const { t } = useLanguage();

  return (
    <div className="absolute top-3.5 left-3.5 z-20 hidden md:flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/90 p-1.5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-1.5 px-2 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
        <Crosshair className="h-3 w-3 text-sky-400" />
        <span>{t.map.hotspots}</span>
      </div>

      {REGION_PRESETS.map((preset) => {
        const isActive = activeRegionId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onSelectRegion(preset)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all cursor-pointer ${
              isActive
                ? "bg-blue-600 text-white font-semibold shadow-xs border border-blue-400/40"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 border border-transparent"
            }`}
          >
            <span>{preset.name}</span>
            <span className="text-[9px] opacity-60">[{preset.code}]</span>
          </button>
        );
      })}
    </div>
  );
}
