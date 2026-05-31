import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { getFieldContext, logFieldAudit } from '@/server/field'
import {
  FIELD_REF_TYPES, type FieldRefType,
  createFieldTask, getOrCreateFieldOpsProject, resolveFieldRefLabels, validateFieldRef,
} from '@/lib/field/tasks'

export const dynamic = 'force-dynamic'

/** GET /api/field/tasks — field tasks (the org's Field Operations project) with assignee, status, and ref label. */
export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findFirst({
    where: { organizationId: ctx.organizationId, isFieldOps: true },
    select: { id: true },
  })
  if (!project) return NextResponse.json({ tasks: [], projectId: null })

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id, parentId: null },
    include: { assignee: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
    take: 500,
  })

  const refs = tasks
    .filter((t) => t.fieldRefType && t.fieldRefId)
    .map((t) => ({ type: t.fieldRefType as FieldRefType, id: t.fieldRefId as string }))
  const labels = await resolveFieldRefLabels(ctx.organizationId, refs)

  return NextResponse.json({
    projectId: project.id,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate,
      dueDate: t.dueDate,
      recurrence: t.recurrence,
      assignee: t.assignee,
      refType: t.fieldRefType,
      refId: t.fieldRefId,
      refLabel: t.fieldRefType && t.fieldRefId ? labels.get(`${t.fieldRefType}:${t.fieldRefId}`) ?? null : null,
    })),
  })
}

/** POST /api/field/tasks — assign field work as a ProBase task. */
export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can(ctx.role as Parameters<typeof can>[0], 'task.create')) {
    return NextResponse.json({ error: 'Your role does not permit creating tasks.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  // Validate optional assignee belongs to the org.
  let assigneeId: string | null = null
  if (body.assigneeId) {
    const member = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: String(body.assigneeId), organizationId: ctx.organizationId } },
      select: { userId: true },
    })
    if (!member) return NextResponse.json({ error: 'Assignee is not a member of this workspace' }, { status: 400 })
    assigneeId = member.userId
  }

  // Validate optional field reference.
  let refType: FieldRefType | null = null
  let refId: string | null = null
  if (body.refType || body.refId) {
    if (!FIELD_REF_TYPES.includes(body.refType)) {
      return NextResponse.json({ error: `refType must be one of ${FIELD_REF_TYPES.join(', ')}` }, { status: 400 })
    }
    const label = await validateFieldRef(ctx.organizationId, body.refType, String(body.refId ?? ''))
    if (!label) return NextResponse.json({ error: 'Unknown field reference' }, { status: 400 })
    refType = body.refType
    refId = String(body.refId)
  }

  const { task, projectId } = await createFieldTask({
    organizationId: ctx.organizationId,
    creatorId: ctx.userId,
    title,
    description: body.description ? String(body.description) : null,
    assigneeId,
    startDate: body.startDate ? String(body.startDate) : null,
    dueDate: body.dueDate ? String(body.dueDate) : null,
    priority: body.priority ? String(body.priority) : null,
    recurrence: body.recurrence ? String(body.recurrence) : null,
    recurrenceEnd: body.recurrenceEnd ? String(body.recurrenceEnd) : null,
    refType,
    refId,
  })

  await logFieldAudit({
    organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'CREATE', entityType: 'TASK', entityId: task.id,
    summary: `Assigned task "${title}"${refType ? ` (${refType})` : ''}`,
  })

  return NextResponse.json({ ...task, projectId }, { status: 201 })
}

// Ensure the Field Operations project exists when the page first loads its members/tasks.
export async function PUT() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const project = await getOrCreateFieldOpsProject(ctx.organizationId)
  return NextResponse.json({ projectId: project.id })
}
