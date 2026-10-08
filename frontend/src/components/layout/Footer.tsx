import Link from "next/link";
import { Waves, Shield, Activity, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Waves className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              FloodShield AI
            </span>
            <span>— AI-driven Coastal Flood Intelligence & Early Warning System</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              Early Evacuation Protocol
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              Dynamic Prediction
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-amber-500" />
              India Coastal Zones
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
