"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { DashboardPeriod } from "@/lib/periods";
import { PERIOD_LABELS } from "@/lib/periods";

const PERIODS = Object.keys(PERIOD_LABELS) as DashboardPeriod[];

export function TimeframePicker({ current }: { current: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";

  function select(p: DashboardPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    
    // Set a default last 30 days for custom if not present
    if (p === "custom" && !params.get("start")) {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 30);
      params.set("start", past.toISOString().slice(0, 10));
      params.set("end", today.toISOString().slice(0, 10));
    }
    
    router.replace(`${pathname}?${params.toString()}`);
  }

  function updateDate(key: "start" | "end", val: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, val);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
      <div className="flex flex-wrap gap-px bg-line border border-line">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => select(p)}
            className={[
              "font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 transition-colors",
              p === current
                ? "bg-gold text-black font-bold"
                : "bg-bg-card text-gray-2 hover:text-gold hover:bg-bg-hover",
            ].join(" ")}
          >
            {p === "mtd" ? "MTD" : p === "ytd" ? "YTD" : p === "qtd" ? "QTD" : p.toUpperCase()}
          </button>
        ))}
      </div>
      
      {current === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => updateDate("start", e.target.value)}
            className="bg-bg-card border border-line text-white text-xs font-mono px-2 py-1 focus:outline-none focus:border-gold"
          />
          <span className="text-gray-3 text-xs">to</span>
          <input
            type="date"
            value={end}
            onChange={(e) => updateDate("end", e.target.value)}
            className="bg-bg-card border border-line text-white text-xs font-mono px-2 py-1 focus:outline-none focus:border-gold"
          />
        </div>
      )}
    </div>
  );
}
