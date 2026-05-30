import { prisma } from '@/lib/prisma'
import { runAgentRun } from '@/lib/agent/runtime'

/**
 * Deterministic idempotency key for a triggering event. Both inline dispatch
 * (from notify) and the cron sweep compute this identically from the same
 * notification fields, so the `@@unique([agentId, sourceKey])` constraint makes
 * an event process at most once across both paths.
 */
export function sourceKeyFor(kind: string, taskId?: string | null, commentId?: string | null): string {
  return `${kind}:${commentId ?? 'na'}:${taskId ?? 'na'}`
}

/**
 * If any recipient of a task notification is an enabled agent, enqueue and run
 * it. Skips entirely when the triggering actor is itself an agent — this is the
 * loop guard that prevents agent↔agent cascades.
 */
export async function maybeDispatchAgents(opts: {
  recipientUserIds: string[]
  kind: string
  actorId: string
  taskId?: string | null
  commentId?: string | null
}): Promise<void> {
  if (opts.recipientUserIds.length === 0) return

  // Loop guard: never let an agent's own action trigger another agent run.
  const actor = await prisma.user.findUnique({
    where: { id: opts.actorId },
    select: { kind: true },
  })
  if (actor?.kind === 'AGENT') return

  const agents = await prisma.agent.findMany({
    where: { userId: { in: opts.recipientUserIds }, enabled: true },
    select: { id: true, organizationId: true },
  })
  if (agents.length === 0) return

  const sourceKey = sourceKeyFor(opts.kind, opts.taskId, opts.commentId)
  const trigger = opts.kind === 'task.assigned' ? 'assign' : 'mention'

  for (const agent of agents) {
    try {
      const run = await prisma.agentRun.create({
        data: {
          agentId: agent.id,
          organizationId: agent.organizationId,
          trigger,
          taskId: opts.taskId ?? null,
          sourceKey,
        },
        select: { id: true },
      })
      // Fire-and-forget; runtime owns its own error handling.
      void runAgentRun(run.id)
    } catch {
      // Unique-constraint violation = this event was already dispatched for
      // this agent (by an earlier call or the sweep). Safe to ignore.
    }
  }
}

/**
 * Dispatch agents @mentioned in a chat message. Same loop guard (skip agent
 * authors) and idempotency (sourceKey = the message id) as the task path.
 */
export async function dispatchChatAgents(opts: {
  channelId: string
  messageId: string
  mentionedUserIds: string[]
  actorId: string
}): Promise<void> {
  if (opts.mentionedUserIds.length === 0) return

  const actor = await prisma.user.findUnique({
    where: { id: opts.actorId },
    select: { kind: true },
  })
  if (actor?.kind === 'AGENT') return

  // Only agents that are members of THIS channel may be summoned into it.
  const channelAgentMembers = await prisma.channelMember.findMany({
    where: { channelId: opts.channelId, userId: { in: opts.mentionedUserIds } },
    select: { userId: true },
  })
  const memberUserIds = channelAgentMembers.map(m => m.userId)
  if (memberUserIds.length === 0) return

  const agents = await prisma.agent.findMany({
    where: { userId: { in: memberUserIds }, enabled: true },
    select: { id: true, organizationId: true },
  })
  const sourceKey = `chat:${opts.messageId}`

  for (const agent of agents) {
    try {
      const run = await prisma.agentRun.create({
        data: {
          agentId: agent.id,
          organizationId: agent.organizationId,
          trigger: 'chat',
          channelId: opts.channelId,
          sourceKey,
        },
        select: { id: true },
      })
      void runAgentRun(run.id)
    } catch {
      // Already dispatched for this message.
    }
  }
}
