import { prisma } from '@/lib/prisma'
import { ROLE_LABELS, type Role } from '@/lib/permissions'

/** System prompt: agent persona + workspace context + behavioural guardrails. */
export function buildSystemPrompt(opts: {
  agentName: string
  role: Role
  orgName: string
  instructions: string
}): string {
  return `You are "${opts.agentName}", an AI member of the "${opts.orgName}" workspace in the MetricBase platform. Your workspace role is ${ROLE_LABELS[opts.role]}, which determines what you are permitted to do — the tools enforce this, so if a tool returns a permission error, respect it and explain.

Your instructions from the workspace owner:
${opts.instructions || '(none provided)'}

How to work:
- Use the tools to read context and take real actions. Don't claim you did something unless a tool call succeeded.
- Be concise and concrete. When you finish, give a short plain-text summary of what you did or found.
- To communicate on a task, call post_comment. You can @mention people (e.g. "@arief") to notify them.
- Only take actions that clearly follow from what you were asked. When unsure, ask in a comment rather than guessing.
- Never loop: if a tool keeps failing, stop and report the problem.`
}

/**
 * Build the opening user message for a task-triggered run (assign / mention /
 * manual). Includes the task + recent thread so the agent usually needs zero or
 * one extra read before acting.
 */
export async function buildTaskTriggerMessage(opts: {
  taskId: string
  trigger: string
  agentName: string
  extraPrompt?: string | null
}): Promise<string> {
  const task = await prisma.task.findUnique({
    where: { id: opts.taskId },
    select: {
      title: true, description: true, status: true, priority: true, dueDate: true,
      comments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      },
    },
  })
  if (!task) return `You were triggered on task ${opts.taskId}, but it no longer exists.`

  const thread = task.comments
    .slice()
    .reverse()
    .map(c => `  - ${c.user.name ?? c.user.email}: ${c.content}`)
    .join('\n') || '  (no comments yet)'

  const lead =
    opts.trigger === 'assign'
      ? `You have just been assigned this task. Decide what to do to move it forward, then act and report back with a comment.`
      : opts.trigger === 'mention'
        ? `You were @mentioned on this task. Read the latest comments below and respond helpfully (post a comment; take actions if asked).`
        : `You were asked to help with this task.`

  return `${lead}

Task id: ${opts.taskId}
Title: ${task.title}
Status: ${task.status} · Priority: ${task.priority}${task.dueDate ? ` · Due: ${task.dueDate.toISOString().slice(0, 10)}` : ''}
Description: ${task.description || '(none)'}

Recent comments (oldest → newest):
${thread}
${opts.extraPrompt ? `\nAdditional instruction: ${opts.extraPrompt}` : ''}`
}

/**
 * Opening message for a chat-triggered run: recent channel history + an
 * instruction to reply in the channel. The runtime auto-posts the agent's final
 * text as a channel message, so the agent just needs to produce a reply.
 */
export async function buildChatTriggerMessage(opts: {
  channelId: string
  agentName: string
}): Promise<string> {
  const channel = await prisma.channel.findUnique({
    where: { id: opts.channelId },
    select: {
      name: true,
      messages: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      },
    },
  })
  if (!channel) return `You were mentioned in channel ${opts.channelId}, but it no longer exists.`

  const history = channel.messages
    .slice()
    .reverse()
    .map(m => `  ${m.user.name ?? m.user.email}: ${m.content}`)
    .join('\n') || '  (no messages yet)'

  return `You (@${opts.agentName}) were mentioned in the chat channel "#${channel.name}". Read the recent conversation and reply helpfully. Use your tools if you need to look something up or take an action. Keep your reply conversational and concise — it will be posted as your message in the channel.

Channel id: ${opts.channelId}

Recent messages (oldest → newest):
${history}`
}
