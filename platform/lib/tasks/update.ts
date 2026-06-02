import { prisma } from '@/lib/prisma'
import { logActivity, notify, type ActivityKind } from '@/lib/activity'
import { isValidRecurrence, spawnNextRecurringInstance } from '@/lib/recurrence'
import type { Role } from '@/app/generated/prisma/client'

/**
 * Shared task-update service. Holds the guard logic, the update, the activity
 * diff, notifications, parent auto-status, and recurrence spawning — so that
 * both the HTTP route (app/api/tasks/[id]/route.ts) and the agent's `update_task`
 * tool go through identical, already-tested behaviour.
 *
 * Guard failures throw `TaskUpdateError` with an HTTP-ish status + machine code
 * so the route can map it to a response and the agent can surface it as text.
 */

export class TaskUpdateError extends Error {
  status: number
  code: string
  payload?: Record<string, unknown>
  constructor(status: number, code: string, message: string, payload?: Record<string, unknown>) {
    super(message)
    this.name = 'TaskUpdateError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export type TaskUpdateInput = {
  title?: string
  description?: string | null
  status?: string
  priority?: string
  dueDate?: string | null
  startDate?: string | null
  assigneeId?: string | null
  milestoneId?: string | null
  order?: number
  labelIds?: string[]
  recurrence?: string | null
  recurrenceEnd?: string | null
  force?: boolean
}

export async function updateTask(opts: {
  taskId: string
  actorUserId: string
  role: Role
  /** Pass true when the actor is an AI agent — bypasses the self-assign restriction. */
  isAgent?: boolean
  data: TaskUpdateInput
}) {
  const { taskId: id, actorUserId: userId, role, isAgent = false, data } = opts

  // Snapshot the pre-update state so we can diff for the activity log.
  const before = await prisma.task.findUnique({
    where: { id },
    select: {
      title: true, description: true, status: true, priority: true,
      dueDate: true, startDate: true, assigneeId: true, milestoneId: true,
      parentId: true,
    },
  })
  if (!before) throw new TaskUpdateError(404, 'not_found', 'Task not found.')

  // ── Guard: IN_REVIEW → DONE requires OWNER/ADMIN, or self-approval if assigned to self ──
  if (data.status === 'DONE' && before.status === 'IN_REVIEW') {
    const isSelfApproval = role === 'MEMBER' && before.assigneeId === userId
    if (role !== 'OWNER' && role !== 'ADMIN' && !isSelfApproval) {
      throw new TaskUpdateError(
        403,
        'approval_required',
        'Only admins, owners, or the assignee can approve tasks from In Review to Done.',
      )
    }
  }

  // ── Guard: Members can only assign tasks to themselves (agents are exempt) ──
  if (data.assigneeId !== undefined && role === 'MEMBER' && !isAgent) {
    if (data.assigneeId !== null && data.assigneeId !== userId) {
      throw new TaskUpdateError(
        403,
        'assign_restricted',
        'Members can only assign tasks to themselves.',
      )
    }
  }

  // If this is a DONE transition, verify no open blockers — unless caller
  // explicitly passes `force: true` to override.
  if (data.status === 'DONE' && before.status !== 'DONE' && !data.force) {
    const openBlockers = await prisma.taskDependency.findMany({
      where: {
        blockedId: id,
        blocker: { status: { notIn: ['DONE', 'CANCELLED'] } },
      },
      include: {
        blocker: { select: { id: true, title: true, status: true } },
      },
    })
    if (openBlockers.length > 0) {
      throw new TaskUpdateError(
        409,
        'blocked_by_dependencies',
        `Can't complete: ${openBlockers.length} blocker${openBlockers.length === 1 ? '' : 's'} still open.`,
        { blockers: openBlockers.map(b => ({ id: b.blocker.id, title: b.blocker.title, status: b.blocker.status })) },
      )
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      ...(data.milestoneId !== undefined && { milestoneId: data.milestoneId }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.labelIds !== undefined && {
        labels: { set: data.labelIds.map((lid: string) => ({ id: lid })) },
      }),
      // Recurrence: null clears, a valid kind sets it. Anything else is ignored.
      ...(data.recurrence !== undefined && {
        recurrence: data.recurrence === null
          ? null
          : isValidRecurrence(data.recurrence) ? data.recurrence : undefined,
      }),
      ...(data.recurrenceEnd !== undefined && {
        recurrenceEnd: data.recurrenceEnd ? new Date(data.recurrenceEnd) : null,
      }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      _count: { select: { comments: true, subTasks: true } },
    },
  })

  // Diff and emit activities for the fields people care about
  const events: Array<{ kind: ActivityKind; from: unknown; to: unknown }> = []
  if (data.status !== undefined && before.status !== data.status) {
    events.push({ kind: 'status.changed', from: before.status, to: data.status })
  }
  if (data.priority !== undefined && before.priority !== data.priority) {
    events.push({ kind: 'priority.changed', from: before.priority, to: data.priority })
  }
  if (data.title !== undefined && before.title !== data.title) {
    events.push({ kind: 'title.changed', from: before.title, to: data.title })
  }
  if (data.description !== undefined && (before.description || '') !== (data.description || '')) {
    events.push({ kind: 'description.changed', from: undefined, to: undefined })
  }
  if (data.assigneeId !== undefined && before.assigneeId !== data.assigneeId) {
    events.push({ kind: 'assignee.changed', from: before.assigneeId, to: data.assigneeId })
    // Notify the new assignee
    if (data.assigneeId) {
      await notify({
        userIds: [data.assigneeId],
        kind: 'task.assigned',
        actorId: userId,
        taskId: id,
        metadata: { title: task.title },
      })
    }
  }
  if (data.dueDate !== undefined) {
    const oldDue = before.dueDate ? before.dueDate.toISOString() : null
    const newDue = data.dueDate ? new Date(data.dueDate).toISOString() : null
    if (oldDue !== newDue) events.push({ kind: 'due.changed', from: oldDue, to: newDue })
  }
  if (data.startDate !== undefined) {
    const oldStart = before.startDate ? before.startDate.toISOString() : null
    const newStart = data.startDate ? new Date(data.startDate).toISOString() : null
    if (oldStart !== newStart) events.push({ kind: 'start.changed', from: oldStart, to: newStart })
  }
  if (data.milestoneId !== undefined && before.milestoneId !== data.milestoneId) {
    events.push({ kind: 'milestone.changed', from: before.milestoneId, to: data.milestoneId })
  }

  await Promise.all(events.map(e =>
    logActivity({ taskId: id, userId, kind: e.kind, metadata: { from: e.from ?? null, to: e.to ?? null } as never })
  ))

  // ── Auto-manage parent status based on subtask completion ─────────────────
  let parentStatusChanged: { id: string; title: string; newStatus: string } | null = null
  if (data.status !== before.status && before.parentId) {
    const siblings = await prisma.task.findMany({
      where: { parentId: before.parentId },
      select: { id: true, status: true },
    })
    const activeSiblings = siblings.filter(s => s.status !== 'CANCELLED')
    const doneCount = activeSiblings.filter(s => s.status === 'DONE').length
    const allDone = activeSiblings.length > 0 && doneCount === activeSiblings.length
    const someDone = doneCount > 0

    const parent = await prisma.task.findUnique({
      where: { id: before.parentId },
      select: { id: true, title: true, status: true },
    })

    if (parent && allDone && parent.status !== 'IN_REVIEW') {
      const updated = await prisma.task.update({
        where: { id: before.parentId },
        data: { status: 'IN_REVIEW' },
        select: { id: true, title: true, status: true },
      })
      parentStatusChanged = { id: updated.id, title: updated.title, newStatus: 'IN_REVIEW' }
      void logActivity({
        taskId: before.parentId,
        userId,
        kind: 'status.changed',
        metadata: { from: parent.status, to: 'IN_REVIEW', auto: true } as never,
      })
    } else if (someDone && !allDone && parent && (parent.status === 'BACKLOG' || parent.status === 'TODO')) {
      const updated = await prisma.task.update({
        where: { id: before.parentId },
        data: { status: 'IN_PROGRESS' },
        select: { id: true, title: true, status: true },
      })
      parentStatusChanged = { id: updated.id, title: updated.title, newStatus: 'IN_PROGRESS' }
      void logActivity({
        taskId: before.parentId,
        userId,
        kind: 'status.changed',
        metadata: { from: parent.status, to: 'IN_PROGRESS', auto: true } as never,
      })
    }
  }

  // If the task just became DONE and has a recurrence rule, spawn the next instance.
  let spawnedRecurring: unknown = undefined
  if (
    data.status === 'DONE'
    && before.status !== 'DONE'
    && task.recurrence
    && isValidRecurrence(task.recurrence)
  ) {
    try {
      const next = await spawnNextRecurringInstance(id, userId)
      if (next) {
        spawnedRecurring = next
        void logActivity({
          taskId: id,
          userId,
          kind: 'task.created',
          metadata: { preview: `Recurring → spawned next instance "${next.title}"`, nextTaskId: next.id } as never,
        })
      }
    } catch (err) {
      console.error('spawnNextRecurringInstance failed', err)
    }
  }

  return { task, spawnedRecurring, parentStatusChanged }
}
