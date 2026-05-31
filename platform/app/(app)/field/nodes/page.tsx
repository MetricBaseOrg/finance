'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Panel, Btn, Pill, wsField, WsLabel } from '@/app/home/ui'

type Node = { id: string; code: string; name: string; nodeType: string; unit: string; capacity: number | null; openingStock: number; active: boolean }
const NODE_TYPES = ['well', 'field', 'storage', 'pipeline', 'terminal', 'buyer']

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ code: '', name: '', nodeType: 'well', openingStock: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/field/nodes')
    if (res.ok) setNodes(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/field/nodes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (res.ok) { toast.success('Node added'); setForm({ code: '', name: '', nodeType: 'well', openingStock: '' }); load() }
    else toast.error((await res.json().catch(() => ({})))?.error || 'Failed to add node')
  }
  async function remove(id: string) {
    if (!confirm('Delete this node and its flows?')) return
    const res = await fetch(`/api/field/nodes/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); load() } else toast.error('Delete failed')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Add node" sub="Wells, fields, storage, pipelines, terminals, buyers.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Code</WsLabel><input className="mb-num" style={wsField} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Name</WsLabel><input style={wsField} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Type</WsLabel><select style={wsField} value={form.nodeType} onChange={(e) => setForm({ ...form, nodeType: e.target.value })}>{NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Opening stock</WsLabel><input className="mb-num" type="number" step="any" style={wsField} value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value })} /></label>
          <Btn kind="primary" icon="plus">{saving ? 'Adding…' : 'Add node'}</Btn>
        </form>
      </Panel>

      <Panel title="Nodes" pad={0}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Code', 'Name', 'Type', 'Opening', ''].map((h, i) => <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {nodes.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No nodes yet.</td></tr>}
              {nodes.map((n) => (
                <tr key={n.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--c-fieldflow)', fontWeight: 600 }}>{n.code}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{n.name}{!n.active && <Pill style={{ marginLeft: 8 }}>archived</Pill>}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--mb-ink-muted)', textTransform: 'uppercase' }}>{n.nodeType}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)', textAlign: 'right' }}>{n.openingStock.toLocaleString()}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link href={`/field/tasks?refType=node&refId=${n.id}&refLabel=${encodeURIComponent(`${n.code} · ${n.name}`)}&title=${encodeURIComponent(`Work at ${n.code}`)}`} style={{ color: 'var(--c-fieldflow)', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, marginRight: 12 }}>Assign task</Link>
                    <Btn kind="quiet" onClick={() => remove(n.id)} style={{ color: 'var(--mb-bad-ink)' }}>Delete</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
