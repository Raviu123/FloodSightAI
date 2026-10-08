import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono font-medium tracking-tight transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600 uppercase",
  {
    variants: {
      variant: {
        default:
          "border border-sky-500/30 bg-sky-950/40 text-sky-300",
        secondary:
          "border border-zinc-700/60 bg-zinc-850 text-zinc-300",
        destructive:
          "border border-rose-500/40 bg-rose-950/40 text-rose-300",
        warning:
          "border border-amber-500/40 bg-amber-950/40 text-amber-300",
        success:
          "border border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
        outline:
          "border border-zinc-700 bg-transparent text-zinc-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
