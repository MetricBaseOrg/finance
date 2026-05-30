'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type Node = { id: string; code: string; name: string }
type Transfer = {
  id: string; date: string; volume: number; receiptVolume: number | null; memo: string | null
  fromNode: { code: string; name: string }; toNode: { code: string; name: string }
}

const today = () => new Date().toISOString().slice(0, 10)

export default function TransfersPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fromNodeId: '', toNodeId: '', date: today(), volume: '', receiptVolume: '', memo: '' })

  async function load() {
    const [n, t] = await Promise.all([fetch('/api/field/nodes'), fetch('/api/field/transfers')])
    if (n.ok) setNodes(await n.json())
    if (t.ok) setTransfers(await t.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fromNodeId || !form.toNodeId) { toast.error('Pick both nodes'); return }
    if (form.fromNodeId === form.toNodeId) { toast.error('From and To must differ'); return }
    setSaving(true)
    const res = await fetch('/api/field/transfers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fromNodeId: form.fromNodeId, toNodeId: form.toNodeId, date: form.date,
        volume: Number(form.volume),
        receiptVolume: form.receiptVolume === '' ? null : Number(form.receiptVolume),
        memo: form.memo || null,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Transfer logged'); setForm({ fromNodeId: '', toNodeId: '', date: today(), volume: '', receiptVolume: '', memo: '' }); load() }
    else toast.error((await res.json().catch(() => ({})))?.error || 'Failed to add transfer')
  }

  async function remove(id: string) {
    if (!confirm('Delete this transfer?')) return
    const res = await fetch(`/api/field/transfers/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); setTransfers((p) => p.filter((t) => t.id !== id)) } else toast.error('Delete failed')
  }

  const lossGain = (t: Transfer) => (t.receiptVolume == null ? null : t.receiptVolume - t.volume)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Log transfer" sub="Move volume between nodes. Receipt volume (destination meter) drives custody-transfer loss/gain.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>From</WsLabel>
            <select style={wsField} value={form.fromNodeId} onChange={(e) => setForm({ ...form, fromNodeId: e.target.value })} required>
              <option value="">—</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>To</WsLabel>
            <select style={wsField} value={form.toNodeId} onChange={(e) => setForm({ ...form, toNodeId: e.target.value })} required>
              <option value="">—</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Date</WsLabel><input type="date" style={wsField} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Volume</WsLabel><input className="mb-num" type="number" step="any" style={wsField} value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Receipt vol</WsLabel><input className="mb-num" type="number" step="any" style={wsField} value={form.receiptVolume} onChange={(e) => setForm({ ...form, receiptVolume: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Memo</WsLabel><input style={wsField} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></label>
          <Btn kind="primary" icon="plus">{saving ? 'Saving…' : 'Log transfer'}</Btn>
        </form>
      </Panel>

      <Panel title="Transfers" pad={0}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Date', 'From', 'To', 'Volume', 'Receipt', 'L/G', 'Memo', ''].map((h, i) => <th key={h} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {transfers.length === 0 && <tr><td colSpan={8} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No transfers yet.</td></tr>}
              {transfers.map((t) => {
                const lg = lossGain(t)
                return (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                    <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{t.date}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--c-fieldflow)', fontWeight: 600 }}>{t.fromNode.code}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--c-fieldflow)', fontWeight: 600 }}>{t.toNode.code}</td>
                    <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)', textAlign: 'right' }}>{t.volume.toLocaleString()}</td>
                    <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink-muted)', textAlign: 'right' }}>{t.receiptVolume?.toLocaleString() ?? '—'}</td>
                    <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, textAlign: 'right', color: lg == null ? 'var(--mb-ink-muted)' : lg < 0 ? 'var(--mb-bad-ink, #e5484d)' : 'var(--mb-good-ink, #30a46c)' }}>{lg == null ? '—' : lg.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--mb-ink-muted)' }}>{t.memo ?? ''}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right' }}><Btn kind="quiet" onClick={() => remove(t.id)} style={{ color: 'var(--mb-bad-ink)' }}>Delete</Btn></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
