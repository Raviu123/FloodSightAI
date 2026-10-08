import { ArrowRight, Layers } from "lucide-react";
import Link from "next/link";

import { FloodMap } from "@/components/map/FloodMap";

export default function Home() {
    return (
        <div className="flex min-h-0 flex-1 flex-col p-1 sm:p-2">
            {/* Live Geospatial Intelligence Inner Child Card */}
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3 sm:p-4 shadow-sm backdrop-blur-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2">
                        <Layers className="size-4 text-zinc-300" />
                        <h2 className="text-xs font-bold text-zinc-200 tracking-wider uppercase font-mono">
                            Live Geospatial Intelligence Feed
                        </h2>
                    </div>

                    <Link
                        href="/simulation"
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-400 hover:text-white transition-colors"
                    >
                        <span>Interactive Controls</span>
                        <ArrowRight className="size-3.5" />
                    </Link>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-inner">
                    <FloodMap tideLevel={2.6} rainfall={65} heightClassName="h-full min-h-[560px]" />
                </div>
            </div>
        </div>
    );
}
