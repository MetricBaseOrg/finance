import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { extractMentionHandles, logActivity, notify, resolveMentions } from '@/lib/activity'
import { can, getRole, getWorkspaceForTask } from '@/lib/permissions'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, taskId } = await req.json()
  if (!content || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const userId = session.user.id

  const organizationId = await getWorkspaceForTask(taskId)
  if (!organizationId) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  const role = await getRole(userId, organizationId)
  if (!role || !can(role, 'comment.create')) {
    return NextResponse.json({ error: 'Your role does not permit commenting.' }, { status: 403 })
  }

  const comment = await prisma.comment.create({
    data: { content, taskId, userId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })

  // Log activity for the timeline
  await logActivity({
    taskId,
    userId,
    kind: 'comment.added',
    metadata: { commentId: comment.id, preview: content.slice(0, 120) },
  })

  // Resolve @mentions against the workspace members and fan out notifications
  const handles = extractMentionHandles(content)
  if (handles.length > 0) {
    // Walk task → project → workspace → members
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        assigneeId: true,
        project: {
          select: {
            workspace: {
              select: {
                members: {
                  select: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    const members = task?.project.workspace.members || []
    const mentionedIds = resolveMentions(handles, members)
    if (mentionedIds.length > 0) {
      await notify({
        userIds: mentionedIds,
        kind: 'mention',
        actorId: userId,
        taskId,
        commentId: comment.id,
        metadata: { taskTitle: task?.title, preview: content.slice(0, 120) },
      })
    }
    // Also notify the assignee (if not the actor and not already mentioned)
    if (task?.assigneeId && task.assigneeId !== userId && !mentionedIds.includes(task.assigneeId)) {
      await notify({
        userIds: [task.assigneeId],
        kind: 'comment.added',
        actorId: userId,
        taskId,
        commentId: comment.id,
        metadata: { taskTitle: task.title, preview: content.slice(0, 120) },
      })
    }
  }

  return NextResponse.json(comment)
}
