'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type Formula = { id: string; name: string; expr: string; description: string | null; refSeriesMode: string }

export default function FormulasPage() {
  const [rows, setRows] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', expr: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [test, setTest] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)

  async function load() { const r = await fetch('/api/field/formulas'); if (r.ok) setRows(await r.json()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const r = await fetch('/api/field/formulas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (r.ok) { toast.success('Formula saved'); setForm({ name: '', expr: '', description: '' }); load() }
    else toast.error((await r.json().catch(() => ({})))?.error || 'Failed')
  }
  async function remove(id: string) { const r = await fetch(`/api/field/formulas/${id}`, { method: 'DELETE' }); if (r.ok) { toast.success('Deleted'); load() } else toast.error('Delete failed') }
  async function runTest() {
    setTestResult('…')
    const r = await fetch('/api/field/formula-eval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expr: test }) })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) { setTestResult(`Error: ${data?.error ?? r.status}`); return }
    setTestResult(data?.total != null ? `total = ${data.total}` : JSON.stringify(data).slice(0, 400))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Formula library" sub="Saved DSL expressions (e.g. (lifting_volume / inflow) * 100), reusable from any dashboard widget. Evaluated by the field engine.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Name</WsLabel><input style={wsField} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Expression</WsLabel><input className="mb-num" style={wsField} value={form.expr} onChange={(e) => setForm({ ...form, expr: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Description</WsLabel><input style={wsField} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <Btn kind="primary" icon="plus">{saving ? '…' : 'Save'}</Btn>
        </form>
      </Panel>

      <Panel title="Test an expression">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="mb-num" style={{ ...wsField, flex: 1, minWidth: 220 }} placeholder="(lifting_volume / inflow) * 100" value={test} onChange={(e) => setTest(e.target.value)} />
          <Btn kind="soft" onClick={runTest}>Evaluate</Btn>
        </div>
        {testResult && <p className="mb-num" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--mb-ink)' }}>{testResult}</p>}
      </Panel>

      <Panel title="Saved formulas" pad={0}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name', 'Expression', 'Description', ''].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No saved formulas.</td></tr>}
              {rows.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--c-fieldflow)', fontWeight: 600 }}>{f.name}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--mb-ink)' }}>{f.expr}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--mb-ink-muted)' }}>{f.description ?? '—'}</td>
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
