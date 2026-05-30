import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { can, getRole } from '@/lib/permissions'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get('organizationId')
  if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const projects = await prisma.project.findMany({
    where: { organizationId },
    include: {
      _count: { select: { tasks: true, milestones: true } },
      milestones: { orderBy: { dueDate: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, color, icon, organizationId } = await req.json()
  if (!name || !organizationId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const role = await getRole(session.user.id, organizationId)
  if (!role) return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
  if (!can(role, 'project.create')) {
    return NextResponse.json({ error: 'Your role does not permit creating projects.' }, { status: 403 })
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      color: color || '#6366f1',
      icon,
      organizationId,
    },
    include: { _count: { select: { tasks: true } } },
  })

  return NextResponse.json(project)
}
