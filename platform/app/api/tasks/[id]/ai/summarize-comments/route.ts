import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { summarizeComments } from '@/lib/ai'
import { AI_NOT_CONFIGURED_MSG, isOrgAIConfigured } from '@/lib/anthropic'

/**
 * POST /api/tasks/:id/ai/summarize-comments
 *
 * Returns { tldr, openQuestions, decisions } — three arrays of short bullets.
 * Caller renders them as a collapsible panel above the comment thread.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      title: true,
      project: {
        select: {
          organizationId: true,
          workspace: {
            select: { members: { where: { userId: session.user.id }, select: { id: true } } },
          },
        },
      },
      comments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
        take: 200,
      },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.project.workspace.members.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (task.comments.length < 2) {
    return NextResponse.json({
      tldr: [], openQuestions: [], decisions: [],
      note: 'Not enough comments to summarize.',
    })
  }

  const orgId = task.project.organizationId
  if (!(await isOrgAIConfigured(orgId))) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MSG }, { status: 503 })
  }

  try {
    const result = await summarizeComments({
      taskTitle: task.title,
      comments: task.comments.map(c => ({
        author: c.user.name || c.user.email || 'Unknown',
        createdAt: c.createdAt.toISOString(),
        content: c.content,
      })),
      organizationId: orgId,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI summarize failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI call failed' },
      { status: 502 },
    )
  }
}
