"use client";

import { useState } from "react";
import type { SankeySource, SankeySink } from "@/server/analytics";

const W = 880;
const H = 440;
const m = { top: 20, bottom: 20, left: 160, right: 168 };
const NODE_W = 12;
const PAD_PX = 8;
const LABEL_H = 30;
const INNER_H = H - m.top - m.bottom;

type HoverState = { kind: "src" | "snk"; idx: number } | null;

function placeLabels(midYs: number[]): number[] {
  const order = midYs.map((midY, i) => ({ i, midY })).sort((a, b) => a.midY - b.midY);
  const placed = new Array<number>(midYs.length);
  let lastBottom = m.top - LABEL_H / 2;
  order.forEach(({ i, midY }) => {
    const y = Math.max(midY, lastBottom + LABEL_H);
    placed[i] = y;
    lastBottom = y;
  });
  let lastTop = H - m.bottom + LABEL_H / 2;
  for (let k = order.length - 1; k >= 0; k--) {
    const { i } = order[k];
    placed[i] = Math.min(placed[i], lastTop - LABEL_H);
    lastTop = placed[i];
  }
  return placed;
}

export function SankeyChart({
  sources,
  sinks,
  currency,
}: {
  sources: SankeySource[];
  sinks: SankeySink[];
  currency: string;
}) {
  const [hover, setHover] = useState<HoverState>(null);

  if (sources.length === 0 || sinks.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-gray-3 font-mono text-xs uppercase tracking-[0.2em]">
        Not enough data for flow chart
      </div>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const fmtC = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  const totalSrc = sources.reduce((s, n) => s + n.value, 0);
  const totalSnk = sinks.reduce((s, n) => s + n.value, 0);
  const total = Math.max(totalSrc, totalSnk, 1);

  const srcPad = Math.max(0, sources.length - 1) * PAD_PX;
  const snkPad = Math.max(0, sinks.length - 1) * PAD_PX;
  const scale = Math.min(INNER_H - srcPad, INNER_H - snkPad) / total;

  const srcSumH = totalSrc * scale + srcPad;
  const snkSumH = totalSnk * scale + snkPad;

  // Source node positions (left column)
  let cy = m.top + (INNER_H - srcSumH) / 2;
  const srcNodes = sources.map((n) => {
    const h = Math.max(n.value * scale, 1);
    const node = { ...n, x: m.left, y: cy, h, midY: cy + h / 2 };
    cy += h + PAD_PX;
    return node;
  });

  // Sink node positions (right column)
  cy = m.top + (INNER_H - snkSumH) / 2;
  const snkNodes = sinks.map((n) => {
    const h = Math.max(n.value * scale, 1);
    const node = { ...n, x: W - m.right - NODE_W, y: cy, h, midY: cy + h / 2 };
    cy += h + PAD_PX;
    return node;
  });

  const srcLabelY = placeLabels(srcNodes.map((n) => n.midY));
  const snkLabelY = placeLabels(snkNodes.map((n) => n.midY));

  // Flow ribbons: each src → each snk proportionally
  const srcOff = srcNodes.map(() => 0);
  const snkOff = snkNodes.map(() => 0);
  const flows: {
    x0: number; x1: number; y0: number; y1: number; h: number;
    srcIdx: number; snkIdx: number; color: string; value: number;
  }[] = [];

  srcNodes.forEach((src, i) => {
    snkNodes.forEach((snk, j) => {
      const flowVal = (src.value / total) * snk.value;
      const flowH = flowVal * scale;
      if (flowH < 0.2) return;
      flows.push({
        x0: src.x + NODE_W, x1: snk.x,
        y0: src.y + srcOff[i],
        y1: snk.y + snkOff[j],
        h: flowH,
        srcIdx: i, snkIdx: j,
        color: snk.color,
        value: flowVal,
      });
      srcOff[i] += flowH;
      snkOff[j] += flowH;
    });
  });

  const isLit = (f: (typeof flows)[number]) => {
    if (!hover) return false;
    return hover.kind === "src" ? f.srcIdx === hover.idx : f.snkIdx === hover.idx;
  };

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Flow ribbons */}
        {flows.map((f) => {
          const cx = (f.x0 + f.x1) / 2;
          const path = `M ${f.x0} ${f.y0} C ${cx} ${f.y0}, ${cx} ${f.y1}, ${f.x1} ${f.y1} L ${f.x1} ${f.y1 + f.h} C ${cx} ${f.y1 + f.h}, ${cx} ${f.y0 + f.h}, ${f.x0} ${f.y0 + f.h} Z`;
          const lit = isLit(f);
          const dim = hover && !lit;
          return (
            <path
              key={`${f.srcIdx}-${f.snkIdx}`}
              d={path}
              fill={f.color}
              fillOpacity={lit ? 0.7 : dim ? 0.05 : 0.22}
              className="sankey-flow"
            >
              <title>{`${srcNodes[f.srcIdx].name} → ${snkNodes[f.snkIdx].name}: ${fmt(Math.round(f.value))}`}</title>
            </path>
          );
        })}

        {/* Source nodes + labels */}
        {srcNodes.map((n, i) => {
          const dim = hover?.kind === "snk";
          const ly = srcLabelY[i];
          const leaderNeeded = Math.abs(ly - n.midY) > 1;
          const tx = n.x - 14;
          return (
            <g
              key={`src-${i}`}
              onMouseEnter={() => setHover({ kind: "src", idx: i })}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <rect x={n.x} y={n.y} width={NODE_W} height={n.h} fill={n.color} opacity={dim ? 0.35 : 1} />
              {leaderNeeded && (
                <polyline
                  points={`${n.x},${n.midY} ${n.x - 6},${n.midY} ${tx + 2},${ly}`}
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth="1"
                  opacity={dim ? 0.3 : 1}
                />
              )}
              <text
                x={tx} y={ly - 5}
                fill="var(--white)" opacity={dim ? 0.5 : 1}
                fontFamily="Manrope, sans-serif" fontSize="12.5" fontWeight="600"
                textAnchor="end" dominantBaseline="middle"
              >
                {n.name}
              </text>
              <text
                x={tx} y={ly + 9}
                fill="var(--gray-3)" opacity={dim ? 0.5 : 1}
                fontFamily="JetBrains Mono, monospace" fontSize="9.5"
                letterSpacing="1.6" textAnchor="end" dominantBaseline="middle"
              >
                {fmtC(n.value).toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Sink nodes + labels */}
        {snkNodes.map((n, i) => {
          const dim = hover?.kind === "src";
          const ly = snkLabelY[i];
          const leaderNeeded = Math.abs(ly - n.midY) > 1;
          const tx = n.x + NODE_W + 14;
          const rightEdge = n.x + NODE_W;
          return (
            <g
              key={`snk-${i}`}
              onMouseEnter={() => setHover({ kind: "snk", idx: i })}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
            >
              <rect x={n.x} y={n.y} width={NODE_W} height={n.h} fill={n.color} opacity={dim ? 0.35 : 1} />
              {leaderNeeded && (
                <polyline
                  points={`${rightEdge},${n.midY} ${rightEdge + 6},${n.midY} ${tx - 2},${ly}`}
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth="1"
                  opacity={dim ? 0.3 : 1}
                />
              )}
              <text
                x={tx} y={ly - 5}
                fill="var(--white)" opacity={dim ? 0.5 : 1}
                fontFamily="Manrope, sans-serif" fontSize="12.5" fontWeight="600"
                dominantBaseline="middle"
              >
                {n.name}
              </text>
              <text
                x={tx} y={ly + 9}
                fill="var(--gray-3)" opacity={dim ? 0.5 : 1}
                fontFamily="JetBrains Mono, monospace" fontSize="9.5"
                letterSpacing="1.6" dominantBaseline="middle"
              >
                {fmtC(n.value).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
