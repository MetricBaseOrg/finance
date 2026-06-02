'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, ComposedChart, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { KTile } from '@/app/home/ui'
import {
  SOURCES, asNumber, buildSourceUrl, computePill, flattenNumbers, fmtNum, inferFields, resolveRange,
  type DashboardRange, type Widget,
} from '@/lib/field/widgets'

// The active dashboard time range, provided by the builder; widgets read it to
// build their data URLs. null → each source uses its own default window.
const RangeContext = createContext<DashboardRange | null>(null)
export function DashboardRangeProvider({ range, children }: { range: DashboardRange | null; children: React.ReactNode }) {
  return <RangeContext.Provider value={range}>{children}</RangeContext.Provider>
}

const TEAL = 'var(--c-fieldflow)'
const PIE_COLORS = ['var(--c-fieldflow)', '#6aa9c9', '#c9a84c', '#8a9bb5', '#5fb8a3', '#b5826a', '#7a6fb0']

type FetchState =
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string }
  | { kind: 'object'; data: Record<string, unknown> }
  | { kind: 'rows'; data: Record<string, unknown>[] }

// Dedup concurrent fetches of the same URL across widgets on the page.
const cache = new Map<string, Promise<Response>>()
function sharedFetch(url: string): Promise<Response> {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).catch((e) => { cache.delete(url); throw e }))
    // expire after a tick so a manual refresh re-fetches
    setTimeout(() => cache.delete(url), 1500)
  }
  return cache.get(url)!.then((r) => r.clone())
}

function useSource(url: string | null, refreshKey: number): FetchState {
  const [state, setState] = useState<FetchState>({ kind: 'loading' })
  useEffect(() => {
    let alive = true
    if (!url) { setState({ kind: 'error', message: 'No data source selected' }); return }
    setState({ kind: 'loading' })
    sharedFetch(url).then(async (r) => {
      if (!alive) return
      if (r.status === 503) { setState({ kind: 'offline' }); return }
      if (!r.ok) { setState({ kind: 'error', message: `HTTP ${r.status}` }); return }
      const data = await r.json().catch(() => null)
      if (!alive) return
      if (Array.isArray(data)) setState({ kind: 'rows', data })
      else if (data && typeof data === 'object') setState({ kind: 'object', data })
      else setState({ kind: 'error', message: 'Unexpected response' })
    }).catch(() => { if (alive) setState({ kind: 'offline' }) })
    return () => { alive = false }
  }, [url, refreshKey])
  return state
}

function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 80, color: 'var(--mb-ink-muted)', fontSize: 12, textAlign: 'center', padding: 12 }}>{children}</div>
}

const tooltipStyle = { background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', borderRadius: 8, fontSize: 12 }
const axisTick = { fill: 'var(--mb-ink-soft)', fontSize: 11 }
const legendStyle = { fontSize: 11 }

// ── KPI ──────────────────────────────────────────────────────────────────────
function KpiWidget({ widget }: { widget: Widget }) {
  const range = useContext(RangeContext)
  const src = widget.source ? SOURCES[widget.source] : null
  const state = useSource(src ? buildSourceUrl(src, range) : null, 0)
  if (state.kind === 'loading') return <Note>Loading…</Note>
  if (state.kind === 'offline') return <Note>Compute engine offline</Note>
  if (state.kind !== 'object') return <Note>This source has no KPI values</Note>

  const entries = flattenNumbers(state.data)
  if (!entries.length) return <Note>No numeric metrics in range</Note>

  const picked = widget.metric ? entries.find(([k]) => k === widget.metric) : entries[0]
  if (!picked) return <Note>Metric “{widget.metric}” not found</Note>

  // Optional secondary-metric comparison pill (reuses KTile's delta+tone slot).
  const sec = widget.metric2 ? entries.find(([k]) => k === widget.metric2) : null
  const pill = sec ? computePill(widget, picked[1], sec[1]) : null

  return (
    <KTile
      label={picked[0]}
      value={fmtNum(picked[1])}
      unit={widget.unit}
      delta={pill?.text}
      tone={pill?.tone ?? 'neutral'}
      accent={TEAL}
    />
  )
}

// ── Formula ───────────────────────────────────────────────────────────────────
function FormulaWidget({ widget }: { widget: Widget }) {
  const range = useContext(RangeContext)
  const [state, setState] = useState<{ k: 'loading' | 'offline' | 'ok' | 'err'; v?: number; m?: string }>({ k: 'loading' })
  useEffect(() => {
    let alive = true
    const expr = (widget.formula ?? '').trim()
    if (!expr) { setState({ k: 'err', m: 'No expression set' }); return }
    const body: Record<string, string> = { expr }
    if (range) { const { from, to } = resolveRange(range); body.date_from = from; body.date_to = to }
    fetch('/api/field/formula-eval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(async (r) => {
        if (!alive) return
        if (r.status === 503) { setState({ k: 'offline' }); return }
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setState({ k: 'err', m: d?.error || `HTTP ${r.status}` }); return }
        const v = asNumber(d?.total ?? d?.value ?? d?.result)
        if (v == null) { setState({ k: 'err', m: 'Non-numeric result' }); return }
        setState({ k: 'ok', v })
      }).catch(() => { if (alive) setState({ k: 'offline' }) })
    return () => { alive = false }
  }, [widget.formula, range])
  if (state.k === 'loading') return <Note>Evaluating…</Note>
  if (state.k === 'offline') return <Note>Compute engine offline</Note>
  if (state.k === 'err') return <Note>{state.m}</Note>
  return <KTile label={widget.title} value={fmtNum(state.v!)} unit={widget.unit} accent={TEAL} />
}

// ── Charts / table (array sources) ─────────────────────────────────────────────
function rowsFromState(state: FetchState): Record<string, unknown>[] | null {
  if (state.kind === 'rows') return state.data
  // some endpoints wrap rows under a key (e.g. { series: [...] })
  if (state.kind === 'object') {
    const arr = Object.values(state.data).find((v) => Array.isArray(v))
    if (Array.isArray(arr)) return arr as Record<string, unknown>[]
  }
  return null
}

function ChartWidget({ widget }: { widget: Widget }) {
  const range = useContext(RangeContext)
  const src = widget.source ? SOURCES[widget.source] : null
  const state = useSource(src ? buildSourceUrl(src, range) : null, 0)
  if (state.kind === 'loading') return <Note>Loading…</Note>
  if (state.kind === 'offline') return <Note>Compute engine offline</Note>
  if (state.kind === 'error') return <Note>{state.message}</Note>
  const rows = rowsFromState(state)
  if (!rows || rows.length === 0) return <Note>No data in range</Note>

  const { x, ys } = inferFields(rows)
  const y = widget.metric && ys.includes(widget.metric) ? widget.metric : ys[0]
  if (!x || !y) return <Note>Couldn’t infer chart fields</Note>
  // Coerce every numeric field so multi-series / dual-axis charts plot cleanly.
  const data = rows.map((r) => {
    const o: Record<string, unknown> = { ...r }
    for (const k of ys) o[k] = asNumber(r[k]) ?? 0
    return o
  })
  // Secondary field for combo (right axis) / scatter (Y axis).
  const y2 = widget.metric2 && ys.includes(widget.metric2) ? widget.metric2 : ys.find((k) => k !== y)

  if (widget.type === 'pie') {
    const pieData = data.map((r) => ({ name: String(r[x] ?? ''), value: asNumber(r[y]) ?? 0 })).filter((d) => d.value > 0)
    if (!pieData.length) return <Note>No positive values to chart</Note>
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--mb-surface)" />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
          <XAxis dataKey={x} tick={axisTick} minTickGap={20} />
          <YAxis tick={axisTick} width={52} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--mb-divider)' }} />
          <Bar dataKey={y} fill={TEAL} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={`area-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
              <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
          <XAxis dataKey={x} tick={axisTick} minTickGap={32} />
          <YAxis tick={axisTick} width={52} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey={y} stroke={TEAL} strokeWidth={2} fill={`url(#area-${widget.id})`} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'multi-line') {
    const series = ys.slice(0, 5)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
          <XAxis dataKey={x} tick={axisTick} minTickGap={32} />
          <YAxis tick={axisTick} width={52} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={legendStyle} />
          {series.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'stacked-bar') {
    const series = ys.slice(0, 5)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
          <XAxis dataKey={x} tick={axisTick} minTickGap={20} />
          <YAxis tick={axisTick} width={52} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--mb-divider)' }} />
          <Legend wrapperStyle={legendStyle} />
          {series.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="s" fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'scatter') {
    const xKey = widget.metric && ys.includes(widget.metric) ? widget.metric : ys[0]
    const yKey = widget.metric2 && ys.includes(widget.metric2) ? widget.metric2 : ys.find((k) => k !== xKey)
    if (!yKey) return <Note>Scatter needs two numeric fields</Note>
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--mb-divider)" />
          <XAxis type="number" dataKey={xKey} name={xKey} tick={axisTick} width={52} />
          <YAxis type="number" dataKey={yKey} name={yKey} tick={axisTick} width={52} />
          <ZAxis range={[40, 40]} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={TEAL} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'combo') {
    if (!y2) return <Note>Combo needs two numeric fields</Note>
    const k1 = widget.series1Kind ?? 'bar'
    const k2 = widget.series2Kind ?? 'line'
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
          <XAxis dataKey={x} tick={axisTick} minTickGap={20} />
          <YAxis yAxisId="left" tick={axisTick} width={52} />
          <YAxis yAxisId="right" orientation="right" tick={axisTick} width={52} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--mb-divider)' }} />
          <Legend wrapperStyle={legendStyle} />
          {k1 === 'bar'
            ? <Bar yAxisId="left" dataKey={y} fill={TEAL} radius={[2, 2, 0, 0]} />
            : <Line yAxisId="left" type="monotone" dataKey={y} stroke={TEAL} strokeWidth={2} dot={false} />}
          {k2 === 'bar'
            ? <Bar yAxisId="right" dataKey={y2} fill={PIE_COLORS[1]} radius={[2, 2, 0, 0]} />
            : <Line yAxisId="right" type="monotone" dataKey={y2} stroke={PIE_COLORS[1]} strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  // line (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
        <XAxis dataKey={x} tick={axisTick} minTickGap={32} />
        <YAxis tick={axisTick} width={52} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey={y} stroke={TEAL} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TableWidget({ widget }: { widget: Widget }) {
  const range = useContext(RangeContext)
  const src = widget.source ? SOURCES[widget.source] : null
  const state = useSource(src ? buildSourceUrl(src, range) : null, 0)
  if (state.kind === 'loading') return <Note>Loading…</Note>
  if (state.kind === 'offline') return <Note>Compute engine offline</Note>
  if (state.kind === 'error') return <Note>{state.message}</Note>
  const rows = rowsFromState(state)
  if (!rows || rows.length === 0) return <Note>No data in range</Note>
  const cols = Object.keys(rows[0]).slice(0, 6)
  return (
    <div style={{ overflow: 'auto', maxHeight: 220 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{cols.map((c) => <th key={c} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', borderBottom: '1px solid var(--mb-divider)', position: 'sticky', top: 0, background: 'var(--mb-surface)' }}>{c.replace(/_/g, ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={i}>{cols.map((c) => {
              const num = asNumber(r[c])
              return <td key={c} className={num != null ? 'mb-num' : undefined} style={{ padding: '6px 10px', color: 'var(--mb-ink-2)', borderBottom: '1px solid var(--mb-divider)' }}>{num != null ? fmtNum(num) : String(r[c] ?? '—')}</td>
            })}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function WidgetBody({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'kpi': return <KpiWidget widget={widget} />
    case 'formula': return <FormulaWidget widget={widget} />
    case 'table': return <TableWidget widget={widget} />
    default: return <ChartWidget widget={widget} />
  }
}

// Tiles (kpi/formula) render their own card; charts/tables need a sized box.
export function widgetNeedsChartHeight(type: Widget['type']): boolean {
  return type !== 'kpi' && type !== 'formula' && type !== 'table'
}
