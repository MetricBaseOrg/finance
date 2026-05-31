"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function CashflowBar({
  data,
  currency,
}: {
  data: { month: string; income: number; expense: number }[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="var(--gray-3)"
          tickFormatter={(m) => m.slice(5)}
          tick={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          stroke="var(--gray-3)"
          tickFormatter={(v) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(Number(v))
          }
          tick={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--gray-1)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
          }}
          labelStyle={{ color: "var(--gray-1)", fontWeight: 700 }}
          itemStyle={{ color: "var(--gray-1)" }}
          cursor={{ fill: "rgba(127,127,127,0.12)" }}
          formatter={(v) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency,
              maximumFractionDigits: 0,
            }).format(Number(v))
          }
        />
        <Legend
          wrapperStyle={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--gray-2)",
          }}
        />
        <Bar dataKey="income" fill="var(--up)" />
        <Bar dataKey="expense" fill="var(--down)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
