import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { can, getRole, getWorkspaceForProject } from '@/lib/permissions'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Enforce workspace membership: only members of the project's workspace can view it.
  // This prevents data leakage and returns 404 for non-members (do not reveal existence).
  const project = await prisma.project.findFirst({
    where: {
      id,
      workspace: { members: { some: { userId: session.user.id } } },
    },
    include: {
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true, image: true } },
          creator: { select: { id: true, name: true, email: true } },
          labels: true,
          subTasks: { select: { id: true, title: true, status: true } },
          milestone: true,
          // Only the blocker's status matters for the "is currently blocked" badge
          blockedBy: { select: { id: true, blocker: { select: { id: true, status: true, title: true } } } },
          _count: { select: { comments: true, subTasks: true } },
        },
        orderBy: { order: 'asc' },
      },
      milestones: { orderBy: { dueDate: 'asc' } },
      labels: true,
      workspace: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
        },
      },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(project)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const organizationId = await getWorkspaceForProject(id)
  if (!organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = await getRole(session.user.id, organizationId)
  if (!role || !can(role, 'project.update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.color && { color: data.color }),
      ...(data.status && { status: data.status }),
    },
  })

  return NextResponse.json(project)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const organizationId = await getWorkspaceForProject(id)
  if (!organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = await getRole(session.user.id, organizationId)
  if (!role || !can(role, 'project.delete')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.project.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
