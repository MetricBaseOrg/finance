import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  className?: string;
}) {
  const toneClass =
    deltaTone === "up"
      ? "text-[var(--color-up)]"
      : deltaTone === "down"
        ? "text-[var(--color-down)]"
        : "text-gray-2";
  return (
    <div className={cn("mb-card p-6 flex flex-col gap-3", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="font-mono tabular-nums text-[clamp(15px,1.8vw,22px)] font-bold text-white tracking-[-0.01em] overflow-hidden text-ellipsis whitespace-nowrap">
        {value}
      </div>
      {delta && (
        <div className={cn("font-mono text-[10px] tracking-[0.18em] uppercase", toneClass)}>{delta}</div>
      )}
    </div>
  );
}
