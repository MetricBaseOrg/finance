import { redirect } from 'next/navigation'
import { getFieldContext } from '@/server/field'
import { prisma } from '@/lib/prisma'
import { KTile, Panel } from '@/app/home/ui'

export const dynamic = 'force-dynamic'

const TEAL = 'var(--c-fieldflow)'

export default async function FieldOverview() {
  const ctx = await getFieldContext()
  if (!ctx) redirect('/welcome')
  const orgId = ctx.organizationId
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [nodeCount, flowCount, activeLiftings, recentFlows] = await Promise.all([
    prisma.node.count({ where: { organizationId: orgId, active: true } }),
    prisma.flow.count({ where: { organizationId: orgId, date: { gte: since } } }),
    prisma.lifting.count({ where: { organizationId: orgId, status: 'active' } }),
    prisma.flow.findMany({
      where: { organizationId: orgId },
      include: { node: { select: { code: true, name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 15,
    }),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--ws-gap)' }}>
        <KTile label="Active nodes" value={nodeCount} unit="online" delta="live" tone="ok" accent={TEAL} spark={[nodeCount * 0.9, nodeCount, nodeCount * 0.95, nodeCount, nodeCount, nodeCount * 1.02, nodeCount, nodeCount]} />
        <KTile label="Flows" value={flowCount} unit="30d" delta="logged" tone="neutral" accent={TEAL} spark={[flowCount * 0.6, flowCount * 0.8, flowCount * 0.7, flowCount, flowCount * 0.9, flowCount, flowCount, flowCount]} />
        <KTile label="Active liftings" value={activeLiftings} unit="cargoes" delta="scheduled" tone="neutral" accent={TEAL} spark={[0, 1, 1, activeLiftings, activeLiftings, activeLiftings, activeLiftings, activeLiftings]} />
      </div>

      <Panel title="Recent flows" sub="Latest inflow / outflow / stock records" pad={0}>
        {recentFlows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--mb-ink-muted)', fontSize: 12.5 }}>
            No flows recorded yet. Add nodes, then log flows.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Node', 'Type', 'Volume'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', padding: '10px 16px', fontFamily: 'var(--mb-font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentFlows.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--mb-divider)' }}>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>{f.date}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)' }}>{f.node.code} · {f.node.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: TEAL, fontWeight: 600, textTransform: 'uppercase' }}>{f.flowType}</td>
                  <td className="mb-num" style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--mb-ink)', textAlign: 'right' }}>{f.volume.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
