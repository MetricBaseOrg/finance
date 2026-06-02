// Shared model for the FieldFlow dashboard builder.
//
// A dashboard layout is persisted as JSON in `UserDashboard.layoutJson`
// ({ widgets: Widget[] }). The Python field-engine documents a richer
// Gridstack schema (fieldlib/dashboards.py); we use a compatible subset:
// widgets render top-to-bottom in array order on a 4-column grid, each
// spanning `w` columns. This stays forward-compatible with the engine's
// x/y/w/h while keeping the client dependency-free (no drag-grid lib).

// Type-only import (erased at build) — no runtime cycle with the UI module.
import type { Tone } from '@/app/home/ui'

export type WidgetType =
  | 'kpi' | 'line' | 'bar' | 'pie' | 'table' | 'formula'
  | 'area' | 'multi-line' | 'stacked-bar' | 'scatter' | 'combo'

/** What a KPI tile's secondary-metric pill displays (primary `a` vs secondary `b`). */
export type PillMode = 'raw' | 'difference' | 'ratio' | 'pctchange' | 'formula'

export type Widget = {
  id: string
  type: WidgetType
  title: string
  /** key into SOURCES — required for every type except `formula`. */
  source?: string
  /** for `kpi`: which key of the kpi-set object to show.
   *  for chart types: which numeric field to plot (else first numeric). */
  metric?: string
  /** secondary field: scatter Y-axis, combo right-axis metric, or — for `kpi` —
   *  the comparison metric driving the pill (else no pill is shown). */
  metric2?: string
  /** combo render style per series (default series1 = bar on left, series2 = line on right). */
  series1Kind?: 'line' | 'bar'
  series2Kind?: 'line' | 'bar'
  /** for `kpi` with a `metric2`: how the pill compares the two values. */
  pillMode?: PillMode
  /** for `pillMode: 'formula'`: an expression in `a` (primary) & `b` (secondary). */
  pillFormula?: string
  /** display unit suffix on raw/difference/formula pills. */
  pillUnit?: string
  /** for `formula`: the DSL expression evaluated by the engine. */
  formula?: string
  /** display unit suffix for kpi / formula values. */
  unit?: string
  /** column span on the 4-col grid. */
  w: 1 | 2 | 3 | 4
  /** hide the widget's title bar in view mode (controls still show in edit mode). */
  hideHeader?: boolean
}

// A dashboard-level time filter applied to every time-aware widget on it.
export type RangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'ytd' | 'custom'
export type DashboardRange = { preset: RangePreset; from?: string; to?: string }

export const DEFAULT_RANGE: DashboardRange = { preset: '90d' }

export const RANGE_PRESETS: { preset: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { preset: '7d', label: '7D' },
  { preset: '30d', label: '30D' },
  { preset: '90d', label: '90D' },
  { preset: '6m', label: '6M' },
  { preset: '1y', label: '1Y' },
  { preset: 'ytd', label: 'YTD' },
]

export type DashboardLayout = { widgets: Widget[]; range?: DashboardRange }

export type Dashboard = {
  id: string
  name: string
  active: boolean
  layoutJson: string
  creatorName?: string | null
  createdById?: string
}

export type SourceKind = 'kpiset' | 'series' | 'rows'

export type SourceDef = {
  label: string
  kind: SourceKind
  url: string
  /** widget types this source can feed. */
  for: WidgetType[]
  /** how the dashboard time range maps onto this source's query:
   *  'range' → date_from/date_to; 'year' → year of the range end; omitted → not time-filtered. */
  time?: 'range' | 'year'
}

const YEAR = new Date().getFullYear()

// Named data sources backed by the engine analytics proxy
// (/api/field/analytics/<name>). `kpiset` returns a flat { key: number }
// object; `series`/`rows` return an array of records.
// Chart widget types that consume multi-field time/series data.
const SERIES_CHARTS: WidgetType[] = ['line', 'bar', 'area', 'multi-line', 'stacked-bar', 'scatter', 'combo', 'table']

export const SOURCES: Record<string, SourceDef> = {
  'ops-kpis': { label: 'Operational KPIs', kind: 'kpiset', url: '/api/field/analytics/ops-kpis', for: ['kpi'] },
  'today-summary': { label: "Today's summary", kind: 'kpiset', url: '/api/field/analytics/summary', for: ['kpi'] },
  'inflow-series': { label: 'Daily inflow', kind: 'series', url: '/api/field/analytics/inflow-series?days=90', for: SERIES_CHARTS, time: 'range' },
  'stock-history': { label: 'Stock history', kind: 'series', url: '/api/field/analytics/stock-history?days=90', for: SERIES_CHARTS, time: 'range' },
  'monthly-inflow': { label: 'Monthly inflow', kind: 'series', url: `/api/field/analytics/monthly-inflow?year=${YEAR}`, for: SERIES_CHARTS, time: 'year' },
  'monthly-lifting': { label: 'Monthly lifting', kind: 'series', url: `/api/field/analytics/monthly-lifting?year=${YEAR}`, for: SERIES_CHARTS, time: 'year' },
  'stock-balance': { label: 'Stock balance by node', kind: 'rows', url: '/api/field/analytics/stock-balance', for: ['pie', 'bar', 'stacked-bar', 'table'], time: 'range' },
}

export function sourcesFor(type: WidgetType): [string, SourceDef][] {
  return Object.entries(SOURCES).filter(([, s]) => s.for.includes(type))
}

export const WIDGET_TYPES: { type: WidgetType; label: string; hint: string }[] = [
  { type: 'kpi', label: 'KPI tile', hint: 'A single headline number, optionally with a comparison pill' },
  { type: 'line', label: 'Line chart', hint: 'A trend over time' },
  { type: 'multi-line', label: 'Multi-line chart', hint: 'Several metrics as lines on one axis' },
  { type: 'area', label: 'Area chart', hint: 'A filled trend over time' },
  { type: 'bar', label: 'Bar chart', hint: 'Compare values across periods or nodes' },
  { type: 'stacked-bar', label: 'Stacked bar chart', hint: 'Stack multiple metrics per period or node' },
  { type: 'combo', label: 'Combo / dual-axis', hint: 'Two metrics on left + right Y-axes, each line or bar' },
  { type: 'scatter', label: 'Scatter plot', hint: 'Correlate two numeric fields as X vs Y points' },
  { type: 'pie', label: 'Pie chart', hint: 'Composition / share of a total' },
  { type: 'table', label: 'Table', hint: 'Raw rows from a data source' },
  { type: 'formula', label: 'Formula value', hint: 'Evaluate a saved DSL expression to one number' },
]

let n = 0
export function newWidgetId(): string {
  n += 1
  return `w-${Date.now().toString(36)}-${n.toString(36)}`
}

const RANGE_PRESET_SET = new Set<RangePreset>(['7d', '30d', '90d', '6m', '1y', 'ytd', 'custom'])

function parseRange(v: unknown): DashboardRange | undefined {
  if (!v || typeof v !== 'object') return undefined
  const r = v as Record<string, unknown>
  if (typeof r.preset !== 'string' || !RANGE_PRESET_SET.has(r.preset as RangePreset)) return undefined
  const out: DashboardRange = { preset: r.preset as RangePreset }
  if (typeof r.from === 'string') out.from = r.from
  if (typeof r.to === 'string') out.to = r.to
  return out
}

export function parseLayout(json: string | null | undefined): DashboardLayout {
  if (!json) return { widgets: [] }
  try {
    const v = JSON.parse(json)
    const widgets = Array.isArray(v?.widgets) ? v.widgets : []
    return {
      widgets: widgets.filter((w: unknown) => w && typeof w === 'object'),
      range: parseRange(v?.range),
    }
  } catch {
    return { widgets: [] }
  }
}

// Resolve a range to concrete YYYY-MM-DD bounds (local date, today as the end).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function resolveRange(range: DashboardRange): { from: string; to: string } {
  const today = new Date()
  const to = ymd(today)
  if (range.preset === 'custom') return { from: range.from || to, to: range.to || to }
  if (range.preset === 'ytd') return { from: `${today.getFullYear()}-01-01`, to }
  const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '6m': 182, '1y': 365 }
  const f = new Date(today)
  f.setDate(f.getDate() - (days[range.preset] ?? 90))
  return { from: ymd(f), to }
}

// Build a source's fetch URL with the dashboard time range applied (per its `time`
// capability). No range / no capability → the source's own default URL is used.
export function buildSourceUrl(src: SourceDef, range: DashboardRange | null | undefined): string {
  if (!range || !src.time) return src.url
  const [base, qs] = src.url.split('?')
  const params = new URLSearchParams(qs)
  const { from, to } = resolveRange(range)
  if (src.time === 'range') {
    params.delete('days')
    params.set('date_from', from)
    params.set('date_to', to)
  } else if (src.time === 'year') {
    params.set('year', to.slice(0, 4))
  }
  const s = params.toString()
  return s ? `${base}?${s}` : base
}

// Format a numeric value compactly (thousands separators, trims long decimals).
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1000) return Math.round(v).toLocaleString()
  if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

// Pick the first key whose values look like a label/category (string or date),
// and the first numeric key, from an array of records.
export function inferFields(rows: Record<string, unknown>[]): { x: string | null; ys: string[] } {
  if (!rows.length) return { x: null, ys: [] }
  const keys = Object.keys(rows[0])
  const isNum = (k: string) => rows.some((r) => Number.isFinite(typeof r[k] === 'string' ? Number(r[k]) : (r[k] as number)))
  const numeric = keys.filter(isNum)
  const x = keys.find((k) => !numeric.includes(k)) ?? keys[0] ?? null
  const ys = numeric.filter((k) => k !== x)
  return { x, ys }
}

export function asNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

// Flatten an analytics object to its numeric leaves, so KPI widgets can target
// either flat metric sets or the engine's nested cards (ops-kpis returns
// { production: { today, … }, lifting: { ytd, … } } → "production today", …).
export function flattenNumbers(obj: Record<string, unknown>, maxDepth = 2): [string, number][] {
  const out: [string, number][] = []
  const walk = (o: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [k, v] of Object.entries(o)) {
      const label = (prefix ? `${prefix} ${k}` : k).replace(/_/g, ' ')
      const num = asNumber(v)
      if (num != null) out.push([label, num])
      else if (v && typeof v === 'object' && !Array.isArray(v) && depth < maxDepth) {
        walk(v as Record<string, unknown>, label, depth + 1)
      }
    }
  }
  walk(obj, '', 0)
  return out
}

// ── KPI pill (secondary metric) ────────────────────────────────────────────────
// Evaluate a tiny arithmetic expression in `a` (primary) and `b` (secondary).
// Supports numbers, the identifiers `a`/`b`, `+ - * /`, and parentheses — no
// `eval`/`Function`, so a saved layout can't run arbitrary code. Returns a finite
// number, or null on a parse error / non-finite result.
export function evalPillExpr(expr: string, a: number, b: number): number | null {
  const src = expr.trim()
  if (!src) return null
  let i = 0
  const skip = () => { while (i < src.length && src[i] === ' ') i++ }

  // expr := term (('+'|'-') term)*
  function parseExpr(): number | null {
    let left = parseTerm()
    if (left == null) return null
    for (;;) {
      skip()
      const op = src[i]
      if (op !== '+' && op !== '-') break
      i++
      const right = parseTerm()
      if (right == null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }
  // term := factor (('*'|'/') factor)*
  function parseTerm(): number | null {
    let left = parseFactor()
    if (left == null) return null
    for (;;) {
      skip()
      const op = src[i]
      if (op !== '*' && op !== '/') break
      i++
      const right = parseFactor()
      if (right == null) return null
      left = op === '*' ? left * right : left / right
    }
    return left
  }
  // factor := '-'? ( number | 'a' | 'b' | '(' expr ')' )
  function parseFactor(): number | null {
    skip()
    if (src[i] === '-') { i++; const v = parseFactor(); return v == null ? null : -v }
    if (src[i] === '(') {
      i++
      const v = parseExpr()
      skip()
      if (v == null || src[i] !== ')') return null
      i++
      return v
    }
    if (src[i] === 'a') { i++; return a }
    if (src[i] === 'b') { i++; return b }
    const m = /^\d+(\.\d+)?/.exec(src.slice(i))
    if (m) { i += m[0].length; return Number(m[0]) }
    return null
  }

  const result = parseExpr()
  skip()
  if (result == null || i !== src.length || !Number.isFinite(result)) return null
  return result
}

// Build the comparison pill shown on a KPI tile from the primary (`a`) and
// secondary (`b`) metric values, per the widget's `pillMode`.
export function computePill(w: Widget, a: number, b: number): { text: string; tone: Tone } | null {
  const unit = w.pillUnit ? ` ${w.pillUnit}` : ''
  const signed = (n: number) => (n >= 0 ? `+${fmtNum(n)}` : `−${fmtNum(Math.abs(n))}`)
  const bySign = (n: number): Tone => (n >= 0 ? 'ok' : 'bad')

  switch (w.pillMode ?? 'difference') {
    case 'raw':
      return { text: `${fmtNum(b)}${unit}`, tone: 'neutral' }
    case 'difference': {
      const d = a - b
      return { text: `${signed(d)}${unit}`, tone: bySign(d) }
    }
    case 'ratio': {
      if (b === 0) return { text: '—', tone: 'neutral' }
      return { text: `${fmtNum((a / b) * 100)}%`, tone: 'neutral' }
    }
    case 'pctchange': {
      if (b === 0) return { text: '—', tone: 'neutral' }
      const p = ((a - b) / b) * 100
      return { text: `${p >= 0 ? '+' : '−'}${fmtNum(Math.abs(p))}%`, tone: bySign(p) }
    }
    case 'formula': {
      const v = evalPillExpr(w.pillFormula ?? '', a, b)
      if (v == null) return { text: '—', tone: 'neutral' }
      return { text: `${fmtNum(v)}${unit}`, tone: bySign(v) }
    }
    default:
      return null
  }
}
