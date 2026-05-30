'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type Node = { id: string; code: string; name: string }
type Target = { id: string; year: number; month: number; category: string; targetVol: number | null; node: { code: string; name: string } }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CATEGORIES = ['production', 'lifting', 'transfer']

export default function TargetsPage() {
  const year = new Date().getFullYear()
  const [nodes, setNodes] = useState<Node[]>([])
  const [rows, setRows] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nodeId: '', year: String(year), month: '1', category: 'production', targetVol: '' })

  async function load() {
    const [n, t] = await Promise.all([
      fetch('/api/field/nodes').then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/field/targets?year=${year}`).then((r) => (r.ok ? r.json() : [])),
    ])
    setNodes(n); setRows(t); setLoading(false)
    if (n.length && !form.nodeId) setForm((s) => ({ ...s, nodeId: n[0].id }))
  }
  useEffect(() => { load() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/field/targets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, year: Number(form.year), month: Number(form.month) }) })
    setSaving(false)
    if (res.ok) { toast.success('Target set'); setForm({ ...form, targetVol: '' }); load() }
    else toast.error((await res.json().catch(() => ({})))?.error || 'Failed')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Set target" sub="Monthly production / lifting / transfer targets per node (RKAP).">
        <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Node</WsLabel><select style={wsField} value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: e.target.value })} required><option value="">Select…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Month</WsLabel><select style={wsField} value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Category</WsLabel><select style={wsField} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Target vol</WsLabel><input className="mb-num" type="number" step="any" style={wsField} value={form.targetVol} onChange={(e) => setForm({ ...form, targetVol: e.target.value })} required /></label>
          <Btn kind="primary" icon="plus">{saving ? 'Saving…' : 'Set'}</Btn>
        </form>
      </Panel>

      <Panel title={`Targets · ${year}`} pad={0}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Node', 'Month', 'Category', 'Target'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No targets for {year}.</td></tr>}
              {rows.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{t.node.code} · {t.node.name}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--mb-ink-muted)' }}>{MONTHS[t.month - 1]} {t.year}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--c-fieldflow)', fontWeight: 600, textTransform: 'uppercase' }}>{t.category}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)', textAlign: 'right' }}>{t.targetVol?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
