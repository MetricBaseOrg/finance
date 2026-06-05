"use client";

import React, { useMemo, useState, useRef } from "react";
import { formatMoney } from "@/lib/money";

export type DailyBalance = { date: string; value: number };

export function BalanceLineChart({ 
  series, 
  currency,
  globalStart,
  globalEnd
}: { 
  series: DailyBalance[]; 
  currency: string;
  globalStart: Date;
  globalEnd: Date;
}) {
  const windowed = useMemo(() => {
    if (series.length === 0) return [];
    const startStr = globalStart.toISOString().slice(0, 10);
    
    // globalEnd is usually the 1st of the next month (exclusive) or similar.
    // If it's 2024-05-01, the last valid day is 2024-04-30.
    // However, if we just use <= endStr, we might include the first day of the next period.
    // Let's compute a proper inclusive end string:
    const endInclusive = new Date(globalEnd);
    endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
    const endStr = endInclusive.toISOString().slice(0, 10);

    return series.filter(d => d.date >= startStr && d.date <= endStr);
  }, [series, globalStart, globalEnd]);

  // ── SVG dimensions ─────────────────────────────────
  const VB_W = 920, VB_H = 280;
  const m = { top: 24, right: 56, bottom: 32, left: 24 };
  const innerW = VB_W - m.left - m.right;
  const innerH = VB_H - m.top - m.bottom;

  // ── Scales ─────────────────────────────────────────
  const N = windowed.length;
  if (N === 0) {
    return <div className="h-[280px] flex items-center justify-center text-gray-3 font-mono text-xs uppercase tracking-[0.2em]">No balance history</div>;
  }

  const values = windowed.map(d => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const padV = (maxV - minV) * 0.12 || Math.abs(maxV * 0.05) || 1;
  const yMin = minV - padV;
  const yMax = maxV + padV;
  const yRange = yMax - yMin;

  const xScale = (i: number) => m.left + (i / Math.max(1, N - 1)) * innerW;
  const yScale = (v: number) => m.top + (1 - (v - yMin) / yRange) * innerH;

  // ── Monotone-cubic interpolation for a smooth, non-overshooting curve ──
  const pts = windowed.map((d, i) => ({ x: xScale(i), y: yScale(d.value) }));
  const linePath = useMemo(() => {
    if (pts.length < 2) {
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${VB_W - m.right} ${pts[0].y}`;
      return '';
    }
    const dxs = [], dys = [], ms = [];
    for (let i = 0; i < pts.length - 1; i++) {
      dxs.push(pts[i + 1].x - pts[i].x);
      dys.push(pts[i + 1].y - pts[i].y);
      ms.push(dxs[i] === 0 ? 0 : dys[i] / dxs[i]);
    }
    const tangents = new Array(pts.length).fill(0);
    tangents[0] = ms[0];
    tangents[pts.length - 1] = ms[pts.length - 2];
    for (let i = 1; i < pts.length - 1; i++) {
      if (ms[i - 1] * ms[i] <= 0) {
        tangents[i] = 0;
      } else {
        const dx1 = dxs[i - 1], dx2 = dxs[i];
        tangents[i] = 3 * (dx1 + dx2) / ((dx1 + 2 * dx2) / ms[i - 1] + (2 * dx1 + dx2) / ms[i]);
      }
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx1 = pts[i].x + dxs[i] / 3;
      const cy1 = pts[i].y + tangents[i] * dxs[i] / 3;
      const cx2 = pts[i + 1].x - dxs[i] / 3;
      const cy2 = pts[i + 1].y - tangents[i + 1] * dxs[i] / 3;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    return d;
  }, [pts, m.right]);

  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length - 1].x} ${m.top + innerH} L ${pts[0].x} ${m.top + innerH} Z`
    : '';

  // ── Y-axis gridlines & labels ──────────────────────
  const Y_TICKS = 4;
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (yRange * i / Y_TICKS));

  // ── X-axis labels: ~5 dates evenly spaced ──────────
  const xLabelIdxs = [0, Math.floor(N * 0.25), Math.floor(N * 0.5), Math.floor(N * 0.75), N - 1];

  const fmtAxis = (v: number) => {
    if (currency === 'IDR') {
      if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
      if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'k';
      return Math.round(v).toString();
    }
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return v.toFixed(0);
  };

  const fmtAxisX = (s: string) => {
    const [, mo, d] = s.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[+mo - 1]} ${+d}`;
  };

  // ── Min/max markers ────────────────────────────────
  const maxIdx = values.indexOf(maxV);
  const minIdx = values.indexOf(minV);

  // ── Hover state ────────────────────────────────────
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVB = (xPx / rect.width) * VB_W;
    const idx = Math.round((xVB - m.left) / innerW * (N - 1));
    const clamped = Math.max(0, Math.min(N - 1, idx));
    setHover(clamped);
  };
  const handleLeave = () => setHover(null);

  // ── Stats footer ───────────────────────────────────
  const startV = values[0];
  const endV = values[N - 1];
  const change = endV - startV;
  const changePct = startV === 0 ? 0 : (change / Math.abs(startV)) * 100;
  const hi = maxV, lo = minV;

  const fmt = (v: number) => formatMoney(v, currency);
  const fmtC = (v: number) => formatMoney(v, currency, { compact: true });

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-gray-3">Closing balance</span>
          <span className="font-mono text-2xl font-extrabold text-white tracking-tight">
            {fmt(endV)}
          </span>
          <span className={`font-mono text-[11px] ${change >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
            {change >= 0 ? '▲' : '▼'} {fmt(Math.abs(change))} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={`w-full h-auto block ${hover !== null ? 'cursor-crosshair' : 'cursor-default'}`}
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          <defs>
            <linearGradient id="balanceArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#c9a84c" stopOpacity="0.28" />
              <stop offset="60%"  stopColor="#c9a84c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y gridlines */}
          {yTicks.map((v, i) => {
            const y = yScale(v);
            return (
              <g key={'y-' + i}>
                <line
                  x1={m.left} x2={VB_W - m.right}
                  y1={y} y2={y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                />
                <text
                  x={VB_W - m.right + 6} y={y + 3}
                  fill="var(--gray-3)" fontFamily="JetBrains Mono, monospace"
                  fontSize="9" textAnchor="start"
                >{fmtAxis(v)}</text>
              </g>
            );
          })}

          {/* Area + line */}
          <path d={areaPath} fill="url(#balanceArea)" />
          <path d={linePath} fill="none" stroke="#c9a84c" strokeWidth="1.5"
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

          {/* Min/max markers */}
          {[maxIdx, minIdx].map((idx, i) => {
            const isHi = i === 0;
            const x = xScale(idx);
            const y = yScale(values[idx]);
            return (
              <g key={'mark-' + i}>
                <circle cx={x} cy={y} r="3" fill={isHi ? 'var(--color-up)' : 'var(--color-down)'} stroke="var(--bg-card)" strokeWidth="1.5" />
                <text
                  x={x} y={isHi ? y - 8 : y + 14}
                  fill={isHi ? 'var(--color-up)' : 'var(--color-down)'}
                  fontFamily="JetBrains Mono, monospace" fontSize="9"
                  letterSpacing="1" textAnchor="middle"
                >{isHi ? '↑ HI' : '↓ LO'} {fmtAxis(values[idx])}</text>
              </g>
            );
          })}

          {/* Last point */}
          <g>
            <circle cx={xScale(N - 1)} cy={yScale(endV)} r="6" fill="#c9a84c" fillOpacity="0.15" />
            <circle cx={xScale(N - 1)} cy={yScale(endV)} r="3" fill="#c9a84c" stroke="var(--bg-card)" strokeWidth="1.5" />
          </g>

          {/* X-axis labels */}
          {xLabelIdxs.map((idx, i) => (
            <text
              key={'x-' + i}
              x={xScale(idx)} y={VB_H - 10}
              fill="var(--gray-3)" fontFamily="JetBrains Mono, monospace"
              fontSize="9" letterSpacing="1.5" textAnchor="middle"
            >{fmtAxisX(windowed[idx].date).toUpperCase()}</text>
          ))}

          {/* Hover crosshair + dot */}
          {hover !== null && (
            <g pointerEvents="none">
              <line
                x1={xScale(hover)} x2={xScale(hover)}
                y1={m.top} y2={m.top + innerH}
                stroke="#c9a84c" strokeOpacity="0.4" strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={xScale(hover)} cy={yScale(values[hover])} r="5" fill="#c9a84c" fillOpacity="0.2" />
              <circle cx={xScale(hover)} cy={yScale(values[hover])} r="3" fill="#c9a84c" stroke="var(--bg-card)" strokeWidth="1.5" />
            </g>
          )}
        </svg>

        {/* Hover tooltip (HTML overlay for crisp text) */}
        {hover !== null && (() => {
          const xPos = xScale(hover);
          const yPos = yScale(values[hover]);
          const pctX = (xPos - m.left) / innerW;
          const leftPos = `calc(${(xPos / VB_W) * 100}% + 10px)`;
          const flipLeft = pctX > 0.75;
          return (
            <div style={{
              position: 'absolute',
              top: 8,
              ...(flipLeft
                ? { right: `calc(${100 - (xPos / VB_W) * 100}% + 10px)` }
                : { left: leftPos }),
              minWidth: 140,
            }} className="bg-bg-elev border border-line-strong p-2 sm:p-3 pointer-events-none flex flex-col gap-1 z-10 shadow-lg">
              <span className="font-mono text-[9px] uppercase text-gray-3">
                {fmtAxisX(windowed[hover].date)} {windowed[hover].date.slice(0, 4)}
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {fmt(values[hover])}
              </span>
              {hover > 0 && (() => {
                const delta = values[hover] - values[hover - 1];
                return (
                  <span className={`font-mono text-[9px] ${delta >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                    {delta >= 0 ? '▲' : '▼'} {fmtC(Math.abs(delta))} vs prev day
                  </span>
                );
              })()}
            </div>
          );
        })()}
      </div>

      {/* Footer stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border-t border-line pt-px mt-2">
        {[
          { l: 'Start',  v: fmt(startV), tone: '' },
          { l: 'High',   v: fmt(hi),     tone: 'text-[var(--color-up)]' },
          { l: 'Low',    v: fmt(lo),     tone: 'text-[var(--color-down)]' },
          { l: 'Change', v: (change >= 0 ? '+ ' : '− ') + fmt(Math.abs(change)), tone: change >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]' },
        ].map(s => (
          <div key={s.l} className="bg-bg-card px-3 py-2 sm:p-3 flex flex-col gap-1 min-w-0">
            <span className="font-mono text-xs text-gray-3 uppercase">{s.l}</span>
            <span className={`font-mono text-xs sm:text-sm font-bold truncate ${s.tone || 'text-white'}`}>
              {s.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
