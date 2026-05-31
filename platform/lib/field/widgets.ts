// Shared model for the FieldFlow dashboard builder.
//
// A dashboard layout is persisted as JSON in `UserDashboard.layoutJson`
// ({ widgets: Widget[] }). The Python field-engine documents a richer
// Gridstack schema (fieldlib/dashboards.py); we use a compatible subset:
// widgets render top-to-bottom in array order on a 4-column grid, each
// spanning `w` columns. This stays forward-compatible with the engine's
// x/y/w/h while keeping the client dependency-free (no drag-grid lib).

export type WidgetType = 'kpi' | 'line' | 'bar' | 'pie' | 'table' | 'formula'

export type Widget = {
  id: string
  type: WidgetType
  title: string
  /** key into SOURCES — required for every type except `formula`. */
  source?: string
  /** for `kpi`: which key of the kpi-set object to show.
   *  for chart types: which numeric field to plot (else first numeric). */
  metric?: string
  /** for `formula`: the DSL expression evaluated by the engine. */
  formula?: string
  /** display unit suffix for kpi / formula values. */
  unit?: string
  /** column span on the 4-col grid. */
  w: 1 | 2 | 3 | 4
  /** hide the widget's title bar in view mode (controls still show in edit mode). */
  hideHeader?: boolean
}

export type DashboardLayout = { widgets: Widget[] }

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
}

const YEAR = new Date().getFullYear()

// Named data sources backed by the engine analytics proxy
// (/api/field/analytics/<name>). `kpiset` returns a flat { key: number }
// object; `series`/`rows` return an array of records.
export const SOURCES: Record<string, SourceDef> = {
  'ops-kpis': { label: 'Operational KPIs', kind: 'kpiset', url: '/api/field/analytics/ops-kpis', for: ['kpi'] },
  'today-summary': { label: "Today's summary", kind: 'kpiset', url: '/api/field/analytics/summary', for: ['kpi'] },
  'inflow-series': { label: 'Daily inflow (90d)', kind: 'series', url: '/api/field/analytics/inflow-series?days=90', for: ['line', 'bar', 'table'] },
  'stock-history': { label: 'Stock history (90d)', kind: 'series', url: '/api/field/analytics/stock-history?days=90', for: ['line', 'bar', 'table'] },
  'monthly-inflow': { label: `Monthly inflow (${YEAR})`, kind: 'series', url: `/api/field/analytics/monthly-inflow?year=${YEAR}`, for: ['bar', 'line', 'table'] },
  'monthly-lifting': { label: `Monthly lifting (${YEAR})`, kind: 'series', url: `/api/field/analytics/monthly-lifting?year=${YEAR}`, for: ['bar', 'line', 'table'] },
  'stock-balance': { label: 'Stock balance by node', kind: 'rows', url: '/api/field/analytics/stock-balance', for: ['pie', 'bar', 'table'] },
}

export function sourcesFor(type: WidgetType): [string, SourceDef][] {
  return Object.entries(SOURCES).filter(([, s]) => s.for.includes(type))
}

export const WIDGET_TYPES: { type: WidgetType; label: string; hint: string }[] = [
  { type: 'kpi', label: 'KPI tile', hint: 'A single headline number from a metric set' },
  { type: 'line', label: 'Line chart', hint: 'A trend over time' },
  { type: 'bar', label: 'Bar chart', hint: 'Compare values across periods or nodes' },
  { type: 'pie', label: 'Pie chart', hint: 'Composition / share of a total' },
  { type: 'table', label: 'Table', hint: 'Raw rows from a data source' },
  { type: 'formula', label: 'Formula value', hint: 'Evaluate a saved DSL expression to one number' },
]

let n = 0
export function newWidgetId(): string {
  n += 1
  return `w-${Date.now().toString(36)}-${n.toString(36)}`
}

export function parseLayout(json: string | null | undefined): DashboardLayout {
  if (!json) return { widgets: [] }
  try {
    const v = JSON.parse(json)
    const widgets = Array.isArray(v?.widgets) ? v.widgets : []
    return { widgets: widgets.filter((w: unknown) => w && typeof w === 'object') }
  } catch {
    return { widgets: [] }
  }
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
