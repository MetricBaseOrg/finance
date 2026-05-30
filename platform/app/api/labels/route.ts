import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color, projectId } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const label = await prisma.label.create({
    data: { name, color: color || '#6366f1', projectId },
  })

  return NextResponse.json(label)
}
