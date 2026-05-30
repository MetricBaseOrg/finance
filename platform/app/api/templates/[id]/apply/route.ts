import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { can, getRole, getWorkspaceForProject } from '@/lib/permissions'
import {
  applyProjectTemplate,
  applyTaskTemplate,
  type ProjectTemplateContent,
  type TaskTemplateContent,
} from '@/lib/templates'

/**
 * POST /api/templates/:id/apply
 *
 * TASK template    body: { projectId }       → creates a task + subtasks
 * PROJECT template body: { nameOverride? }   → creates a whole new project
 *
 * The new project lands in the template's own workspace.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const tpl = await prisma.template.findUnique({
    where: { id },
    select: { id: true, kind: true, content: true, organizationId: true },
  })
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = await getRole(session.user.id, tpl.organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let parsed: unknown
  try { parsed = JSON.parse(tpl.content) } catch {
    return NextResponse.json({ error: 'Template content is corrupt' }, { status: 500 })
  }

  if (tpl.kind === 'TASK') {
    if (!can(role, 'task.create')) {
      return NextResponse.json({ error: 'Your role does not permit creating tasks.' }, { status: 403 })
    }
    const projectId = body.projectId
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    // The target project must be in the same workspace as the template
    const ws = await getWorkspaceForProject(projectId)
    if (ws !== tpl.organizationId) {
      return NextResponse.json({ error: 'Project must be in the template\'s workspace' }, { status: 400 })
    }
    const task = await applyTaskTemplate({
      content: parsed as TaskTemplateContent,
      projectId,
      creatorId: session.user.id,
    })
    return NextResponse.json({ kind: 'TASK', task })
  }

  // PROJECT
  if (!can(role, 'project.create')) {
    return NextResponse.json({ error: 'Your role does not permit creating projects.' }, { status: 403 })
  }
  const project = await applyProjectTemplate({
    content: parsed as ProjectTemplateContent,
    organizationId: tpl.organizationId,
    creatorId: session.user.id,
    nameOverride: typeof body.nameOverride === 'string' ? body.nameOverride : undefined,
  })
  return NextResponse.json({ kind: 'PROJECT', project })
}
