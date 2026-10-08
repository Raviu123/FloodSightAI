import * as React from "react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: "online" | "warning" | "critical" | "neutral";
  label?: string;
  pulse?: boolean;
}

export function StatusIndicator({
  status = "online",
  label,
  pulse = true,
  className,
  ...props
}: StatusIndicatorProps) {
  const statusColors = {
    online: "bg-emerald-400 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-400 text-amber-400 border-amber-500/30",
    critical: "bg-rose-500 text-rose-400 border-rose-500/30",
    neutral: "bg-zinc-400 text-zinc-400 border-zinc-500/30",
  };

  const dotBg = {
    online: "bg-emerald-400",
    warning: "bg-amber-400",
    critical: "bg-rose-500",
    neutral: "bg-zinc-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-mono font-medium tracking-wide bg-zinc-900/80 backdrop-blur-sm",
        statusColors[status],
        className
      )}
      {...props}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              dotBg[status]
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotBg[status])} />
      </span>
      {label && <span className="text-zinc-200">{label}</span>}
    </div>
  );
}
