import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgContext } from '@/lib/org'
import { db } from '@/server/db'
import { ROLE_LABELS, isRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

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
    </div>
  )
}
