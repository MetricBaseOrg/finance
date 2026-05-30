import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { can, getRole, getWorkspaceForProject } from '@/lib/permissions'
import {
  captureProjectTemplate,
  captureTaskTemplate,
  isTemplateKind,
  type TemplateKind,
} from '@/lib/templates'

/**
 * GET /api/templates?organizationId=X[&kind=TASK|PROJECT]
 * Lists templates in a workspace the user belongs to.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get('organizationId')
  const kind = searchParams.get('kind')
  if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const role = await getRole(session.user.id, organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const templates = await prisma.template.findMany({
    where: {
      organizationId,
      ...(isTemplateKind(kind) ? { kind } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, kind: true, name: true, description: true,
      content: true, createdById: true, createdAt: true,
    },
  })

  return NextResponse.json(templates)
}

/**
 * POST /api/templates
 * Body (one of):
 *   { kind:'TASK',    organizationId, name, description?, fromTaskId }
 *   { kind:'PROJECT', organizationId, name, description?, fromProjectId }
 *   { kind, organizationId, name, description?, content }   // raw content
 *
 * Requires the same permission as creating the underlying entity.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { kind, name, description, fromTaskId, fromProjectId, content } = body
  let { organizationId } = body
  if (!isTemplateKind(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // Derive organizationId from the source entity if it wasn't supplied.
  if (!organizationId) {
    if (kind === 'TASK' && fromTaskId) organizationId = await getWorkspaceForTaskLocal(fromTaskId)
    else if (kind === 'PROJECT' && fromProjectId) organizationId = await getWorkspaceForProject(fromProjectId)
  }
  if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const role = await getRole(session.user.id, organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Saving a template requires create capability for the entity type
  const requiredAction = kind === 'TASK' ? 'task.create' : 'project.create'
  if (!can(role, requiredAction)) {
    return NextResponse.json({ error: 'Your role does not permit creating templates.' }, { status: 403 })
  }

  // Build the content (verify the source actually lives in this workspace)
  let resolvedContent: unknown = content
  if (kind === 'TASK' && fromTaskId) {
    const ws = await getWorkspaceForTaskLocal(fromTaskId)
    if (ws !== organizationId) return NextResponse.json({ error: 'Source task not in workspace' }, { status: 400 })
    resolvedContent = await captureTaskTemplate(fromTaskId)
  } else if (kind === 'PROJECT' && fromProjectId) {
    const ws = await getWorkspaceForProject(fromProjectId)
    if (ws !== organizationId) return NextResponse.json({ error: 'Source project not in workspace' }, { status: 400 })
    resolvedContent = await captureProjectTemplate(fromProjectId)
  }
  if (!resolvedContent) return NextResponse.json({ error: 'Could not build template content' }, { status: 400 })

  const tpl = await prisma.template.create({
    data: {
      organizationId,
      kind: kind as TemplateKind,
      name,
      description: description ?? null,
      content: JSON.stringify(resolvedContent),
      createdById: session.user.id,
    },
  })

  return NextResponse.json(tpl)
}

async function getWorkspaceForTaskLocal(taskId: string): Promise<string | null> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { organizationId: true } } },
  })
  return t?.project.organizationId ?? null
}
