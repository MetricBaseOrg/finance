import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const base =
  "inline-flex items-center justify-center gap-2 font-mono text-[11px] font-bold tracking-[0.18em] uppercase px-4 py-2.5 transition-all duration-150 rounded-none disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-gold text-black hover:bg-gold-bright border border-gold hover:border-gold-bright",
  outline:
    "bg-transparent text-gold border border-gold hover:bg-gold hover:text-black",
  ghost:
    "bg-transparent text-gray-1 border border-line hover:border-gold hover:text-gold",
};

export const GoldButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], className)}
      {...props}
    />
  ),
);
GoldButton.displayName = "GoldButton";
