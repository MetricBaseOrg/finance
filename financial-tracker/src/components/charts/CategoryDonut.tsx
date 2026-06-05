"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export const GOLD_RAMP = [
  "#c9a84c",
  "#e5c168",
  "#8a7434",
  "#a18838",
  "#d9b958",
  "#bfa44d",
  "#6b5826",
  "#7b6630",
];

export function CategoryDonut({
  data,
  currency,
}: {
  data: { name: string; value: number; color?: string | null }[];
  currency: string;
}) {
  if (data.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-gray-3 font-mono text-xs uppercase tracking-[0.2em]">
        No expenses this month
      </div>
    );
  }
  return (
    <div className="w-full h-[260px]">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={{
            background: "var(--topbar-bg)",
            border: "1px solid var(--line-strong)",
            borderRadius: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--white)",
          }}
          formatter={(v) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency,
              maximumFractionDigits: 0,
            }).format(Number(v))
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          stroke="var(--bg-card)"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell
              key={d.name}
              fill={d.color ?? GOLD_RAMP[i % GOLD_RAMP.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
    </div>
  );
}
