import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logActivity, notify } from '@/lib/activity'
import { isValidRecurrence } from '@/lib/recurrence'
import { can, getRole, getWorkspaceForProject } from '@/lib/permissions'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const assigneeId = searchParams.get('assigneeId')
  const reviewTasks = searchParams.get('reviewTasks') === 'true'

  const where: Record<string, unknown> = {}
  if (projectId) where.projectId = projectId
  where.parentId = null

  // For "My Tasks" page: fetch user's assigned tasks + IN_REVIEW tasks needing approval
  if (assigneeId && reviewTasks) {
    // Admin/Owner: get their tasks + all IN_REVIEW tasks from any workspace they manage
    const userMemberships = await prisma.membership.findMany({
      where: { userId: assigneeId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { organizationId: true },
    })
    const orgIds = userMemberships.map(w => w.organizationId)

    if (orgIds.length > 0) {
      const projectIds = await prisma.project.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
      })
      where.OR = [
        { assigneeId },
        { status: 'IN_REVIEW', projectId: { in: projectIds.map(p => p.id) } },
      ]
    } else {
      where.assigneeId = assigneeId
    }
  } else if (assigneeId) {
    where.assigneeId = assigneeId
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      subTasks: { select: { id: true, title: true, status: true } },
      _count: { select: { comments: true, subTasks: true } },
      milestone: { select: { id: true, name: true } },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, status, priority, dueDate, startDate, projectId, assigneeId, parentId, milestoneId, labelIds, recurrence, recurrenceEnd } = await req.json()

  if (!title || !projectId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const organizationId = await getWorkspaceForProject(projectId)
  if (!organizationId) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const role = await getRole(session.user.id, organizationId)
  if (!role || !can(role, 'task.create')) {
    return NextResponse.json({ error: 'Your role does not permit creating tasks.' }, { status: 403 })
  }

  // Subtasks inherit the parent's assignee when none is given, so they don't
  // land as "Unassigned" under a parent that already has an owner.
  let effectiveAssigneeId: string | null = assigneeId ?? null
  if (parentId && !effectiveAssigneeId) {
    const parent = await prisma.task.findFirst({
      where: { id: parentId, projectId },
      select: { assigneeId: true },
    })
    if (parent?.assigneeId) effectiveAssigneeId = parent.assigneeId
  }

  const lastTask = await prisma.task.findFirst({
    where: { projectId, status: status || 'TODO' },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const task = await prisma.task.create({
    data: {
      title,
      description,
      status: status || 'TODO',
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      projectId,
      creatorId: session.user.id,
      assigneeId: effectiveAssigneeId,
      parentId,
      milestoneId,
      order: (lastTask?.order ?? 0) + 1000,
      ...(isValidRecurrence(recurrence) && { recurrence }),
      ...(recurrenceEnd && { recurrenceEnd: new Date(recurrenceEnd) }),
      ...(labelIds?.length && {
        labels: { connect: labelIds.map((id: string) => ({ id })) },
      }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      _count: { select: { comments: true, subTasks: true } },
    },
  })

  // Activity log: creation, and subtask-added on the parent if any
  await logActivity({ taskId: task.id, userId: session.user.id, kind: 'task.created' })
  if (parentId) {
    await logActivity({
      taskId: parentId,
      userId: session.user.id,
      kind: 'subtask.added',
      metadata: { subtaskId: task.id, title: task.title },
    })
  }
  // Notify assignee if it isn't the creator
  if (assigneeId && assigneeId !== session.user.id) {
    await notify({
      userIds: [assigneeId],
      kind: 'task.assigned',
      actorId: session.user.id,
      taskId: task.id,
      metadata: { title: task.title },
    })
  }

  return NextResponse.json(task)
}
