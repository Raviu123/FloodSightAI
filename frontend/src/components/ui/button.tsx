import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:ring-blue-500 border border-blue-500/50",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:ring-rose-500 border border-rose-500/50",
        outline:
          "border border-zinc-750 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 hover:text-white hover:border-zinc-600",
        secondary:
          "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/60",
        ghost:
          "hover:bg-zinc-800/80 text-zinc-300 hover:text-zinc-100",
        link: "text-sky-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7.5 rounded-md px-2.5 text-[11px]",
        lg: "h-11 rounded-lg px-6 text-sm",
        icon: "h-8.5 w-8.5 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
