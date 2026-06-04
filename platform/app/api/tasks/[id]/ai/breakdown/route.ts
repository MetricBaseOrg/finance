import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { breakdownTask } from '@/lib/ai'
import { AI_NOT_CONFIGURED_MSG, isOrgAIConfigured } from '@/lib/anthropic'

/**
 * POST /api/tasks/:id/ai/breakdown
 *
 * Returns up to 7 suggested subtask titles. We don't create the subtasks here
 * — the client lets the user pick which suggestions to accept, then POSTs the
 * accepted ones to the regular /api/tasks endpoint.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      project: {
        select: {
          organizationId: true,
          workspace: {
            select: { members: { where: { userId: session.user.id }, select: { id: true } } },
          },
        },
      },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.project.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = task.project.organizationId
  if (!(await isOrgAIConfigured(orgId))) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MSG }, { status: 503 })
  }

  try {
    const result = await breakdownTask({
      title: task.title,
      description: task.description || undefined,
      organizationId: orgId,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI breakdown failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI call failed' },
      { status: 502 },
    )
  }
}
