import 'server-only'
import { prisma } from '@/lib/prisma'
import { logActivity, notify } from '@/lib/activity'

/**
 * FieldFlow → ProBase bridge. Field work assigned to a user is recorded as a
 * ProBase Task in a dedicated, auto-provisioned "Field Operations" project per
 * org, so it's fully managed in ProBase (board, my-tasks, status, notifications).
 * The task keeps an optional soft link (fieldRefType + fieldRefId) back to the
 * field record it was raised from.
 */

export const FIELD_REF_TYPES = ['node', 'flow', 'lifting', 'target'] as const
export type FieldRefType = (typeof FIELD_REF_TYPES)[number]

/** Find (or create once) the org's "Field Operations" project that holds field tasks. */
export async function getOrCreateFieldOpsProject(organizationId: string): Promise<{ id: string }> {
  const existing = await prisma.project.findFirst({
    where: { organizationId, isFieldOps: true },
    select: { id: true },
  })
  if (existing) return existing
  return prisma.project.create({
    data: {
      organizationId,
      name: 'Field Operations',
      description: 'Work assigned from FieldFlow — production, liftings, and node tasks.',
      color: '#c9a84c',
      icon: 'gauge',
      isFieldOps: true,
    },
    select: { id: true },
  })
}

/**
 * Validate a field reference belongs to the org and return a human label
 * (e.g. node code, lifting tanker). Returns null when the ref is unknown.
 */
export async function validateFieldRef(
  organizationId: string,
  type: FieldRefType,
  id: string,
): Promise<string | null> {
  switch (type) {
    case 'node': {
      const n = await prisma.node.findFirst({ where: { id, organizationId }, select: { code: true, name: true } })
      return n ? `${n.code} · ${n.name}` : null
    }
    case 'lifting': {
      const l = await prisma.lifting.findFirst({ where: { id, organizationId }, select: { tankerName: true } })
      return l ? l.tankerName : null
    }
    case 'flow': {
      const f = await prisma.flow.findFirst({ where: { id, organizationId }, select: { flowType: true, date: true, node: { select: { code: true } } } })
      return f ? `${f.node.code} ${f.flowType} ${f.date}` : null
    }
    case 'target': {
      const t = await prisma.target.findFirst({ where: { id, organizationId }, select: { year: true, month: true, category: true, node: { select: { code: true } } } })
      return t ? `${t.node.code} ${t.category} ${t.year}-${String(t.month).padStart(2, '0')}` : null
    }
    default:
      return null
  }
}

/** Batch-resolve display labels for a set of task field refs (for list views). */
export async function resolveFieldRefLabels(
  organizationId: string,
  refs: { type: FieldRefType; id: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  await Promise.all(
    refs.map(async (r) => {
      const label = await validateFieldRef(organizationId, r.type, r.id)
      if (label) map.set(`${r.type}:${r.id}`, label)
    }),
  )
  return map
}

type CreateFieldTaskInput = {
  organizationId: string
  creatorId: string
  title: string
  description?: string | null
  assigneeId?: string | null
  dueDate?: string | null
  priority?: string | null
  refType?: FieldRefType | null
  refId?: string | null
}

/**
 * Create a field task as a ProBase Task in the org's Field Operations project.
 * Mirrors the task-creation side effects in app/api/tasks/route.ts (order,
 * activity log, assignee notification).
 */
export async function createFieldTask(input: CreateFieldTaskInput) {
  const project = await getOrCreateFieldOpsProject(input.organizationId)

  const lastTask = await prisma.task.findFirst({
    where: { projectId: project.id, status: 'TODO' },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status: 'TODO',
      priority: input.priority || 'MEDIUM',
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      projectId: project.id,
      creatorId: input.creatorId,
      assigneeId: input.assigneeId ?? null,
      order: (lastTask?.order ?? 0) + 1000,
      fieldRefType: input.refType ?? null,
      fieldRefId: input.refId ?? null,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { comments: true, subTasks: true } },
    },
  })

  await logActivity({ taskId: task.id, userId: input.creatorId, kind: 'task.created' })
  if (input.assigneeId && input.assigneeId !== input.creatorId) {
    await notify({
      userIds: [input.assigneeId],
      kind: 'task.assigned',
      actorId: input.creatorId,
      taskId: task.id,
      metadata: { title: task.title },
    })
  }

  return { task, projectId: project.id }
}
