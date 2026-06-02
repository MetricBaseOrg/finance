'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Btn, Icon, Panel, wsField, WsLabel } from '@/app/home/ui'
import {
  parseLayout, resolveRange, DEFAULT_RANGE, RANGE_PRESETS,
  type Dashboard, type DashboardRange, type RangePreset, type Widget,
} from '@/lib/field/widgets'
import { DashboardRangeProvider, WidgetBody, widgetNeedsChartHeight } from './DashboardWidget'
import { WidgetForm } from './WidgetForm'

type Raw = Dashboard

export function DashboardBuilder({ canManage }: { canManage: boolean }) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [range, setRange] = useState<DashboardRange>(DEFAULT_RANGE)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<Widget | null>(null)
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const current = dashboards.find((d) => d.id === currentId) ?? null

  const selectDashboard = useCallback((d: Dashboard) => {
    const layout = parseLayout(d.layoutJson)
    setCurrentId(d.id)
    setWidgets(layout.widgets)
    setRange(layout.range ?? DEFAULT_RANGE)
  }, [])

  const load = useCallback(async (preferId?: string) => {
    const r = await fetch('/api/field/dashboards')
    if (!r.ok) { setLoading(false); return }
    let list: Raw[] = await r.json().catch(() => [])
    // Bootstrap a first workspace dashboard — managers only (members are view-only).
    if (list.length === 0 && canManage) {
      const c = await fetch('/api/field/dashboards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Team Dashboard' }) })
      if (c.ok) { const created: Raw = await c.json(); await fetch(`/api/field/dashboards/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: true }) }); list = [{ ...created, active: true }] }
    }
    setDashboards(list)
    const pick = list.find((d) => d.id === preferId) ?? list.find((d) => d.active) ?? list[0]
    if (pick) {
      const layout = parseLayout(pick.layoutJson)
      setCurrentId(pick.id); setWidgets(layout.widgets); setRange(layout.range ?? DEFAULT_RANGE)
    }
    setLoading(false)
  }, [canManage])

  useEffect(() => { load() }, [load])

  // Persist the current widget array back to the active dashboard (keeps the range).
  const persist = useCallback(async (next: Widget[]) => {
    setWidgets(next)
    if (!currentId) return
    const layoutJson = JSON.stringify({ widgets: next, range })
    setDashboards((ds) => ds.map((d) => (d.id === currentId ? { ...d, layoutJson } : d)))
    const r = await fetch(`/api/field/dashboards/${currentId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutJson }) })
    if (!r.ok) toast.error('Failed to save layout')
  }, [currentId, range])

  // Change the dashboard time range. Always applies locally (instant refetch);
  // managers also persist it so the whole team sees the same default window.
  const changeRange = useCallback((next: DashboardRange) => {
    setRange(next)
    if (!canManage || !currentId) return
    const layoutJson = JSON.stringify({ widgets, range: next })
    setDashboards((ds) => ds.map((d) => (d.id === currentId ? { ...d, layoutJson } : d)))
    fetch(`/api/field/dashboards/${currentId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutJson }) })
      .then((r) => { if (!r.ok) toast.error('Failed to save range') })
      .catch(() => toast.error('Failed to save range'))
  }, [canManage, currentId, widgets])

  // ── Dashboard management ───────────────────────────────────────────────────
  async function createDashboard() {
    const name = window.prompt('New dashboard name', `Dashboard ${dashboards.length + 1}`)
    if (!name?.trim()) return
    const r = await fetch('/api/field/dashboards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(d?.error || 'Failed'); return }
    toast.success('Dashboard created')
    await load(d.id)
    setEditing(true)
  }

  async function renameDashboard() {
    if (!current) return
    const name = window.prompt('Rename dashboard', current.name)
    if (!name?.trim() || name.trim() === current.name) return
    const r = await fetch(`/api/field/dashboards/${current.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
    if (!r.ok) { toast.error((await r.json().catch(() => ({})))?.error || 'Failed'); return }
    setDashboards((ds) => ds.map((d) => (d.id === current.id ? { ...d, name: name.trim() } : d)))
    toast.success('Renamed')
  }

  async function deleteDashboard() {
    if (!current) return
    if (!window.confirm(`Delete “${current.name}”? This can’t be undone.`)) return
    const r = await fetch(`/api/field/dashboards/${current.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.error('Delete failed'); return }
    toast.success('Deleted')
    await load()
  }

  async function setActive() {
    if (!current || current.active) return
    const r = await fetch(`/api/field/dashboards/${current.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: true }) })
    if (!r.ok) { toast.error('Failed'); return }
    setDashboards((ds) => ds.map((d) => ({ ...d, active: d.id === current.id })))
    toast.success('Set as default')
  }

  // ── Widget management ──────────────────────────────────────────────────────
  function saveWidget(w: Widget) {
    const idx = widgets.findIndex((x) => x.id === w.id)
    persist(idx >= 0 ? widgets.map((x) => (x.id === w.id ? w : x)) : [...widgets, w])
    setFormOpen(false); setEditWidget(null)
  }
  function removeWidget(id: string) { persist(widgets.filter((w) => w.id !== id)) }
  function toggleHeader(w: Widget) { persist(widgets.map((x) => (x.id === w.id ? { ...x, hideHeader: !x.hideHeader } : x))) }
  function openAdd() { setEditWidget(null); setFormOpen(true) }
  function openEdit(w: Widget) { setEditWidget(w); setFormOpen(true) }

  function onDrop(to: number) {
    const from = dragFrom.current
    dragFrom.current = null; setDragOver(null)
    if (from == null || from === to) return
    const next = [...widgets]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    persist(next)
  }

  if (loading) return <p style={{ color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {dashboards.map((d) => (
            <button key={d.id} onClick={() => selectDashboard(d)} className="ws-btn"
              title={d.creatorName ? `Created by ${d.creatorName}` : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                background: d.id === currentId ? 'var(--mb-brand-soft)' : 'var(--mb-surface)',
                border: `1px solid ${d.id === currentId ? 'transparent' : 'var(--mb-border)'}`,
                color: d.id === currentId ? 'var(--mb-brand-ink)' : 'var(--mb-ink-2)',
              }}>
              {d.active && <Icon name="star" size={12} color="var(--c-fieldflow)" />}
              {d.name}
            </button>
          ))}
          {canManage && <Btn kind="quiet" icon="plus" onClick={createDashboard}>New</Btn>}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!canManage && (
            <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>View only</span>
          )}
          {canManage && current && !current.active && <Btn kind="ghost" icon="star" onClick={setActive}>Set default</Btn>}
          {canManage && editing && (
            <>
              <Btn kind="quiet" onClick={renameDashboard}>Rename</Btn>
              <Btn kind="quiet" onClick={deleteDashboard}>Delete</Btn>
              <Btn kind="soft" icon="plus" onClick={openAdd}>Add widget</Btn>
            </>
          )}
          {canManage && (
            <Btn kind={editing ? 'primary' : 'ghost'} icon={editing ? undefined : 'settings'} onClick={() => setEditing((v) => !v)}>
              {editing ? 'Done' : 'Edit'}
            </Btn>
          )}
        </div>
      </div>

      {/* Time range — applies to every time-aware widget on the dashboard. */}
      {dashboards.length > 0 && (
        <TimeRangeBar range={range} onChange={changeRange} canManage={canManage} />
      )}

      {/* Grid */}
      {dashboards.length === 0 ? (
        <Panel>
          <div style={{ display: 'grid', placeItems: 'center', gap: 10, padding: '40px 16px', textAlign: 'center' }}>
            <Icon name="chart" size={26} color="var(--mb-ink-muted)" />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mb-ink)' }}>No dashboards yet</div>
            <p style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)', maxWidth: 380, lineHeight: 1.5 }}>
              {canManage
                ? 'Create a shared workspace dashboard — everyone in the team will see it.'
                : 'No dashboards have been set up for this workspace yet. Ask an owner or admin to create one.'}
            </p>
            {canManage && <Btn kind="primary" icon="plus" onClick={createDashboard}>Create dashboard</Btn>}
          </div>
        </Panel>
      ) : widgets.length === 0 ? (
        <Panel>
          <div style={{ display: 'grid', placeItems: 'center', gap: 10, padding: '40px 16px', textAlign: 'center' }}>
            <Icon name="chart" size={26} color="var(--mb-ink-muted)" />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mb-ink)' }}>No widgets yet</div>
            <p style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)', maxWidth: 360, lineHeight: 1.5 }}>
              {canManage
                ? 'Build a custom view of your field operations — KPI tiles, trend charts, composition, raw tables, and live formula values.'
                : 'This dashboard has no widgets yet.'}
            </p>
            {canManage && <Btn kind="primary" icon="plus" onClick={() => { setEditing(true); openAdd() }}>Add your first widget</Btn>}
          </div>
        </Panel>
      ) : (
        <DashboardRangeProvider range={range}>
        <div className="field-dash-grid">
          {widgets.map((w, i) => (
            <div
              key={w.id}
              draggable={editing}
              onDragStart={() => { dragFrom.current = i }}
              onDragOver={(e) => { if (editing) { e.preventDefault(); setDragOver(i) } }}
              onDrop={() => onDrop(i)}
              onDragEnd={() => { dragFrom.current = null; setDragOver(null) }}
              style={{
                gridColumn: `span ${Math.min(w.w, 4)}`,
                minWidth: 0,
                outline: editing && dragOver === i ? '2px dashed var(--c-fieldflow)' : 'none',
                outlineOffset: 2,
                cursor: editing ? 'grab' : 'default',
              }}
            >
              <Panel
                title={editing ? w.title : (w.hideHeader ? undefined : w.title)}
                sub={editing ? `${w.type} · span ${w.w}${w.hideHeader ? ' · title hidden' : ''}` : undefined}
                pad={w.type === 'kpi' || w.type === 'formula' ? 0 : 12}
                right={editing ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => toggleHeader(w)} title={w.hideHeader ? 'Show title bar' : 'Hide title bar'} className="ws-btn" style={iconBtn}><EyeIcon off={!!w.hideHeader} /></button>
                    <button onClick={() => openEdit(w)} title="Edit" className="ws-btn" style={iconBtn}><Icon name="settings" size={13} /></button>
                    <button onClick={() => removeWidget(w.id)} title="Remove" className="ws-btn" style={{ ...iconBtn, color: 'var(--mb-danger, #c0564e)' }}>✕</button>
                  </div>
                ) : undefined}
                style={w.type === 'kpi' || w.type === 'formula' ? { background: 'transparent', border: 'none', boxShadow: 'none' } : undefined}
              >
                {w.type === 'kpi' || w.type === 'formula'
                  ? <WidgetBody widget={w} />
                  : <div style={{ height: widgetNeedsChartHeight(w.type) ? 240 : 'auto' }}><WidgetBody widget={w} /></div>}
              </Panel>
            </div>
          ))}
        </div>
        </DashboardRangeProvider>
      )}

      {formOpen && (
        <Overlay onClose={() => { setFormOpen(false); setEditWidget(null) }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--mb-ink)', marginBottom: 14 }}>{editWidget ? 'Edit widget' : 'Add widget'}</div>
          <WidgetForm initial={editWidget ?? undefined} onSave={saveWidget} onCancel={() => { setFormOpen(false); setEditWidget(null) }} />
        </Overlay>
      )}
    </div>
  )
}

// Dashboard-level time-range control. Preset chips scroll horizontally on narrow
// screens; "Custom" reveals stacking date inputs. Applied to every time-aware widget.
function TimeRangeBar({ range, onChange, canManage }: {
  range: DashboardRange; onChange: (r: DashboardRange) => void; canManage: boolean
}) {
  const { from, to } = resolveRange(range)
  const chip = (active: boolean): React.CSSProperties => ({
    flex: '0 0 auto', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
    padding: '6px 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    background: active ? 'var(--mb-brand-soft)' : 'var(--mb-surface)',
    border: `1px solid ${active ? 'transparent' : 'var(--mb-border)'}`,
    color: active ? 'var(--mb-brand-ink)' : 'var(--mb-ink-2)',
  })
  const setPreset = (preset: RangePreset) =>
    onChange(preset === 'custom' ? { preset, from: range.from ?? from, to: range.to ?? to } : { preset })

  return (
    <div className="ws-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--mb-ink-muted)', flex: '0 0 auto' }}>
          <CalIcon /><WsLabel>Time range</WsLabel>
        </span>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, minWidth: 0, paddingBottom: 2 }}>
          {RANGE_PRESETS.map((p) => (
            <button key={p.preset} className="ws-btn" style={chip(range.preset === p.preset)} onClick={() => setPreset(p.preset)}>{p.label}</button>
          ))}
          <button className="ws-btn" style={chip(range.preset === 'custom')} onClick={() => setPreset('custom')}>Custom</button>
        </div>
      </div>

      {range.preset === 'custom' ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: 4, flex: '1 1 150px', minWidth: 0 }}>
            <WsLabel>From</WsLabel>
            <input type="date" style={wsField} value={range.from ?? ''} max={range.to || undefined}
              onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to: range.to })} />
          </label>
          <label style={{ display: 'grid', gap: 4, flex: '1 1 150px', minWidth: 0 }}>
            <WsLabel>To</WsLabel>
            <input type="date" style={wsField} value={range.to ?? ''} min={range.from || undefined}
              onChange={(e) => onChange({ preset: 'custom', from: range.from, to: e.target.value })} />
          </label>
        </div>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)', fontFamily: 'var(--mb-font-mono)' }}>{from} → {to}</span>
      )}
      {!canManage && <span style={{ fontSize: 10.5, color: 'var(--mb-ink-muted)' }}>Changes apply to your view only.</span>}
    </div>
  )
}

// Calendar glyph (no matching key in the shared Icon set).
function CalIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  )
}

// Eye / eye-off glyph (no matching key in the shared Icon set).
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
  borderRadius: 6, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)',
  color: 'var(--mb-ink-2)', cursor: 'pointer', fontSize: 12, lineHeight: 1,
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="ws-card" style={{ width: 'min(460px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
        {children}
      </div>
    </div>
  )
}
