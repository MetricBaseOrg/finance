import { prisma } from '@/lib/prisma'
import { sendInstantEmail } from '@/lib/email'

/**
 * Append-only activity log. Every meaningful mutation to a task should call
 * `logActivity` so the detail panel can render a "who did what" timeline.
 *
 * `metadata` is stored as JSON-encoded text (SQLite has no native JSON column);
 * use the typed helpers below rather than passing arbitrary objects.
 */
export type ActivityKind =
  | 'task.created'
  | 'task.deleted'
  | 'status.changed'
  | 'priority.changed'
  | 'assignee.changed'
  | 'title.changed'
  | 'description.changed'
  | 'due.changed'
  | 'start.changed'
  | 'milestone.changed'
  | 'comment.added'
  | 'comment.deleted'
  | 'subtask.added'
  | 'subtask.completed'
  | 'label.added'
  | 'label.removed'

export type ActivityMetadata =
  | { from?: string | null; to?: string | null }
  | { commentId: string; preview?: string }
  | { subtaskId: string; title: string }
  | { labelId: string; name: string }
  | Record<string, unknown>

export async function logActivity(params: {
  taskId: string
  userId: string
  kind: ActivityKind
  metadata?: ActivityMetadata
}) {
  try {
    await prisma.taskActivity.create({
      data: {
        taskId: params.taskId,
        userId: params.userId,
        kind: params.kind,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    })
  } catch (err) {
    // Activity logging is best-effort; never fail the user's action because of it.
    console.error('logActivity failed', { kind: params.kind, taskId: params.taskId, err })
  }
}

/**
 * Parse @mentions from a comment body. Mentions look like @name or @email-local
 * — case-insensitive. We resolve against the workspace's members to produce a
 * list of userIds to notify.
 */
const MENTION_RE = /@([\w.+-]+)/g

export function extractMentionHandles(text: string): string[] {
  const set = new Set<string>()
  for (const m of text.matchAll(MENTION_RE)) {
    set.add(m[1].toLowerCase())
  }
  return [...set]
}

/**
 * Given mention handles and a list of workspace members, resolve to user IDs.
 * A member matches if its `name` (lowercased, spaces stripped) OR `email`
 * local-part starts with the handle.
 */
export function resolveMentions(
  handles: string[],
  members: { user: { id: string; name?: string | null; email?: string | null } }[],
): string[] {
  if (handles.length === 0) return []
  const ids = new Set<string>()
  for (const h of handles) {
    for (const m of members) {
      const name = (m.user.name || '').toLowerCase().replace(/\s+/g, '')
      const local = (m.user.email || '').split('@')[0].toLowerCase()
      if (name === h || local === h || name.startsWith(h) || local.startsWith(h)) {
        ids.add(m.user.id)
        break
      }
    }
  }
  return [...ids]
}

/** Notify users — fan out one row per recipient, and send instant emails for
 *  high-signal kinds (mention, task.assigned, comment.added).
 *
 *  Email sends are intentionally not awaited — the function returns once the
 *  DB rows are created, so the API caller never blocks on SMTP latency.
 */
export async function notify(params: {
  userIds: string[]
  kind: string
  actorId: string
  taskId?: string
  commentId?: string
  metadata?: Record<string, unknown>
}) {
  if (params.userIds.length === 0) return
  const recipients = params.userIds.filter(uid => uid !== params.actorId)
  if (recipients.length === 0) return

  const rows = recipients.map(uid => ({
    userId: uid,
    kind: params.kind,
    actorId: params.actorId,
    taskId: params.taskId,
    commentId: params.commentId,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  }))
  try {
    await prisma.taskNotification.createMany({ data: rows })
  } catch (err) {
    console.error('notify failed', err)
  }

  // Fan out instant emails (fire-and-forget). Only for kinds where instant
  // delivery is appropriate — everything else waits for the daily digest.
  const instantKinds = new Set(['mention', 'task.assigned', 'comment.added'])
  if (params.taskId && instantKinds.has(params.kind)) {
    const preview = typeof params.metadata?.preview === 'string'
      ? params.metadata.preview as string
      : undefined
    for (const uid of recipients) {
      void sendInstantEmail({
        recipientUserId: uid,
        actorId: params.actorId,
        taskId: params.taskId,
        kind: params.kind as 'mention' | 'task.assigned' | 'comment.added',
        preview,
      })
    }
  }
}
