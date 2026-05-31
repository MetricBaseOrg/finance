'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { KTile } from '@/app/home/ui'
import { SOURCES, asNumber, fmtNum, inferFields, type Widget } from '@/lib/field/widgets'

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

// ── KPI ──────────────────────────────────────────────────────────────────────
function KpiWidget({ widget }: { widget: Widget }) {
  const src = widget.source ? SOURCES[widget.source] : null
  const state = useSource(src?.url ?? null, 0)
  if (state.kind === 'loading') return <Note>Loading…</Note>
  if (state.kind === 'offline') return <Note>Compute engine offline</Note>
  if (state.kind !== 'object') return <Note>This source has no KPI values</Note>

  const entries = Object.entries(state.data)
    .map(([k, v]) => [k, asNumber(v)] as const)
    .filter(([, v]) => v != null) as [string, number][]
  if (!entries.length) return <Note>No numeric metrics in range</Note>

  const picked = widget.metric ? entries.find(([k]) => k === widget.metric) : entries[0]
  if (!picked) return <Note>Metric “{widget.metric}” not found</Note>
  return <KTile label={picked[0].replace(/_/g, ' ')} value={fmtNum(picked[1])} unit={widget.unit} accent={TEAL} />
}

// ── Formula ───────────────────────────────────────────────────────────────────
function FormulaWidget({ widget }: { widget: Widget }) {
  const [state, setState] = useState<{ k: 'loading' | 'offline' | 'ok' | 'err'; v?: number; m?: string }>({ k: 'loading' })
  useEffect(() => {
    let alive = true
    const expr = (widget.formula ?? '').trim()
    if (!expr) { setState({ k: 'err', m: 'No expression set' }); return }
    fetch('/api/field/formula-eval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expr }) })
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
  }, [widget.formula])
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
  const src = widget.source ? SOURCES[widget.source] : null
  const state = useSource(src?.url ?? null, 0)
  if (state.kind === 'loading') return <Note>Loading…</Note>
  if (state.kind === 'offline') return <Note>Compute engine offline</Note>
  if (state.kind === 'error') return <Note>{state.message}</Note>
  const rows = rowsFromState(state)
  if (!rows || rows.length === 0) return <Note>No data in range</Note>

  const { x, ys } = inferFields(rows)
  const y = widget.metric && ys.includes(widget.metric) ? widget.metric : ys[0]
  if (!x || !y) return <Note>Couldn’t infer chart fields</Note>
  const data = rows.map((r) => ({ ...r, [y]: asNumber(r[y]) ?? 0 }))

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
  const src = widget.source ? SOURCES[widget.source] : null
  const state = useSource(src?.url ?? null, 0)
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
  return type === 'line' || type === 'bar' || type === 'pie'
}
