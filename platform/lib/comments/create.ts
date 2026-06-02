import { prisma } from '@/lib/prisma'
import { extractMentionHandles, logActivity, notify, resolveMentions } from '@/lib/activity'

/**
 * Shared comment-creation service. Creates the comment, logs activity, resolves
 * @mentions against workspace members, and fans out notifications (mentions +
 * assignee). Used by both the HTTP route (app/api/comments/route.ts) and the
 * agent's `post_comment` tool, so an agent's comment notifies mentioned humans
 * exactly like a human's would — and `notify()` skips the actor, so an agent
 * never notifies itself.
 */
export async function createComment(opts: {
  taskId: string
  actorUserId: string
  content: string
}) {
  const { taskId, actorUserId: userId, content } = opts

  const comment = await prisma.comment.create({
    data: { content, taskId, userId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })

  await logActivity({
    taskId,
    userId,
    kind: 'comment.added',
    metadata: { commentId: comment.id, preview: content.slice(0, 120) },
  })

  const handles = extractMentionHandles(content)

  // Always fetch task context if we need to notify mentions or the assignee.
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
                select: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
      },
    },
  })

  const members = task?.project.workspace.members || []
  let mentionedIds: string[] = []

  if (handles.length > 0) {
    mentionedIds = resolveMentions(handles, members)
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
  }

  // Notify the assignee whenever someone else comments, regardless of mentions.
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

  return comment
}
