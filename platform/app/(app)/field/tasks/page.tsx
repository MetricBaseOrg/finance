'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Panel, Btn, Pill, wsField, WsLabel } from '@/app/home/ui'
import { localInputToIso, formatWhen } from '@/lib/tasks/when'

type Member = { id: string; name: string | null; email: string | null; image: string | null }
type NodeRef = { id: string; code: string; name: string }
type LiftRef = { id: string; tankerName: string }
type FieldTask = {
  id: string; title: string; status: string; priority: string
  startDate: string | null; dueDate: string | null; recurrence: string | null
  assignee: Member | null
  refType: string | null; refId: string | null; refLabel: string | null
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
// Mirrors RECURRENCE_KINDS in lib/recurrence (kept inline so this client page
// doesn't import that server module). '' = does not repeat.
const RECURRENCE: [string, string][] = [['', "Doesn't repeat"], ['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['YEARLY', 'Yearly']]
const RECURRENCE_LABEL: Record<string, string> = Object.fromEntries(RECURRENCE)
const STATUS_LABEL: Record<string, string> = { TODO: 'To do', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review', DONE: 'Done' }

function memberName(m: Member | null) {
  if (!m) return 'Unassigned'
  return m.name || m.email || 'User'
}

function FieldTasksInner() {
  const params = useSearchParams()
  const [tasks, setTasks] = useState<FieldTask[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [nodes, setNodes] = useState<NodeRef[]>([])
  const [liftings, setLiftings] = useState<LiftRef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Prefill from row "Assign task" buttons: ?refType=lifting&refId=...&title=...
  const prefillRefType = params.get('refType')
  const prefillRefId = params.get('refId')
  const prefillRefLabel = params.get('refLabel')
  const [form, setForm] = useState({
    title: params.get('title') || '',
    assigneeId: '',
    startDate: '',
    dueDate: '',
    priority: 'MEDIUM',
    recurrence: '',
    recurrenceEnd: '',
    refKind: (prefillRefType === 'node' || prefillRefType === 'lifting') && !prefillRefId ? prefillRefType : 'none',
    refEntityId: '',
  })

  async function loadTasks() {
    const res = await fetch('/api/field/tasks')
    if (res.ok) { const d = await res.json(); setTasks(d.tasks); setProjectId(d.projectId) }
    setLoading(false)
  }
  useEffect(() => {
    // Ensure the Field Operations project exists, then load supporting data.
    fetch('/api/field/tasks', { method: 'PUT' }).then((r) => r.ok && r.json()).then((d) => d && setProjectId(d.projectId))
    Promise.all([
      fetch('/api/field/members').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/field/nodes').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/field/liftings').then((r) => (r.ok ? r.json() : [])),
    ]).then(([m, n, l]) => { setMembers(m); setNodes(n); setLiftings(l) })
    loadTasks()
  }, [])

  // Resolve the reference to send: explicit prefill (any type) wins, else form picker.
  const resolvedRef = useMemo(() => {
    if (prefillRefId && prefillRefType) return { refType: prefillRefType, refId: prefillRefId, label: prefillRefLabel }
    if (form.refKind === 'node' && form.refEntityId) {
      const n = nodes.find((x) => x.id === form.refEntityId)
      return { refType: 'node', refId: form.refEntityId, label: n ? `${n.code} · ${n.name}` : null }
    }
    if (form.refKind === 'lifting' && form.refEntityId) {
      const l = liftings.find((x) => x.id === form.refEntityId)
      return { refType: 'lifting', refId: form.refEntityId, label: l ? l.tankerName : null }
    }
    return null
  }, [prefillRefId, prefillRefType, prefillRefLabel, form.refKind, form.refEntityId, nodes, liftings])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const res = await fetch('/api/field/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        assigneeId: form.assigneeId || null,
        startDate: localInputToIso(form.startDate),
        dueDate: localInputToIso(form.dueDate),
        priority: form.priority,
        recurrence: form.recurrence || null,
        recurrenceEnd: form.recurrence && form.recurrenceEnd ? form.recurrenceEnd : null,
        refType: resolvedRef?.refType ?? null,
        refId: resolvedRef?.refId ?? null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Task assigned')
      setForm({ title: '', assigneeId: '', startDate: '', dueDate: '', priority: 'MEDIUM', recurrence: '', recurrenceEnd: '', refKind: 'none', refEntityId: '' })
      loadTasks()
    } else {
      toast.error((await res.json().catch(() => ({})))?.error || 'Failed to assign task')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Assign task" sub="Assign field work to a teammate. It's tracked as a task in ProBase — board, due dates, and notifications included.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Task</WsLabel><input style={wsField} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Load cargo MT Mawar" required /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Assignee</WsLabel><select style={wsField} value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}><option value="">— Unassigned —</option>{members.map((m) => <option key={m.id} value={m.id}>{memberName(m)}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Start</WsLabel><input type="datetime-local" style={wsField} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Due</WsLabel><input type="datetime-local" style={wsField} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Priority</WsLabel><select style={wsField} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>Repeat</WsLabel><select style={wsField} value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>{RECURRENCE.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
          {form.recurrence && (
            <label style={{ display: 'grid', gap: 5 }}><WsLabel>Until (optional)</WsLabel><input type="date" style={wsField} value={form.recurrenceEnd} onChange={(e) => setForm({ ...form, recurrenceEnd: e.target.value })} /></label>
          )}

          {prefillRefId && prefillRefType ? (
            <label style={{ display: 'grid', gap: 5, gridColumn: 'span 2' }}><WsLabel>Linked to</WsLabel><div style={{ ...wsField, display: 'flex', alignItems: 'center', gap: 8 }}><Pill>{prefillRefType}</Pill><span style={{ fontSize: 12.5, color: 'var(--mb-ink)' }}>{prefillRefLabel || prefillRefId}</span></div></label>
          ) : (
            <>
              <label style={{ display: 'grid', gap: 5 }}><WsLabel>Link to</WsLabel><select style={wsField} value={form.refKind} onChange={(e) => setForm({ ...form, refKind: e.target.value, refEntityId: '' })}><option value="none">— Nothing —</option><option value="node">Node</option><option value="lifting">Lifting</option></select></label>
              {form.refKind === 'node' && (
                <label style={{ display: 'grid', gap: 5 }}><WsLabel>Node</WsLabel><select style={wsField} value={form.refEntityId} onChange={(e) => setForm({ ...form, refEntityId: e.target.value })}><option value="">Select…</option>{nodes.map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name}</option>)}</select></label>
              )}
              {form.refKind === 'lifting' && (
                <label style={{ display: 'grid', gap: 5 }}><WsLabel>Lifting</WsLabel><select style={wsField} value={form.refEntityId} onChange={(e) => setForm({ ...form, refEntityId: e.target.value })}><option value="">Select…</option>{liftings.map((l) => <option key={l.id} value={l.id}>{l.tankerName}</option>)}</select></label>
              )}
            </>
          )}
          <Btn kind="primary" icon="plus">{saving ? 'Assigning…' : 'Assign task'}</Btn>
        </form>
      </Panel>

      <Panel title="Field tasks" sub="Assigned field work. Open in ProBase to manage status, comments, and subtasks." pad={0}
        right={projectId ? <Btn kind="soft" href={`/projects/${projectId}`}>Open in ProBase</Btn> : undefined}>
        {loading ? <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Task', 'Assignee', 'Linked', 'Priority', 'Window', 'Status'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {tasks.length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>No field tasks yet.</td></tr>}
              {tasks.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>
                    {projectId ? <Link href={`/projects/${projectId}`} style={{ color: 'var(--mb-ink)', textDecoration: 'none' }}>{t.title}</Link> : t.title}
                    {t.recurrence && <Pill style={{ marginLeft: 8 }}>↻ {RECURRENCE_LABEL[t.recurrence] ?? t.recurrence}</Pill>}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>{memberName(t.assignee)}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--mb-ink-muted)' }}>{t.refLabel ? <><Pill>{t.refType}</Pill> <span style={{ marginLeft: 6 }}>{t.refLabel}</span></> : '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--mb-ink-muted)' }}>{t.priority}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--mb-ink-muted)', whiteSpace: 'nowrap' }}>{
                    t.startDate || t.dueDate
                      ? `${t.startDate ? formatWhen(t.startDate) : '—'} → ${t.dueDate ? formatWhen(t.dueDate) : '—'}`
                      : '—'
                  }</td>
                  <td style={{ padding: '10px 16px' }}><Pill>{STATUS_LABEL[t.status] ?? t.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

export default function FieldTasksPage() {
  return (
    <Suspense fallback={<div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Loading…</div>}>
      <FieldTasksInner />
    </Suspense>
  )
}
