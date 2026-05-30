import { getFieldContext } from '@/server/field'
import { prisma } from '@/lib/prisma'
import { Panel } from '@/app/home/ui'

export const dynamic = 'force-dynamic'

function summaryOf(metadata: string | null): string {
  if (!metadata) return ''
  try {
    const m = JSON.parse(metadata)
    return typeof m?.summary === 'string' ? m.summary : ''
  } catch {
    return ''
  }
}

export default async function FieldAuditPage() {
  const ctx = await getFieldContext()
  if (!ctx) {
    return <Panel title="Audit"><div style={{ padding: 6, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>Sign in to view the field audit trail.</div></Panel>
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: ctx.organizationId, module: 'field' },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Audit trail" sub="Who changed what in field operations — newest first (last 200 events)." pad={0}>
        {logs.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>
            No field activity recorded yet. Adding nodes, flows, transfers, liftings, targets, or running an import will show up here.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['When', 'Who', 'Action', 'Entity', 'Detail'].map((h) => (
              <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td className="mb-num" style={{ padding: '9px 16px', fontSize: 12, color: 'var(--mb-ink-muted)', whiteSpace: 'nowrap' }}>{l.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{l.actor?.name ?? l.actor?.email ?? 'System'}</td>
                  <td style={{ padding: '9px 16px', fontSize: 11.5, color: 'var(--c-fieldflow)', fontWeight: 600 }}>{l.action}</td>
                  <td style={{ padding: '9px 16px', fontSize: 11.5, color: 'var(--mb-ink-muted)', textTransform: 'uppercase' }}>{l.entity}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{summaryOf(l.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
