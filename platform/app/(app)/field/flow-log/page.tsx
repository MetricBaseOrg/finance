'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type Node = { id: string; code: string; name: string }
type Flow = { id: string; date: string; flowType: string; volume: number; node: { code: string; name: string } }
const FLOW_TYPES = ['inflow', 'outflow', 'stock']

export default function FlowLogPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ nodeId: '', date: today, flowType: 'inflow', volume: '' })

  async function load() {
    const [n, f] = await Promise.all([
      fetch('/api/field/nodes').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/field/flows?days=120').then((r) => (r.ok ? r.json() : [])),
    ])
    setNodes(n); setFlows(f); setLoading(false)
    if (n.length && !form.nodeId) setForm((s) => ({ ...s, nodeId: n[0].id }))
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/field/flows', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (res.ok) { toast.success('Flow logged'); setForm({ ...form, volume: '' }); load() }
    else toast.error((await res.json().catch(() => ({})))?.error || 'Failed')
  }
  async function remove(id: string) {
    const res = await fetch(`/api/field/flows/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); load() } else toast.error('Delete failed')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Log flow" sub="Daily inflow, outflow, and stock snapshots per node.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Node</WsLabel><select style={wsField} value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: e.target.value })} required><option value="">Select…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Date</WsLabel><input className="mb-num" type="date" style={wsField} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Type</WsLabel><select style={wsField} value={form.flowType} onChange={(e) => setForm({ ...form, flowType: e.target.value })}>{FLOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Volume</WsLabel><input className="mb-num" type="number" step="any" style={wsField} value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} required /></label>
          <Btn kind="primary" icon="plus">{saving ? 'Saving…' : 'Log flow'}</Btn>
        </form>
      </Panel>

      <Panel title="Flow log" pad={0}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'Node', 'Type', 'Volume', ''].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {flows.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No flows logged.</td></tr>}
              {flows.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>{f.date}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{f.node.code} · {f.node.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--c-fieldflow)', fontWeight: 600, textTransform: 'uppercase' }}>{f.flowType}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)', textAlign: 'right' }}>{f.volume.toLocaleString()}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right' }}><Btn kind="quiet" onClick={() => remove(f.id)} style={{ color: 'var(--mb-bad-ink)' }}>Delete</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
