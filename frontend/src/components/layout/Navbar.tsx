"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Waves, Sliders, Bell, BarChart3, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/", icon: ShieldAlert },
  { name: "Live Simulation", href: "/simulation", icon: Sliders },
  { name: "Alerts & Evacuation", href: "/alerts", icon: Bell },
  { name: "Intelligence & Forecast", href: "/analytics", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/30">
              <Waves className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight text-zinc-900 dark:text-zinc-50">
                FloodShield<span className="text-blue-600 dark:text-blue-400">AI</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Coastal Intelligence
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850 hover:text-zinc-900 dark:hover:text-zinc-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
            <span>Simulation Engine Online</span>
          </div>

          <Link
            href="/simulation"
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Launch Simulator
          </Link>
        </div>
      </div>
    </header>
  );
}
