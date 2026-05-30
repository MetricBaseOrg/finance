import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/utils'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaces = await prisma.organization.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      projects: {
        where: { status: { not: 'ARCHIVED' } },
        include: { _count: { select: { tasks: true } } },
      },
      _count: { select: { projects: true, members: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Annotate each workspace with the current user's role for client-side gating.
  const userId = session.user.id
  const annotated = workspaces.map(w => {
    const me = w.members.find(m => m.user.id === userId)
    return { ...w, myRole: me?.role ?? null }
  })

  return NextResponse.json(annotated)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const workspace = await prisma.organization.create({
    data: {
      name,
      slug: generateSlug(name),
      description,
      color: color || '#6366f1',
      members: { create: { userId: session.user.id, role: 'OWNER' } },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } } },
  })

  return NextResponse.json(workspace)
}
