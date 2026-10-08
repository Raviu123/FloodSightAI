"use client";

import { Shield, Radio, Database, MapPin } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-zinc-850 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-950/80 border border-blue-800/60 text-sky-400">
              <Shield className="h-3 w-3" />
            </div>
            <span className="font-semibold text-zinc-200">{t.footer.title}</span>
            <span className="text-zinc-600">|</span>
            <span>{t.footer.subtitle}</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-emerald-400" />
              <span>{t.footer.engineVersion}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-sky-400" />
              <span>{t.footer.bathymetryModel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-amber-400" />
              <span>{t.footer.hotspotsTag}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
