"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Sliders, Bell, BarChart3, Activity, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";

export function Navbar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    { name: t.nav.overview, href: "/", icon: Activity },
    { name: t.nav.simulation, href: "/simulation", icon: Sliders },
    { name: t.nav.alerts, href: "/alerts", icon: Bell },
    { name: t.nav.analytics, href: "/analytics", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-sky-600 text-white shadow-sm shadow-blue-500/20 border border-blue-400/30 group-hover:border-blue-400/60 transition-colors">
              <Shield className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-white">
                <span>{t.common.systemTitle}</span>
                <span className="font-mono text-xs font-semibold px-1 py-0.2 rounded bg-blue-500/20 text-sky-400 border border-blue-500/30">
                  AI
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                {t.common.systemSubtitle}
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-zinc-850 text-white font-semibold border border-zinc-700/80 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-sky-400" : "text-zinc-500")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Language Selector, Status, and CTA */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <LanguageSelector />

          <StatusIndicator
            status="online"
            label={t.common.telemetryLive}
            className="hidden lg:inline-flex"
          />

          <Link
            href="/simulation"
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors border border-blue-400/40 whitespace-nowrap"
          >
            <span>{t.common.launchEngine}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>
      </div>
    </header>
  );
}
