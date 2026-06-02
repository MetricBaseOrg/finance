import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgContext } from '@/lib/org'
import { db } from '@/server/db'
import { ROLE_LABELS, isRole } from '@/lib/permissions'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { RefreshButton } from './RefreshButton'

export const dynamic = 'force-dynamic'

// AgentRun lifecycle → pill colour (semantic accents that read on both themes).
const RUN_TONE: Record<string, { bg: string; fg: string }> = {
  queued: { bg: 'rgba(150,150,150,0.16)', fg: 'var(--mb-ink-soft)' },
  running: { bg: 'rgba(80,140,220,0.18)', fg: '#5b8fd0' },
  done: { bg: 'rgba(70,170,120,0.18)', fg: '#3fa46f' },
  error: { bg: 'rgba(200,90,80,0.20)', fg: '#c0564e' },
}

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`
  const mo = Math.floor(days / 30); if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function durationStr(a: Date, b: Date | null): string | null {
  if (!b) return null
  const s = Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-muted)', marginBottom: 6 }
const rowLink: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--mb-divider)', textDecoration: 'none' }
const runPill: CSSProperties = { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 5, flexShrink: 0 }

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user: viewer, orgs } = await getOrgContext()
  const viewerOrgIds = orgs.map((o) => o.id)
  const isSelf = viewer.id === id

  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, image: true, title: true, bio: true, kind: true,
      members: {
        where: { organizationId: { in: viewerOrgIds } },
        select: { role: true, organization: { select: { id: true, name: true } } },
      },
    },
  })

  // Privacy: you can only view people you share a workspace with (or yourself).
  if (!target || (!isSelf && target.members.length === 0)) notFound()

  const isAgent = target.kind === 'AGENT'
  const initials = (target.name || target.email).split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  // Open work assigned to this person, scoped to the shared orgs.
  const openTasks = await db.task.count({
    where: {
      assigneeId: target.id,
      status: { notIn: ['DONE', 'CANCELLED'] },
      project: { organizationId: { in: viewerOrgIds } },
    },
  })

  // How many of those are actively in progress — drives the work-status pill.
  const inProgressTasks = await db.task.count({
    where: {
      assigneeId: target.id,
      status: 'IN_PROGRESS',
      project: { organizationId: { in: viewerOrgIds } },
    },
  })

  // Agent monitoring: assigned-task list + recent run activity (agent profiles only).
  type RunTaskRef = { title: string; projectId: string }
  let agentData: null | {
    enabled: boolean
    working: boolean
    tasks: { id: string; title: string; status: string; projectId: string; projectName: string }[]
    runs: { id: string; status: string; trigger: string; taskId: string | null; toolCalls: number; inputTokens: number | null; outputTokens: number | null; error: string | null; createdAt: Date; finishedAt: Date | null }[]
    runTasks: Map<string, RunTaskRef>
  } = null

  if (isAgent) {
    const agent = await db.agent.findFirst({
      where: { userId: target.id, organizationId: { in: viewerOrgIds } },
      select: { id: true, enabled: true },
    })
    if (agent) {
      const [runs, tasks] = await Promise.all([
        db.agentRun.findMany({
          where: { agentId: agent.id },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { id: true, status: true, trigger: true, taskId: true, toolCalls: true, inputTokens: true, outputTokens: true, error: true, createdAt: true, finishedAt: true },
        }),
        db.task.findMany({
          where: { assigneeId: target.id, status: { notIn: ['DONE', 'CANCELLED'] }, project: { organizationId: { in: viewerOrgIds } } },
          orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: 8,
          select: { id: true, title: true, status: true, project: { select: { id: true, name: true } } },
        }),
      ])
      // Resolve titles/projects for the tasks referenced by runs.
      const runTaskIds = [...new Set(runs.map((r) => r.taskId).filter((x): x is string => !!x))]
      const refRows = runTaskIds.length
        ? await db.task.findMany({ where: { id: { in: runTaskIds }, project: { organizationId: { in: viewerOrgIds } } }, select: { id: true, title: true, projectId: true } })
        : []
      agentData = {
        enabled: agent.enabled,
        working: runs.some((r) => r.status === 'queued' || r.status === 'running'),
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, projectId: t.project.id, projectName: t.project.name })),
        runs,
        runTasks: new Map(refRows.map((t) => [t.id, { title: t.title, projectId: t.projectId }])),
      }
    }
  }

  const agentStatus = agentData
    ? !agentData.enabled
      ? { text: 'Disabled', bg: 'rgba(200,90,80,0.16)', fg: '#c0564e' }
      : agentData.working
        ? { text: 'Working', ...RUN_TONE.running }
        : { text: 'Idle', ...RUN_TONE.queued }
    : null

  // Work-status pill shown for every profile. Agents reflect live run activity;
  // people reflect whether they have a task in progress right now.
  const statusPill = agentStatus ?? (
    inProgressTasks > 0
      ? { text: 'Working', ...RUN_TONE.running }
      : { text: 'Idle', ...RUN_TONE.queued }
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px var(--ws-gutter) 60px' }} className="ws-fade">
      <Link href="/home" style={{ fontSize: 12, color: 'var(--mb-ink-muted)', textDecoration: 'none' }}>← Home</Link>

      <div className="ws-card" style={{ marginTop: 14, padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {target.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={target.image} alt="" style={{ width: 72, height: 72, borderRadius: isAgent ? 12 : '50%', objectFit: 'cover', border: '1px solid var(--mb-border)' }} />
        ) : (
          <span style={{ width: 72, height: 72, borderRadius: isAgent ? 12 : '50%', background: 'var(--mb-brand)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 700 }}>{initials}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--mb-ink)', margin: 0 }}>{target.name || target.email}</h1>
            {isAgent && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--mb-brand)', color: '#fff', padding: '2px 7px', borderRadius: 5 }}>AI Agent</span>}
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: statusPill.bg, color: statusPill.fg, padding: '2px 7px', borderRadius: 5 }}>{statusPill.text}</span>
            {isSelf && (
              <Link href="/settings" style={{ fontSize: 11.5, color: 'var(--mb-brand)', textDecoration: 'none', marginLeft: 'auto' }}>Edit profile →</Link>
            )}
          </div>
          {target.title && <div style={{ fontSize: 13.5, color: 'var(--mb-ink-soft)', marginTop: 2 }}>{target.title}</div>}
          {!isAgent && <div style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)', marginTop: 4 }}>{target.email}</div>}
          {target.bio && <p style={{ fontSize: 13.5, color: 'var(--mb-ink)', marginTop: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{target.bio}</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <div className="ws-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-muted)', marginBottom: 8 }}>Shared workspaces</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {target.members.map((m) => (
              <div key={m.organization.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mb-ink)' }}>
                <span>{m.organization.name}</span>
                <span style={{ color: 'var(--mb-brand)', fontWeight: 600 }}>{isRole(m.role) ? ROLE_LABELS[m.role] : m.role}</span>
              </div>
            ))}
            {target.members.length === 0 && <span style={{ fontSize: 12, color: 'var(--mb-ink-muted)' }}>—</span>}
          </div>
        </div>
        <div className="ws-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-muted)', marginBottom: 8 }}>Open tasks</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--mb-ink)' }}>{openTasks}</div>
          <div style={{ fontSize: 12, color: 'var(--mb-ink-muted)' }}>assigned & not done</div>
        </div>
      </div>

      {agentData && (
        <>
          <div className="ws-card" style={{ marginTop: 12, padding: 16 }}>
            <div style={sectionLabel}>Assigned tasks</div>
            {agentData.tasks.length === 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>No open tasks assigned.</span>
            ) : (
              agentData.tasks.map((t) => (
                <Link key={t.id} href={`/projects/${t.projectId}?task=${t.id}`} style={rowLink}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span className={STATUS_COLORS[t.status] ?? 'bg-gray-400'} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 13, color: 'var(--mb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)', flexShrink: 0 }}>{STATUS_LABELS[t.status] ?? t.status} · {t.projectName}</span>
                </Link>
              ))
            )}
          </div>

          <div className="ws-card" style={{ marginTop: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <div style={{ ...sectionLabel, marginBottom: 0 }}>Recent activity</div>
              <RefreshButton />
            </div>
            {agentData.runs.length === 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>No runs yet.</span>
            ) : (
              agentData.runs.map((r) => {
                const tone = RUN_TONE[r.status] ?? RUN_TONE.queued
                const ref = r.taskId ? agentData!.runTasks.get(r.taskId) : undefined
                const dur = durationStr(r.createdAt, r.finishedAt)
                const tokens = (r.inputTokens ?? 0) + (r.outputTokens ?? 0)
                const meta = [relTime(r.createdAt), dur, tokens ? `${tokens.toLocaleString()} tok` : null, r.toolCalls ? `${r.toolCalls} tools` : null].filter(Boolean).join(' · ')
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: '1px solid var(--mb-divider)' }}>
                    <span style={{ ...runPill, background: tone.bg, color: tone.fg }}>{r.status}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--mb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.trigger}
                        {ref && <> · <Link href={`/projects/${ref.projectId}?task=${r.taskId}`} style={{ color: 'var(--mb-brand)', textDecoration: 'none' }}>{ref.title}</Link></>}
                      </div>
                      {r.error && <div style={{ fontSize: 11, color: '#c0564e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)', flexShrink: 0, textAlign: 'right' }}>{meta}</span>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
