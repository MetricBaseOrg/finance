'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { TrendingUp, Percent, Hash, Flag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Point { date: string; count: number }
interface Milestone { id: string; name: string; dueDate: string }
interface SCurveData {
  projectId: string
  projectName: string
  color: string
  rangeStart: string
  rangeEnd: string
  today: string
  totalTasks: number
  totalDone: number
  planned: Point[]
  actual: Point[]
  milestones: Milestone[]
}

// Layout constants for the SVG. Width is responsive via viewBox.
// Kept relatively compact so it doesn't dominate the project dashboard.
const W = 800
const H = 260
const PAD = { top: 12, right: 18, bottom: 28, left: 38 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

export function SCurveView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SCurveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState<'count' | 'percent'>('count')
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/projects/${projectId}/s-curve`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  // Derived scaling: map dates → x, counts/percents → y
  const scale = useMemo(() => {
    if (!data || data.planned.length === 0) return null
    const n = data.planned.length
    const maxCount = Math.max(
      data.totalTasks || 1,
      ...data.planned.map(p => p.count),
      ...data.actual.map(p => p.count),
      1,
    )

    const xAt = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * PLOT_W
    const yCount = (c: number) => PAD.top + PLOT_H - (c / maxCount) * PLOT_H
    const yPercent = (c: number) => PAD.top + PLOT_H - (Math.min(c / Math.max(data.totalTasks, 1), 1)) * PLOT_H
    const yAt = unit === 'percent' ? yPercent : yCount

    return { n, maxCount, xAt, yAt }
  }, [data, unit])

  const todayIdx = useMemo(() => {
    if (!data) return -1
    return data.planned.findIndex(p => p.date === data.today)
  }, [data])

  const milestoneIdx = useMemo(() => {
    if (!data) return [] as Array<{ ms: Milestone; idx: number }>
    return data.milestones
      .map(ms => ({ ms, idx: data.planned.findIndex(p => p.date === ms.dueDate) }))
      .filter(m => m.idx >= 0)
  }, [data])

  // Render a smooth-ish polyline from the points using path L commands
  const pathFor = (pts: Point[]): string => {
    if (!scale) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scale.xAt(i).toFixed(2)} ${scale.yAt(p.count).toFixed(2)}`).join(' ')
  }

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (!data || !scale) return [] as Array<{ y: number; label: string }>
    if (unit === 'percent') {
      return [0, 25, 50, 75, 100].map(p => ({
        y: PAD.top + PLOT_H - (p / 100) * PLOT_H,
        label: `${p}%`,
      }))
    }
    const max = scale.maxCount
    const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5)
    const ticks: Array<{ y: number; label: string }> = []
    for (let v = 0; v <= max; v += step) {
      ticks.push({ y: PAD.top + PLOT_H - (v / max) * PLOT_H, label: String(v) })
    }
    if (ticks[ticks.length - 1]?.label !== String(max)) {
      ticks.push({ y: PAD.top, label: String(max) })
    }
    return ticks
  }, [data, scale, unit])

  // X-axis ticks: 4–6 evenly-spaced labels
  const xTicks = useMemo(() => {
    if (!data || !scale) return [] as Array<{ x: number; label: string }>
    const count = Math.min(6, Math.max(2, Math.floor(scale.n / 7)))
    const out: Array<{ x: number; label: string }> = []
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i / (count - 1)) * (scale.n - 1))
      out.push({ x: scale.xAt(idx), label: format(parseISO(data.planned[idx].date), 'MMM d') })
    }
    return out
  }, [data, scale])

  // Hover tracking
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!scale || !data) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // Convert client x → svg user-space x using viewBox scaling
    const localX = ((e.clientX - rect.left) / rect.width) * W
    const inPlot = localX - PAD.left
    if (inPlot < 0 || inPlot > PLOT_W) { setHover(null); return }
    const idx = Math.round((inPlot / PLOT_W) * (scale.n - 1))
    setHover({ x: scale.xAt(idx), idx })
  }

  if (loading) {
    return (
      <div className="bg-bg-card rounded-xl border border-line p-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!data || scale === null) {
    return (
      <div className="bg-bg-card rounded-xl border border-line p-12 text-center">
        <TrendingUp className="h-10 w-10 text-gray-3 mx-auto mb-2" />
        <p className="text-sm text-gray-3">Not enough data yet to draw a curve.</p>
        <p className="text-xs text-gray-3 mt-1">Add tasks with due dates to populate the planned line.</p>
      </div>
    )
  }

  const plannedFinal = data.planned[data.planned.length - 1]?.count ?? 0
  const actualFinal = data.actual[data.actual.length - 1]?.count ?? 0
  const hoveredPlanned = hover ? data.planned[hover.idx] : null
  const hoveredActual = hover ? data.actual[hover.idx] : null
  const lead = actualFinal - (todayIdx >= 0 ? data.planned[todayIdx].count : 0)

  return (
    <div className="bg-bg-card rounded-xl border border-line overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-line">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="h-4 w-4 text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-1 truncate">
            S-curve · {data.projectName}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
          <button
            onClick={() => setUnit('count')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium',
              unit === 'count'
                ? 'bg-bg-card text-gray-1 shadow-sm'
                : 'text-gray-3'
            )}
          >
            <Hash className="h-3 w-3" /> Tasks
          </button>
          <button
            onClick={() => setUnit('percent')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium',
              unit === 'percent'
                ? 'bg-bg-card text-gray-1 shadow-sm'
                : 'text-gray-3'
            )}
          >
            <Percent className="h-3 w-3" /> %
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
        <Stat label="Total" value={`${data.totalTasks}`} />
        <Stat label="Done" value={`${data.totalDone}`} accent="emerald" />
        <Stat
          label="vs Plan"
          value={lead >= 0 ? `+${lead}` : `${lead}`}
          accent={lead >= 0 ? 'emerald' : 'rose'}
          hint={todayIdx >= 0 ? `Planned ${data.planned[todayIdx].count} by today` : undefined}
        />
        <Stat
          label="At end"
          value={`${actualFinal}/${plannedFinal}`}
          hint={`through ${format(parseISO(data.rangeEnd), 'MMM d')}`}
        />
      </div>

      {/* Chart */}
      <div className="p-2 sm:p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`S-curve for ${data.projectName}`}
        >
          {/* Y-axis grid + labels */}
          {yTicks.map((t, i) => (
            <g key={`y-${i}`}>
              <line
                x1={PAD.left} y1={t.y}
                x2={PAD.left + PLOT_W} y2={t.y}
                className="stroke-gray-100 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6} y={t.y + 3}
                textAnchor="end"
                className="fill-gray-400 dark:fill-slate-500"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >{t.label}</text>
            </g>
          ))}

          {/* X-axis labels */}
          {xTicks.map((t, i) => (
            <text
              key={`x-${i}`}
              x={t.x} y={PAD.top + PLOT_H + 18}
              textAnchor="middle"
              className="fill-gray-400 dark:fill-slate-500"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
            >{t.label}</text>
          ))}

          {/* Today vertical line */}
          {todayIdx >= 0 && (
            <g>
              <line
                x1={scale.xAt(todayIdx)} y1={PAD.top}
                x2={scale.xAt(todayIdx)} y2={PAD.top + PLOT_H}
                className="stroke-indigo-400/60"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={scale.xAt(todayIdx)} y={PAD.top - 4}
                textAnchor="middle"
                className="fill-indigo-500 dark:fill-indigo-400"
                fontSize={9}
                fontWeight={600}
              >TODAY</text>
            </g>
          )}

          {/* Milestone markers */}
          {milestoneIdx.map(({ ms, idx }) => (
            <g key={ms.id}>
              <line
                x1={scale.xAt(idx)} y1={PAD.top}
                x2={scale.xAt(idx)} y2={PAD.top + PLOT_H}
                className="stroke-amber-400/40"
                strokeWidth={1}
              />
              <g transform={`translate(${scale.xAt(idx)}, ${PAD.top + 8})`}>
                <Flag className="text-amber-500" width={10} height={10} x={-5} y={-5} />
              </g>
            </g>
          ))}

          {/* Planned line (gray, dashed) */}
          <path
            d={pathFor(data.planned)}
            fill="none"
            className="stroke-gray-400 dark:stroke-slate-500"
            strokeWidth={2}
            strokeDasharray="6 4"
          />

          {/* Actual line (project color, solid) */}
          <path
            d={pathFor(data.actual)}
            fill="none"
            stroke={data.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Hover indicator */}
          {hover && hoveredPlanned && hoveredActual && (
            <g>
              <line
                x1={hover.x} y1={PAD.top}
                x2={hover.x} y2={PAD.top + PLOT_H}
                className="stroke-gray-300 dark:stroke-slate-600"
                strokeWidth={1}
              />
              <circle
                cx={hover.x} cy={scale.yAt(hoveredPlanned.count)}
                r={3}
                className="fill-gray-400 dark:fill-slate-500"
              />
              <circle
                cx={hover.x} cy={scale.yAt(hoveredActual.count)}
                r={4}
                fill={data.color}
              />
            </g>
          )}
        </svg>

        {/* Hover readout / Legend */}
        <div className="flex items-center justify-between gap-3 mt-1.5 px-2 text-xs">
          <div className="flex items-center gap-4 text-gray-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-gray-400 dark:border-slate-500" />
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5" style={{ background: data.color }} />
              <span>Actual</span>
            </div>
            {milestoneIdx.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Flag className="h-3 w-3 text-amber-500" />
                <span>Milestone</span>
              </div>
            )}
          </div>
          {hover && hoveredPlanned && hoveredActual && (
            <div className="text-gray-2 font-mono text-[11px]">
              {format(parseISO(hoveredPlanned.date), 'MMM d')} ·
              <span className="ml-2">plan {unit === 'percent' ? Math.round(hoveredPlanned.count / Math.max(data.totalTasks, 1) * 100) + '%' : hoveredPlanned.count}</span>
              <span className="ml-2" style={{ color: data.color }}>actual {unit === 'percent' ? Math.round(hoveredActual.count / Math.max(data.totalTasks, 1) * 100) + '%' : hoveredActual.count}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label, value, accent, hint,
}: {
  label: string
  value: string
  accent?: 'emerald' | 'rose'
  hint?: string
}) {
  return (
    <div className="bg-bg-card px-2.5 py-1.5 sm:px-3 sm:py-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-2">{label}</div>
      <div className={cn(
        'text-base sm:text-lg font-bold leading-tight mt-0.5',
        accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
        accent === 'rose'    ? 'text-rose-600 dark:text-rose-400' :
        'text-gray-1',
      )}>{value}</div>
      {hint && (
        <div className="text-[10px] text-gray-3 mt-0.5 truncate">{hint}</div>
      )}
    </div>
  )
}
