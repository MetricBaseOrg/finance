import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { AI_NOT_CONFIGURED_MSG, getOrgAnthropic } from '@/lib/anthropic'
import { isRole } from '@/lib/permissions'
import { buildSystemPrompt, buildTaskTriggerMessage, buildChatTriggerMessage } from '@/lib/agent/context'
import { createComment } from '@/lib/comments/create'
import { postChatMessage } from '@/lib/chat/post'
import {
  DIRECT_POST_TOOLS,
  executeTool,
  toolDefinitions,
  toolsForScopes,
} from '@/lib/agent/tools'
import type { ToolContext } from '@/lib/agent/types'

const MAX_STEPS = 8
const MAX_TOKENS = 1024

/**
 * Execute one queued AgentRun: build context, run the tool-use loop, post the
 * result, and record metrics. Safe to call fire-and-forget — it owns its own
 * error handling and never throws to the caller.
 */
export async function runAgentRun(runId: string): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { agent: true },
  })
  if (!run) return
  // Idempotency: only a queued run proceeds. Claim it atomically.
  if (run.status !== 'queued') return
  const claimed = await prisma.agentRun.updateMany({
    where: { id: runId, status: 'queued' },
    data: { status: 'running' },
  })
  if (claimed.count === 0) return

  // Resolve provider config for this workspace (org settings over env).
  const ai = await getOrgAnthropic(run.organizationId)
  if (!ai) {
    await fail(runId, AI_NOT_CONFIGURED_MSG)
    return
  }
  const client = ai.client

  const agent = run.agent
  if (!agent.enabled) {
    await fail(runId, 'Agent is disabled.')
    return
  }

  // The agent's role comes from its Membership (its autonomy).
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: agent.userId, organizationId: agent.organizationId } },
    select: { role: true },
  })
  const role = membership && isRole(membership.role) ? membership.role : 'VIEWER'

  const org = await prisma.organization.findUnique({
    where: { id: agent.organizationId },
    select: { name: true },
  })

  const tools = toolsForScopes(agent.scopes)
  const ctx: ToolContext = {
    agentUserId: agent.userId,
    organizationId: agent.organizationId,
    agentRole: role,
    agentName: agent.name,
  }

  const system = buildSystemPrompt({
    agentName: agent.name,
    role,
    orgName: org?.name ?? 'this workspace',
    instructions: agent.instructions,
  })

  // Opening message depends on the trigger.
  let opening: string
  if (run.taskId) {
    opening = await buildTaskTriggerMessage({
      taskId: run.taskId,
      trigger: run.trigger,
      agentName: agent.name,
      extraPrompt: run.prompt,
    })
  } else if (run.channelId) {
    opening = await buildChatTriggerMessage({ channelId: run.channelId, agentName: agent.name })
  } else {
    opening = run.prompt || 'How can you help in this workspace right now?'
  }

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opening }]
  let inputTokens = 0
  let outputTokens = 0
  let toolCalls = 0
  let postedDirectly = false
  let finalText = ''

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const resp = await client.messages.create({
        model: agent.model || ai.model,
        max_tokens: MAX_TOKENS,
        system,
        tools: toolDefinitions(tools),
        tool_choice: { type: 'auto' },
        messages,
      })
      inputTokens += resp.usage?.input_tokens ?? 0
      outputTokens += resp.usage?.output_tokens ?? 0

      messages.push({ role: 'assistant', content: resp.content })

      const toolUses = resp.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim()
      if (text) finalText = text

      if (toolUses.length === 0) break // model is done

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        toolCalls++
        if (DIRECT_POST_TOOLS.has(tu.name)) postedDirectly = true
        const result = await executeTool(tools, ctx, tu.name, tu.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    // Deliver the answer. If the agent didn't already post via a tool, post its
    // final text so the thread/channel isn't left silent.
    if (!postedDirectly && finalText) {
      if (run.taskId) {
        await createComment({ taskId: run.taskId, actorUserId: agent.userId, content: finalText })
      } else if (run.channelId) {
        await postChatMessage({ channelId: run.channelId, actorUserId: agent.userId, content: finalText })
      }
    }

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'done',
        result: finalText || null,
        toolCalls,
        inputTokens,
        outputTokens,
        finishedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('runAgentRun failed', { runId, err })
    await fail(runId, err instanceof Error ? err.message : String(err), { toolCalls, inputTokens, outputTokens })
  }
}

async function fail(
  runId: string,
  error: string,
  metrics?: { toolCalls?: number; inputTokens?: number; outputTokens?: number },
) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: 'error',
      error: error.slice(0, 2000),
      finishedAt: new Date(),
      ...(metrics?.toolCalls !== undefined && { toolCalls: metrics.toolCalls }),
      ...(metrics?.inputTokens !== undefined && { inputTokens: metrics.inputTokens }),
      ...(metrics?.outputTokens !== undefined && { outputTokens: metrics.outputTokens }),
    },
  }).catch(() => {})
}
