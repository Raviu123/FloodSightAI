"use client";

import dynamic from "next/dynamic";
import { Loader2, Waves } from "lucide-react";
import type { MapLibreMapProps } from "./MapLibreMap";

const DynamicMap = dynamic(
  () => import("./MapLibreMap").then((mod) => mod.MapLibreMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[650px] w-full flex-col items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-950/60 border border-blue-800/50">
            <Waves className="h-7 w-7 text-blue-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Loading MapLibre GL Visual Engine...
          </div>
          <p className="text-xs text-zinc-500 max-w-xs text-center">
            Initializing vector terrain, coastal bathymetry, and satellite layers.
          </p>
        </div>
      </div>
    ),
  }
);

export function FloodMap(props: MapLibreMapProps) {
  return <DynamicMap {...props} />;
}
