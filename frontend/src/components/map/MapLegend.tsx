"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Crosshair } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function MapLegend() {
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useLanguage();

  return (
    <div className="absolute bottom-4 left-4 z-20 max-w-xs rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl text-xs">
      <div
        className="flex items-center justify-between cursor-pointer font-mono font-bold text-xs uppercase tracking-wider text-zinc-300"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-sky-400" />
          <span>{t.map.symbologyKey}</span>
        </div>
        <button className="text-zinc-500 hover:text-zinc-300 cursor-pointer" aria-label="Toggle Legend">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-2.5 space-y-2.5 pt-2 border-t border-zinc-850 font-mono text-[11px]">
          {/* Threat Zones */}
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              {t.map.topographicTiers}
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#dc2626] border border-rose-400 shrink-0" />
                <span className="text-zinc-300">{t.map.tierExtreme}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#ea580c] border border-orange-400 shrink-0" />
                <span className="text-zinc-300">{t.map.tierDanger}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#eab308] border border-yellow-400 shrink-0" />
                <span className="text-zinc-300">{t.map.tierWarning}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#10b981] border border-emerald-400 shrink-0" />
                <span className="text-zinc-300">{t.map.tierSafe}</span>
              </div>
            </div>
          </div>

          {/* Regional Floodplain & Hydrology */}
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              {t.map.hydrologyCorridors}
            </span>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-xs bg-purple-500/40 border border-purple-400 shrink-0" />
                <span className="text-zinc-300">{t.map.layerFloodCoverage}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-4 rounded-xs bg-cyan-400 border border-cyan-300 shrink-0" />
                <span className="text-zinc-300">{t.map.layerWaterBodies}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-4 rounded-full bg-emerald-400 border border-emerald-300 shrink-0" />
                <span className="text-zinc-300">{t.map.layerEvacuationRoutes}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 border border-rose-300 ring-2 ring-rose-500/30 shrink-0" />
                <span className="text-zinc-300">{t.map.layerFacilities}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
