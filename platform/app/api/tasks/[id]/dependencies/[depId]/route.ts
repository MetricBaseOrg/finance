import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/tasks/:id/dependencies/:depId
 * Removes a dependency. The caller must be a member of the workspace the
 * dependency touches.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; depId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId, depId } = await params

  const dep = await prisma.taskDependency.findUnique({
    where: { id: depId },
    include: {
      blocker: { select: { project: { select: { workspace: { select: { members: { where: { userId: session.user.id }, select: { id: true } } } } } } } },
    },
  })
  if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // The dep must involve this task (defensive — prevents stray deletions)
  if (dep.blockerId !== taskId && dep.blockedId !== taskId) {
    return NextResponse.json({ error: 'Mismatch' }, { status: 400 })
  }
  if (dep.blocker.project.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.taskDependency.delete({ where: { id: depId } })
  return NextResponse.json({ ok: true })
}
