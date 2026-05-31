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
            background: "#16181d",
            border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#e5e5e5",
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
          }}
          labelStyle={{ color: "#ffffff", fontWeight: 700 }}
          itemStyle={{ color: "#e5e5e5" }}
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
