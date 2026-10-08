"use client";

import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

export function MapLegend() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="absolute bottom-6 left-4 z-20 max-w-xs rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-3.5 shadow-lg backdrop-blur-md text-xs">
      <div
        className="flex items-center justify-between cursor-pointer font-semibold text-zinc-900 dark:text-zinc-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-blue-500" />
          <span>Map Intelligence Legend</span>
        </div>
        <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          {/* Risk Zones */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Risk Zones
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-red-500/80 border border-red-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Critical Danger</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-amber-500/80 border border-amber-600" />
                <span className="text-zinc-700 dark:text-zinc-300">High Danger</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-yellow-500/80 border border-yellow-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Medium Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-emerald-500/80 border border-emerald-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Safe Highlands</span>
              </div>
            </div>
          </div>

          {/* Critical Facilities */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Critical Facilities
            </div>
            <div className="flex flex-wrap gap-2 text-zinc-700 dark:text-zinc-300">
              <span className="inline-flex items-center gap-1">🏥 Hospital</span>
              <span className="inline-flex items-center gap-1">🛡️ Safe Shelter</span>
              <span className="inline-flex items-center gap-1">⚓ Port</span>
              <span className="inline-flex items-center gap-1">⚡ Power</span>
            </div>
          </div>

          {/* Dynamic Elements */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Simulation & Corridors
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-5 rounded bg-blue-500/60 border border-blue-400 animate-pulse" />
                <span className="text-zinc-700 dark:text-zinc-300">Dynamic Inundation Layer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-5 rounded-full bg-emerald-500" />
                <span className="text-zinc-700 dark:text-zinc-300">Safe Evacuation Route</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
