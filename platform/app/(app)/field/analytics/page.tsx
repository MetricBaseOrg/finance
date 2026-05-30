'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Panel, KTile } from '@/app/home/ui'

type SeriesPoint = { date: string; value: number }
const TEAL = 'var(--c-fieldflow)'

function asNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

export default function FieldAnalyticsPage() {
  const [kpis, setKpis] = useState<{ label: string; value: number }[]>([])
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [engineUp, setEngineUp] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [kpiRes, seriesRes] = await Promise.allSettled([
        fetch('/api/field/analytics/ops-kpis'),
        fetch('/api/field/analytics/inflow-series?days=90'),
      ])
      let up = true
      if (kpiRes.status === 'fulfilled' && kpiRes.value.ok) {
        const data = await kpiRes.value.json().catch(() => ({}))
        const flat = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
        setKpis(Object.entries(flat).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: asNumber(v) })).filter((c) => c.value != null) as { label: string; value: number }[])
      } else if (kpiRes.status === 'fulfilled' && kpiRes.value.status === 503) up = false
      else if (kpiRes.status === 'rejected') up = false

      if (seriesRes.status === 'fulfilled' && seriesRes.value.ok) {
        const rows = await seriesRes.value.json().catch(() => [])
        if (Array.isArray(rows)) setSeries(rows.map((row: Record<string, unknown>) => {
          const date = String(row.date ?? row.day ?? ''); const value = asNumber(row.volume ?? row.total ?? row.value)
          return date && value != null ? { date, value } : null
        }).filter(Boolean) as SeriesPoint[])
      } else if (seriesRes.status === 'fulfilled' && seriesRes.value.status === 503) up = false
      else if (seriesRes.status === 'rejected') up = false

      setEngineUp(up); setLoading(false)
    })()
  }, [])

  if (loading) return <p style={{ color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</p>

  if (engineUp === false) return (
    <Panel title="Compute engine offline">
      <p style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)', lineHeight: 1.5 }}>
        The field analytics engine isn’t reachable. Deploy the <span className="mb-num" style={{ color: TEAL }}>field-engine</span> service
        (it reads the shared Postgres) and set <span className="mb-num">FIELD_ENGINE_BASE</span> / <span className="mb-num">FIELD_ENGINE_TOKEN</span>.
        CRUD (nodes, flows, liftings, targets) works without it.
      </p>
    </Panel>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {kpis.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ws-gap)' }}>
          {kpis.slice(0, 8).map((k) => <KTile key={k.label} label={k.label} value={k.value.toLocaleString()} accent={TEAL} />)}
        </div>
      )}
      <Panel title="Daily inflow (90d)">
        <div style={{ height: 300 }}>
          {series.length === 0 ? (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No inflow data in range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="var(--mb-divider)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--mb-ink-soft)', fontSize: 11 }} minTickGap={32} />
                <YAxis tick={{ fill: 'var(--mb-ink-soft)', fontSize: 11 }} width={56} />
                <Tooltip contentStyle={{ background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="var(--c-fieldflow)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
    </div>
  )
}
