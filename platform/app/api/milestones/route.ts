import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { dueDate: 'asc' },
  })

  return NextResponse.json(milestones)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, dueDate, projectId } = await req.json()
  if (!name || !projectId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const milestone = await prisma.milestone.create({
    data: {
      name,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      projectId,
    },
  })

  return NextResponse.json(milestone)
}
