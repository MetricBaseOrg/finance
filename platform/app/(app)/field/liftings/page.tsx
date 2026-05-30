'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type NodeRef = { code: string; name: string } | null
type Lifting = { id: string; tankerName: string; status: string; nominated: number | null; fromNode: NodeRef; buyerNode: NodeRef }
type Node = { id: string; code: string; name: string; nodeType: string }
const STATUS = ['tentative', 'active', 'completed', 'cancelled']

export default function LiftingsPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [rows, setRows] = useState<Lifting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tankerName: '', fromNodeId: '', buyerNodeId: '', nominated: '', status: 'tentative' })

  async function load() {
    const [n, l] = await Promise.all([
      fetch('/api/field/nodes').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/field/liftings').then((r) => (r.ok ? r.json() : [])),
    ])
    setNodes(n); setRows(l); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/field/liftings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (res.ok) { toast.success('Lifting added'); setForm({ ...form, tankerName: '', nominated: '' }); load() }
    else toast.error((await res.json().catch(() => ({})))?.error || 'Failed')
  }
  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/field/liftings/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) load(); else toast.error('Update failed')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Add lifting" sub="Tanker loading events from storage/terminal to buyers.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Tanker</WsLabel><input style={wsField} value={form.tankerName} onChange={(e) => setForm({ ...form, tankerName: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>From</WsLabel><select style={wsField} value={form.fromNodeId} onChange={(e) => setForm({ ...form, fromNodeId: e.target.value })}><option value="">—</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Buyer</WsLabel><select style={wsField} value={form.buyerNodeId} onChange={(e) => setForm({ ...form, buyerNodeId: e.target.value })}><option value="">—</option>{nodes.filter((n) => n.nodeType === 'buyer').map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Nominated</WsLabel><input className="mb-num" type="number" step="any" style={wsField} value={form.nominated} onChange={(e) => setForm({ ...form, nominated: e.target.value })} /></label>
          <Btn kind="primary" icon="plus">{saving ? 'Saving…' : 'Add'}</Btn>
        </form>
      </Panel>

      <Panel title="Liftings" pad={0}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Tanker', 'From', 'Buyer', 'Nominated', 'Status'].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No liftings.</td></tr>}
              {rows.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{l.tankerName}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--mb-ink-muted)' }}>{l.fromNode?.code ?? '—'}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--mb-ink-muted)' }}>{l.buyerNode?.code ?? '—'}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)', textAlign: 'right' }}>{l.nominated?.toLocaleString() ?? '—'}</td>
                  <td style={{ padding: '8px 16px' }}><select style={{ ...wsField, padding: '5px 8px', width: 'auto' }} value={l.status} onChange={(e) => setStatus(l.id, e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
