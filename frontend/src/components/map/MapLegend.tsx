"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Crosshair } from "lucide-react";

export function MapLegend() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="absolute bottom-4 left-4 z-20 max-w-xs rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl text-xs">
      <div
        className="flex items-center justify-between cursor-pointer font-mono font-bold text-xs uppercase tracking-wider text-zinc-300"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-sky-400" />
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

          {/* Dynamic Vectors */}
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Hydrology & Corridors
            </span>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-4 rounded-xs bg-cyan-400 border border-cyan-300" />
                <span className="text-zinc-300">Active River Channels</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-4 rounded-full bg-emerald-400" />
                <span className="text-zinc-300">Open Evacuation Corridor</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
