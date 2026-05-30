import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { summarizeComments, isAIConfigured } from '@/lib/ai'

/**
 * POST /api/tasks/:id/ai/summarize-comments
 *
 * Returns { tldr, openQuestions, decisions } — three arrays of short bullets.
 * Caller renders them as a collapsible panel above the comment thread.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAIConfigured()) {
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 })
  }

  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      title: true,
      project: {
        select: {
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

  try {
    const result = await summarizeComments({
      taskTitle: task.title,
      comments: task.comments.map(c => ({
        author: c.user.name || c.user.email || 'Unknown',
        createdAt: c.createdAt.toISOString(),
        content: c.content,
      })),
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
