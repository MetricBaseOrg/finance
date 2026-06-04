import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/projects/:id/s-curve
 *
 * Returns the time-series data needed to render an S-curve for a project:
 *   - planned[]: cumulative count of tasks whose `dueDate <= day` for each day
 *     in the project's calendar range. Tasks with no dueDate are excluded
 *     from "planned" (we don't know when they were planned to be done) and
 *     are added as a constant offset at the end so totals match.
 *   - actual[] : cumulative count of tasks marked DONE on or before each day,
 *     derived from the Activity log (kind="status.changed", to="DONE"). Tasks
 *     currently DONE without a logged transition (legacy data) fall back to
 *     `updatedAt`.
 *   - milestones[]: with their due dates so the client can render markers.
 *
 * Range: from the earliest of (project.createdAt, earliest task createdAt,
 * earliest task startDate) to the latest of (today, latest task dueDate).
 * Granularity: daily.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Access check + lightweight project fetch
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      workspace: {
        select: { members: { where: { userId: session.user.id }, select: { id: true } } },
      },
      milestones: {
        select: { id: true, name: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
      },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Count every task in the project — both top-level tasks and subtasks — so
  // the curve reflects the full body of work, not just parent rows.
  const tasks = await prisma.task.findMany({
    where: { projectId: id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startDate: true,
      dueDate: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // DONE timestamps from the activity log
  const taskIds = tasks.map(t => t.id)
  const doneEvents = taskIds.length === 0 ? [] : await prisma.taskActivity.findMany({
    where: {
      taskId: { in: taskIds },
      kind: 'status.changed',
    },
    select: { taskId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // For each currently-DONE task, find when it first transitioned to DONE.
  // Falls back to updatedAt if no event exists (older tasks predating the
  // activity log).
  const doneAtByTask = new Map<string, Date>()
  for (const e of doneEvents) {
    if (!e.metadata) continue
    try {
      const m = JSON.parse(e.metadata) as { to?: unknown }
      if (m.to === 'DONE' && !doneAtByTask.has(e.taskId)) {
        doneAtByTask.set(e.taskId, e.createdAt)
      }
    } catch {}
  }

  const doneTasks = tasks.filter(t => t.status === 'DONE')
  for (const t of doneTasks) {
    if (!doneAtByTask.has(t.id)) doneAtByTask.set(t.id, t.updatedAt)
  }

  // Compute range
  const now = new Date()
  const candidates: Date[] = [project.createdAt]
  for (const t of tasks) {
    candidates.push(t.createdAt)
    if (t.startDate) candidates.push(t.startDate)
  }
  let start = candidates.reduce((a, b) => (b < a ? b : a), candidates[0] || now)
  // Floor to start of day (UTC) for stable bucket alignment
  start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))

  const dueDates = tasks.map(t => t.dueDate).filter(Boolean) as Date[]
  const latestDue = dueDates.reduce((a, b) => (b > a ? b : a), dueDates[0] || now)
  let end = latestDue > now ? latestDue : now
  end = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))

  // Always cover the full project range. Keep the point count bounded (~400)
  // by widening the bucket step for long projects — daily for short ones,
  // multi-day/weekly/monthly for multi-year ones — so the x-axis never gets
  // truncated and the payload stays small.
  const DAY_MS = 24 * 3600 * 1000
  const MAX_POINTS = 400
  const totalMs = end.getTime() - start.getTime()
  const totalDays = Math.max(Math.floor(totalMs / DAY_MS) + 1, 1)
  const stepDays = Math.max(1, Math.ceil(totalDays / MAX_POINTS))
  const numPoints = Math.max(1, Math.ceil(totalDays / stepDays))

  // Tasks without a dueDate aren't "planned" on any day — they're a constant
  // offset added once we hit the end of the range, so the planned and actual
  // curves can converge.
  const tasksWithoutDue = tasks.length - dueDates.length

  const doneTimes = [...doneAtByTask.values()]
  const planned: Array<{ date: string; count: number }> = []
  const actual:  Array<{ date: string; count: number }> = []
  for (let i = 0; i < numPoints; i++) {
    // Pin the last bucket to the true range end so the planned curve reaches
    // 100% — with multi-day steps the final sample can otherwise land before
    // the end day and miss tasks due in that last interval.
    const dayMs = i === numPoints - 1
      ? end.getTime()
      : Math.min(start.getTime() + i * stepDays * DAY_MS, end.getTime())
    const day = new Date(dayMs)
    // End-of-day for "≤ day" semantics
    const eod = new Date(dayMs + DAY_MS - 1)
    const dueByThen = dueDates.filter(d => d <= eod).length
    const doneByThen = doneTimes.filter(d => d <= eod).length
    // Add the dueDate-less tasks proportionally near the end of the project
    // (linearly tail off the last 20% of the range).
    const ramp = i / Math.max(numPoints - 1, 1)
    const extraPlanned = tasksWithoutDue > 0
      ? Math.round(tasksWithoutDue * Math.max(0, (ramp - 0.8) / 0.2))
      : 0
    planned.push({ date: day.toISOString().slice(0, 10), count: dueByThen + extraPlanned })
    actual.push({ date: day.toISOString().slice(0, 10), count: doneByThen })
  }

  return NextResponse.json({
    projectId: project.id,
    projectName: project.name,
    color: project.color,
    rangeStart: start.toISOString().slice(0, 10),
    rangeEnd: end.toISOString().slice(0, 10),
    today: now.toISOString().slice(0, 10),
    totalTasks: tasks.length,
    totalDone: doneTasks.length,
    planned,
    actual,
    milestones: project.milestones
      .filter(m => m.dueDate)
      .map(m => ({ id: m.id, name: m.name, dueDate: m.dueDate!.toISOString().slice(0, 10) })),
  })
}
