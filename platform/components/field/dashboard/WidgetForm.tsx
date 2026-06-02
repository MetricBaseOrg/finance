'use client'

import { useEffect, useState } from 'react'
import { Btn, wsField, WsLabel } from '@/app/home/ui'
import {
  SOURCES, sourcesFor, WIDGET_TYPES, newWidgetId, flattenNumbers,
  type Widget, type WidgetType, type PillMode,
} from '@/lib/field/widgets'

// Chart types that plot a single primary metric (offer a "value field" override).
const SINGLE_METRIC_CHARTS: WidgetType[] = ['line', 'bar', 'pie', 'area', 'multi-line', 'stacked-bar']

const selectStyle = { ...wsField, appearance: 'auto' as const }

// Load the metric keys of a kpiset source so the KPI widget can pick one.
function useKpiKeys(source: string | undefined, active: boolean): string[] {
  const [keys, setKeys] = useState<string[]>([])
  useEffect(() => {
    const src = source ? SOURCES[source] : null
    if (!active || !src || src.kind !== 'kpiset') { setKeys([]); return }
    let alive = true
    fetch(src.url).then(async (r) => {
      if (!alive || !r.ok) return
      const d = await r.json().catch(() => ({}))
      if (alive && d && typeof d === 'object') setKeys(flattenNumbers(d as Record<string, unknown>).map(([k]) => k))
    }).catch(() => {})
    return () => { alive = false }
  }, [source, active])
  return keys
}

export function WidgetForm({ initial, onSave, onCancel }: {
  initial?: Widget
  onSave: (w: Widget) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<WidgetType>(initial?.type ?? 'kpi')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [source, setSource] = useState<string | undefined>(initial?.source)
  const [metric, setMetric] = useState<string>(initial?.metric ?? '')
  const [metric2, setMetric2] = useState<string>(initial?.metric2 ?? '')
  const [series1Kind, setSeries1Kind] = useState<'line' | 'bar'>(initial?.series1Kind ?? 'bar')
  const [series2Kind, setSeries2Kind] = useState<'line' | 'bar'>(initial?.series2Kind ?? 'line')
  const [pillMode, setPillMode] = useState<PillMode>(initial?.pillMode ?? 'difference')
  const [pillFormula, setPillFormula] = useState(initial?.pillFormula ?? '')
  const [pillUnit, setPillUnit] = useState(initial?.pillUnit ?? '')
  const [formula, setFormula] = useState(initial?.formula ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [w, setW] = useState<Widget['w']>(initial?.w ?? (initial?.type === 'kpi' ? 1 : 2))
  const [showHeader, setShowHeader] = useState(!initial?.hideHeader)

  const options = sourcesFor(type)
  const kpiKeys = useKpiKeys(source, type === 'kpi')

  // Keep source valid when type changes.
  useEffect(() => {
    if (type === 'formula') return
    if (!source || !SOURCES[source]?.for.includes(type)) {
      setSource(options[0]?.[0])
      setMetric('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const base: Widget = {
      id: initial?.id ?? newWidgetId(),
      type, w,
      title: title.trim() || defaultTitle(),
    }
    if (!showHeader) base.hideHeader = true
    if (type === 'formula') { base.formula = formula.trim(); base.unit = unit.trim() || undefined }
    else {
      base.source = source
      if (metric) base.metric = metric
      if (type === 'kpi') {
        base.unit = unit.trim() || undefined
        if (metric2) {
          base.metric2 = metric2
          base.pillMode = pillMode
          if (pillMode === 'formula') base.pillFormula = pillFormula.trim()
          if (pillUnit.trim()) base.pillUnit = pillUnit.trim()
        }
      }
      if (type === 'combo') {
        if (metric2) base.metric2 = metric2
        base.series1Kind = series1Kind
        base.series2Kind = series2Kind
      }
      if (type === 'scatter' && metric2) base.metric2 = metric2
    }
    onSave(base)
  }

  function defaultTitle() {
    if (type === 'formula') return formula.trim().slice(0, 40) || 'Formula'
    return source ? SOURCES[source]?.label ?? 'Widget' : 'Widget'
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 13 }}>
      <label style={{ display: 'grid', gap: 5 }}>
        <WsLabel>Widget type</WsLabel>
        <select style={selectStyle} value={type} onChange={(e) => setType(e.target.value as WidgetType)}>
          {WIDGET_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>{WIDGET_TYPES.find((t) => t.type === type)?.hint}</span>
      </label>

      <label style={{ display: 'grid', gap: 5 }}>
        <WsLabel>Title</WsLabel>
        <input style={wsField} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle()} />
      </label>

      {type === 'formula' ? (
        <>
          <label style={{ display: 'grid', gap: 5 }}>
            <WsLabel>Expression</WsLabel>
            <input className="mb-num" style={wsField} value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="(lifting_volume / inflow) * 100" required />
            <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>Same DSL as the Formulas tab. References saved formulas + base metrics.</span>
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <WsLabel>Unit (optional)</WsLabel>
            <input style={wsField} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, bbl, …" />
          </label>
        </>
      ) : (
        <>
          <label style={{ display: 'grid', gap: 5 }}>
            <WsLabel>Data source</WsLabel>
            <select style={selectStyle} value={source ?? ''} onChange={(e) => { setSource(e.target.value); setMetric('') }} required>
              {options.length === 0 && <option value="">No source for this type</option>}
              {options.map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
            </select>
          </label>

          {type === 'kpi' && (
            <label style={{ display: 'grid', gap: 5 }}>
              <WsLabel>Metric</WsLabel>
              <select style={selectStyle} value={metric} onChange={(e) => setMetric(e.target.value)}>
                <option value="">First available</option>
                {kpiKeys.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
              {kpiKeys.length === 0 && <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>Metric list loads when the engine is online.</span>}
            </label>
          )}

          {type === 'kpi' && (
            <label style={{ display: 'grid', gap: 5 }}>
              <WsLabel>Comparison metric (optional)</WsLabel>
              <select style={selectStyle} value={metric2} onChange={(e) => setMetric2(e.target.value)}>
                <option value="">None — no pill</option>
                {kpiKeys.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>Shows a pill comparing the primary metric (a) to this one (b).</span>
            </label>
          )}

          {type === 'kpi' && metric2 && (
            <>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>Pill shows</WsLabel>
                <select style={selectStyle} value={pillMode} onChange={(e) => setPillMode(e.target.value as PillMode)}>
                  <option value="difference">Difference (a − b)</option>
                  <option value="ratio">Ratio (a ÷ b, %)</option>
                  <option value="pctchange">% change ((a − b) ÷ b)</option>
                  <option value="raw">Raw value (b)</option>
                  <option value="formula">Custom formula</option>
                </select>
              </label>
              {pillMode === 'formula' && (
                <label style={{ display: 'grid', gap: 5 }}>
                  <WsLabel>Pill formula</WsLabel>
                  <input className="mb-num" style={wsField} value={pillFormula} onChange={(e) => setPillFormula(e.target.value)} placeholder="(a - b) / b * 100" />
                  <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>Use <code>a</code> (primary) and <code>b</code> (comparison) with + − × ÷ and ( ).</span>
                </label>
              )}
              {pillMode !== 'ratio' && pillMode !== 'pctchange' && (
                <label style={{ display: 'grid', gap: 5 }}>
                  <WsLabel>Pill unit (optional)</WsLabel>
                  <input style={wsField} value={pillUnit} onChange={(e) => setPillUnit(e.target.value)} placeholder="bbl, %, …" />
                </label>
              )}
            </>
          )}

          {SINGLE_METRIC_CHARTS.includes(type) && (
            <label style={{ display: 'grid', gap: 5 }}>
              <WsLabel>Value field (optional)</WsLabel>
              <input className="mb-num" style={wsField} value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="auto-detect" />
              <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>
                {type === 'multi-line' || type === 'stacked-bar'
                  ? 'Sets the first/primary series; remaining numeric fields are plotted automatically.'
                  : 'Leave blank to auto-pick the first numeric field.'}
              </span>
            </label>
          )}

          {type === 'combo' && (
            <>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>Left-axis field (optional)</WsLabel>
                <input className="mb-num" style={wsField} value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="auto (first numeric)" />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>Left-axis style</WsLabel>
                <select style={selectStyle} value={series1Kind} onChange={(e) => setSeries1Kind(e.target.value as 'line' | 'bar')}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>Right-axis field (optional)</WsLabel>
                <input className="mb-num" style={wsField} value={metric2} onChange={(e) => setMetric2(e.target.value)} placeholder="auto (second numeric)" />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>Right-axis style</WsLabel>
                <select style={selectStyle} value={series2Kind} onChange={(e) => setSeries2Kind(e.target.value as 'line' | 'bar')}>
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                </select>
              </label>
            </>
          )}

          {type === 'scatter' && (
            <>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>X field (optional)</WsLabel>
                <input className="mb-num" style={wsField} value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="auto (first numeric)" />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <WsLabel>Y field (optional)</WsLabel>
                <input className="mb-num" style={wsField} value={metric2} onChange={(e) => setMetric2(e.target.value)} placeholder="auto (second numeric)" />
              </label>
            </>
          )}

          {type === 'kpi' && (
            <label style={{ display: 'grid', gap: 5 }}>
              <WsLabel>Unit (optional)</WsLabel>
              <input style={wsField} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bbl, %, …" />
            </label>
          )}
        </>
      )}

      <label style={{ display: 'grid', gap: 5 }}>
        <WsLabel>Width</WsLabel>
        <select style={selectStyle} value={w} onChange={(e) => setW(Number(e.target.value) as Widget['w'])}>
          <option value={1}>1 column (¼)</option>
          <option value={2}>2 columns (½)</option>
          <option value={3}>3 columns (¾)</option>
          <option value={4}>4 columns (full)</option>
        </select>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} />
        <WsLabel>Show title bar</WsLabel>
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn kind="quiet" onClick={onCancel}>Cancel</Btn>
        <Btn kind="primary" icon={initial ? undefined : 'plus'}>{initial ? 'Save widget' : 'Add widget'}</Btn>
      </div>
    </form>
  )
}
