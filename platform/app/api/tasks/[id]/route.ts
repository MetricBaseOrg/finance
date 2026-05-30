import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logActivity, notify, type ActivityKind } from '@/lib/activity'
import { isValidRecurrence, spawnNextRecurringInstance } from '@/lib/recurrence'
import { can, getRole, getWorkspaceForTask } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      creator: { select: { id: true, name: true, email: true } },
      labels: true,
      milestone: true,
      subTasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true, image: true } },
          labels: true,
        },
        orderBy: { order: 'asc' },
      },
      comments: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: 'asc' },
      },
      project: { select: { id: true, name: true, color: true } },
      blockedBy: {
        include: {
          blocker: { select: { id: true, title: true, status: true, priority: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      blocking: {
        include: {
          blocked: { select: { id: true, title: true, status: true, priority: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(task)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await req.json()
  const userId = session.user.id

  const organizationId = await getWorkspaceForTask(id)
  if (!organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = await getRole(userId, organizationId)
  if (!role || !can(role, 'task.update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Snapshot the pre-update state so we can diff for the activity log.
  const before = await prisma.task.findUnique({
    where: { id },
    select: {
      title: true, description: true, status: true, priority: true,
      dueDate: true, startDate: true, assigneeId: true, milestoneId: true,
      parentId: true,
    },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── Guard: IN_REVIEW → DONE requires OWNER/ADMIN, or self-approval if assigned to self ──
  if (data.status === 'DONE' && before.status === 'IN_REVIEW') {
    const isSelfApproval = role === 'MEMBER' && before.assigneeId === userId
    if (role !== 'OWNER' && role !== 'ADMIN' && !isSelfApproval) {
      return NextResponse.json(
        {
          error: 'approval_required',
          code: 'approval_required',
          message: 'Only admins, owners, or the assignee can approve tasks from In Review to Done.',
        },
        { status: 403 },
      )
    }
  }

  // ── Guard: Members can only assign tasks to themselves ─────────────────────
  if (data.assigneeId !== undefined && role === 'MEMBER') {
    if (data.assigneeId !== null && data.assigneeId !== userId) {
      return NextResponse.json(
        {
          error: 'forbidden',
          code: 'assign_restricted',
          message: 'Members can only assign tasks to themselves.',
        },
        { status: 403 },
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
      return NextResponse.json(
        {
          error: 'blocked',
          code: 'blocked_by_dependencies',
          message: `Can't complete: ${openBlockers.length} blocker${openBlockers.length === 1 ? '' : 's'} still open.`,
          blockers: openBlockers.map(b => ({ id: b.blocker.id, title: b.blocker.title, status: b.blocker.status })),
        },
        { status: 409 },
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
    // Fetch all sibling subtasks (including this one, with its new status)
    const siblings = await prisma.task.findMany({
      where: { parentId: before.parentId },
      select: { id: true, status: true },
    })
    const activeSiblings = siblings.filter(s => s.status !== 'CANCELLED')
    const doneCount = activeSiblings.filter(s => s.status === 'DONE').length
    const allDone = activeSiblings.length > 0 && doneCount === activeSiblings.length
    const someDone = doneCount > 0

    // Get current parent status
    const parent = await prisma.task.findUnique({
      where: { id: before.parentId },
      select: { id: true, title: true, status: true },
    })

    if (parent && allDone && parent.status !== 'IN_REVIEW') {
      // All subtasks done → move parent to IN_REVIEW
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
      // Some subtasks done → move parent to IN_PROGRESS
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

  // If the task just became DONE and has a recurrence rule, spawn the next
  // instance. We tag the response with `spawnedRecurring` so the client can
  // update its flat task list without a re-fetch.
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
      // Don't fail the user's action; the chain can be picked up by a later
      // rollover or manual re-completion.
    }
  }

  return NextResponse.json({
    ...task,
    ...(spawnedRecurring && { spawnedRecurring }),
    ...(parentStatusChanged && { parentStatusChanged }),
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      creatorId: true,
      project: { select: { organizationId: true } },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = await getRole(session.user.id, task.project.organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!can(role, 'task.delete')) {
    return NextResponse.json({ error: 'Your role does not permit deleting tasks.' }, { status: 403 })
  }
  // MEMBERs can only delete their own tasks; OWNER/ADMIN can delete any.
  if (role === 'MEMBER' && task.creatorId !== session.user.id) {
    return NextResponse.json({ error: 'You can only delete tasks you created.' }, { status: 403 })
  }

  await prisma.task.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
