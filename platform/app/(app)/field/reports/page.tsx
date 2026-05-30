'use client'

import { useCallback, useEffect, useState } from 'react'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type View = 'summary' | 'monthly' | 'stock'

const now = new Date()

export default function FieldReportsPage() {
  const [view, setView] = useState<View>('summary')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null); setData(null)
    const path =
      view === 'summary' ? 'summary'
      : view === 'monthly' ? `monthly-summary?year=${year}&month=${month}`
      : 'stock-balance'
    try {
      const res = await fetch(`/api/field/analytics/${path}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Report failed'); return }
      setData(json)
    } catch {
      setError('Could not load report (is the field engine running?)')
    } finally {
      setLoading(false)
    }
  }, [view, year, month])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Reports" sub="Computed from your flows, transfers, liftings and targets.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          {(['summary', 'monthly', 'stock'] as View[]).map((v) => (
            <Btn key={v} kind={view === v ? 'primary' : 'soft'} onClick={() => setView(v)}>
              {v === 'summary' ? 'Today summary' : v === 'monthly' ? 'Monthly' : 'Stock balance'}
            </Btn>
          ))}
          {view === 'monthly' && (
            <>
              <label style={{ display: 'grid', gap: 5 }}><WsLabel>Year</WsLabel><input className="mb-num" type="number" style={{ ...wsField, width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
              <label style={{ display: 'grid', gap: 5 }}><WsLabel>Month</WsLabel><input className="mb-num" type="number" min={1} max={12} style={{ ...wsField, width: 70 }} value={month} onChange={(e) => setMonth(Number(e.target.value))} /></label>
            </>
          )}
          <Btn kind="soft" href="/api/field/export/xlsx" icon="download">Export all .xlsx</Btn>
        </div>
      </Panel>

      {loading && <Panel title="Loading…"><div style={{ padding: 6, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Computing report…</div></Panel>}
      {error && <Panel title="Unavailable"><div style={{ padding: 6, color: 'var(--mb-bad-ink, #e5484d)', fontSize: 12.5 }}>{error}</div></Panel>}

      {!loading && !error && data && view === 'summary' && <SummaryReport data={data} />}
      {!loading && !error && data && view === 'monthly' && <MonthlyReport data={data} />}
      {!loading && !error && data && view === 'stock' && <StockReport data={data} />}
    </div>
  )
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return String(v)
}

function Kpi({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ border: '1px solid var(--mb-divider)', borderRadius: 10, padding: '12px 14px', minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)' }}>{label}</div>
      <div className="mb-num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--mb-ink)', marginTop: 4 }}>{fmt(value)}</div>
    </div>
  )
}

/** Generic table for an array of flat objects — robust to the engine's exact field names. */
function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div style={{ padding: 16, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No rows.</div>
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{cols.map((c) => <th key={c} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 14px', fontFamily: 'var(--mb-font-mono)' }}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderTop: '1px solid var(--mb-divider)' }}>
            {cols.map((c) => <td key={c} className="mb-num" style={{ padding: '9px 14px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{fmt(r[c])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function asRows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}

function SummaryReport({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <Panel title={`Snapshot · ${fmt(data.date)}`}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Kpi label="Total inflow" value={data.total_inflow} />
          <Kpi label="YTD inflow" value={data.ytd_inflow} />
          <Kpi label="YTD lifting" value={data.ytd_lifting} />
          <Kpi label="Transfers today" value={Array.isArray(data.transfers_today) ? (data.transfers_today as unknown[]).length : data.transfers_today} />
          <Kpi label="Active lifting" value={data.active_lifting ? ((data.active_lifting as Record<string, unknown>).tanker_name ?? 'yes') : 'none'} />
        </div>
      </Panel>
      <Panel title="Stock by node" pad={0}><DataTable rows={asRows(data.stocks)} /></Panel>
      <Panel title="SW readings" pad={0}><DataTable rows={asRows(data.sw_readings)} /></Panel>
    </>
  )
}

function MonthlyReport({ data }: { data: Record<string, unknown> }) {
  const liftings = (data.liftings ?? {}) as Record<string, unknown>
  return (
    <>
      <Panel title={`Liftings · ${fmt(data.year)}-${String(data.month).padStart(2, '0')}`}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Kpi label="Completed liftings" value={liftings.cnt} />
          <Kpi label="Total BL volume" value={liftings.total_bl} />
        </div>
      </Panel>
      <Panel title="Inflow by node" pad={0}><DataTable rows={asRows(data.inflows)} /></Panel>
    </>
  )
}

function StockReport({ data }: { data: Record<string, unknown> }) {
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : asRows((data as Record<string, unknown>).nodes ?? data)
  return <Panel title="Stock balance" pad={0}><DataTable rows={rows} /></Panel>
}
