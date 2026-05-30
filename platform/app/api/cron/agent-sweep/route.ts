import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runAgentRun } from '@/lib/agent/runtime'
import { sourceKeyFor } from '@/lib/agent/dispatch'

/**
 * POST /api/cron/agent-sweep
 *
 * Reliable backstop for agent dispatch. Inline dispatch from notify() is
 * fire-and-forget and can be dropped by serverless teardown; this sweep finds
 * unread agent-directed notifications (mentions / assignments) and processes
 * any that don't yet have an AgentRun. The deterministic `sourceKey` + the
 * unique([agentId, sourceKey]) constraint guarantee each event runs at most
 * once across both paths, so this is safe to run repeatedly.
 *
 * Protect with CRON_SECRET via the `Authorization: Bearer <secret>` header.
 * (Vercel Cron sends this automatically.) The secret is intentionally NOT
 * accepted as a query param — query strings leak into access logs.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const header = req.headers.get('authorization') || ''
  const headerSecret = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!headerSecret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agents = await prisma.agent.findMany({
    where: { enabled: true },
    select: { id: true, userId: true, organizationId: true },
  })
  if (agents.length === 0) return NextResponse.json({ ok: true, dispatched: 0 })
  const byUser = new Map(agents.map(a => [a.userId, a]))

  const notifs = await prisma.taskNotification.findMany({
    where: {
      userId: { in: [...byUser.keys()] },
      read: false,
      kind: { in: ['mention', 'task.assigned'] },
      taskId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })

  let dispatched = 0
  for (const n of notifs) {
    const agent = byUser.get(n.userId)
    if (!agent) continue

    // Loop guard: ignore events whose actor is itself an agent.
    if (n.actorId) {
      const actor = await prisma.user.findUnique({ where: { id: n.actorId }, select: { kind: true } })
      if (actor?.kind === 'AGENT') {
        await prisma.taskNotification.update({ where: { id: n.id }, data: { read: true } }).catch(() => {})
        continue
      }
    }

    const sourceKey = sourceKeyFor(n.kind, n.taskId, n.commentId)
    try {
      const run = await prisma.agentRun.create({
        data: {
          agentId: agent.id,
          organizationId: agent.organizationId,
          trigger: 'sweep',
          taskId: n.taskId,
          sourceKey,
        },
        select: { id: true },
      })
      await runAgentRun(run.id)
      dispatched++
    } catch {
      // Already dispatched for this event (unique sourceKey) — nothing to do.
    }
    await prisma.taskNotification.update({ where: { id: n.id }, data: { read: true } }).catch(() => {})
  }

  return NextResponse.json({ ok: true, scanned: notifs.length, dispatched })
}

export const GET = handle
export const POST = handle
