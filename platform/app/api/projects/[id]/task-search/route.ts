import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/projects/:id/task-search?q=...&exclude=taskId
 *
 * Lightweight task lookup used by the dependency picker in the task detail
 * panel. Scoped to a single project; matches on title prefix/substring;
 * optionally excludes one task id (the task whose detail panel is open) so
 * users can't try to link a task to itself.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const exclude = searchParams.get('exclude')

  // Verify the user can see this project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      workspace: {
        select: { members: { where: { userId: session.user.id }, select: { id: true } } },
      },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      ...(exclude && { id: { not: exclude } }),
      ...(q && { title: { contains: q } }),
    },
    select: { id: true, title: true, status: true, priority: true, parentId: true },
    orderBy: { updatedAt: 'desc' },
    take: 12,
  })

  return NextResponse.json(tasks)
}
