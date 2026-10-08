import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
        secondary:
          "border-transparent bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
        destructive:
          "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
        warning:
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
        success:
          "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
        outline:
          "border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300",
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
