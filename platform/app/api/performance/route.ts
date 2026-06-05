import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { db } from '@/server/db'
import { resolveDoneAt, weeklyBuckets } from '@/lib/metrics'

/**
 * GET /api/performance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Per-user delivery metrics over the selected window, scoped to the viewer's
 * shared workspaces:
 *   - completionRate  : completed-in-window / (completed-in-window + open-now)
 *   - onTimeRate      : of completed tasks with a dueDate, share done on time
 *   - throughputTotal : count completed in window (+ weekly sparkline)
 *   - cycleTimeDays   : avg days from start (or creation) to done
 *
 * OWNERs (any shared org) and platform super-admins get every human member of
 * the org(s) they own. Everyone else gets only their own row.
 */
export async function GET(req: Request) {
  const { user, orgs } = await getOrgContext()
  const viewerOrgIds = orgs.map((o) => o.id)
  const ownerOrgIds = orgs.filter((o) => o.role === 'OWNER').map((o) => o.id)
  const canSeeAll = ownerOrgIds.length > 0 || user.isSuperAdmin

  // Window: default last 90 days. Parse to UTC day bounds.
  const url = new URL(req.url)
  const now = new Date()
  const defFrom = new Date(now.getTime() - 90 * 24 * 3600 * 1000)
  const parseDay = (s: string | null, fallback: Date, end: boolean): Date => {
    const base = s ? new Date(`${s}T00:00:00.000Z`) : fallback
    if (Number.isNaN(base.getTime())) return fallback
    return end
      ? new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999))
      : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0))
  }
  const from = parseDay(url.searchParams.get('from'), defFrom, false)
  const to = parseDay(url.searchParams.get('to'), now, true)

  // Org scope: the all-members view is limited to owned orgs (or all shared
  // orgs for super-admins). The self-only view spans every shared org.
  const scopedOrgIds = canSeeAll
    ? (user.isSuperAdmin ? viewerOrgIds : ownerOrgIds)
    : viewerOrgIds

  // Member set
  let memberIds: string[]
  const memberMeta = new Map<string, { name: string; image: string | null }>()
  if (canSeeAll) {
    const rows = await db.user.findMany({
      where: {
        kind: { not: 'AGENT' },
        members: { some: { organizationId: { in: scopedOrgIds } } },
      },
      select: { id: true, name: true, email: true, image: true },
    })
    memberIds = rows.map((r) => r.id)
    for (const r of rows) memberMeta.set(r.id, { name: r.name || r.email, image: r.image })
  } else {
    memberIds = [user.id]
    memberMeta.set(user.id, { name: user.name || user.email, image: user.image })
  }

  if (memberIds.length === 0) {
    return NextResponse.json({ canSeeAll, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), viewerId: user.id, members: [] })
  }

  // All tasks assigned to the member set within the scoped orgs.
  const tasks = await db.task.findMany({
    where: {
      assigneeId: { in: memberIds },
      project: { organizationId: { in: scopedOrgIds } },
    },
    select: { id: true, assigneeId: true, status: true, startDate: true, dueDate: true, createdAt: true, updatedAt: true },
  })

  const taskIds = tasks.map((t) => t.id)
  const activities = taskIds.length
    ? await db.taskActivity.findMany({
        where: { taskId: { in: taskIds }, kind: 'status.changed' },
        select: { taskId: true, metadata: true, createdAt: true },
      })
    : []
  const doneAt = resolveDoneAt(tasks, activities)

  // Bucket tasks per assignee and compute metrics.
  const members = memberIds.map((mid) => {
    const meta = memberMeta.get(mid)!
    const mine = tasks.filter((t) => t.assigneeId === mid)

    const completedInWindow = mine.filter((t) => {
      const d = doneAt.get(t.id)
      return d && d >= from && d <= to
    })
    const openNow = mine.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED').length

    const completed = completedInWindow.length
    const completionRate = completed + openNow > 0 ? completed / (completed + openNow) : 0

    const withDue = completedInWindow.filter((t) => t.dueDate)
    const onTime = withDue.filter((t) => doneAt.get(t.id)! <= t.dueDate!).length
    const onTimeRate = withDue.length > 0 ? onTime / withDue.length : 0

    const cycleSamples = completedInWindow.map((t) => {
      const startedAt = t.startDate ?? t.createdAt
      const done = doneAt.get(t.id)!
      return Math.max(0, done.getTime() - startedAt.getTime()) / (24 * 3600 * 1000)
    })
    const cycleTimeDays = cycleSamples.length
      ? cycleSamples.reduce((a, b) => a + b, 0) / cycleSamples.length
      : null

    const throughputSpark = weeklyBuckets(
      completedInWindow.map((t) => doneAt.get(t.id)!),
      from,
      to,
    )

    return {
      id: mid,
      name: meta.name,
      image: meta.image,
      completionRate,
      onTimeRate,
      throughputTotal: completed,
      throughputSpark,
      cycleTimeDays,
      completed,
      open: openNow,
    }
  })

  // Sort by throughput desc by default; client can re-sort.
  members.sort((a, b) => b.throughputTotal - a.throughputTotal)

  return NextResponse.json({
    canSeeAll,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    viewerId: user.id,
    members,
  })
}
