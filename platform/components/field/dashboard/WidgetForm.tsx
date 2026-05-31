'use client'

import { useEffect, useState } from 'react'
import { Btn, wsField, WsLabel } from '@/app/home/ui'
import {
  SOURCES, sourcesFor, WIDGET_TYPES, newWidgetId, asNumber,
  type Widget, type WidgetType,
} from '@/lib/field/widgets'

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
      if (alive && d && typeof d === 'object') setKeys(Object.entries(d).filter(([, v]) => asNumber(v) != null).map(([k]) => k))
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
  const [formula, setFormula] = useState(initial?.formula ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [w, setW] = useState<Widget['w']>(initial?.w ?? (initial?.type === 'kpi' ? 1 : 2))

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
    if (type === 'formula') { base.formula = formula.trim(); base.unit = unit.trim() || undefined }
    else {
      base.source = source
      if (metric) base.metric = metric
      if (type === 'kpi') base.unit = unit.trim() || undefined
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

          {(type === 'line' || type === 'bar' || type === 'pie') && (
            <label style={{ display: 'grid', gap: 5 }}>
              <WsLabel>Value field (optional)</WsLabel>
              <input className="mb-num" style={wsField} value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="auto-detect" />
              <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>Leave blank to auto-pick the first numeric field.</span>
            </label>
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

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Btn kind="quiet" onClick={onCancel}>Cancel</Btn>
        <Btn kind="primary" icon={initial ? undefined : 'plus'}>{initial ? 'Save widget' : 'Add widget'}</Btn>
      </div>
    </form>
  )
}
