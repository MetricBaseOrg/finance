import Anthropic from '@anthropic-ai/sdk'
import { getOrgAnthropic } from './anthropic'

/**
 * Thin wrapper around the Anthropic Messages API. The base URL is overrideable
 * via `ANTHROPIC_BASE_URL` so we can point at the Xiaomi MiMo proxy
 * (https://api.xiaomimimo.com/anthropic) instead of the official endpoint.
 *
 * Every function:
 *   - Uses tool-use with forced tool_choice to get reliable structured output
 *     instead of hoping for valid JSON from prose.
 *   - Caches the system prompt with `cache_control: ephemeral` so repeated
 *     calls in a session are ~90% cheaper (when the proxy supports caching;
 *     unsupported fields are silently ignored).
 */

// Note: direct AI helpers (breakdown/summarize) now prefer per-org config (via resolveAi/getOrgAnthropic)
// falling back to env ANTHROPIC_*. This unifies with agents etc.

// ── Feature 1: break a task into subtasks ────────────────────────────────────

const BREAKDOWN_SYSTEM = `You are a senior project manager helping someone decompose a task into actionable subtasks.

Rules:
- Suggest 3 to 7 subtasks. Fewer is better than padding.
- Each subtask title is one short imperative phrase (max 80 chars), starting with a verb. Examples: "Draft API schema", "Write README", "Set up CI."
- Subtasks should be roughly the same size — each one should be doable in under a day.
- Don't restate the parent task. Don't write meta-instructions ("Begin by…").
- If the parent task is already small/atomic, return fewer subtasks (or zero).
- Output via the submit_subtasks tool. Do not write any other text.`

export async function breakdownTask(params: {
  title: string
  description?: string
  organizationId?: string | null
}): Promise<{ subtasks: string[] }> {
  const ai = await getOrgAnthropic(params.organizationId)
  if (!ai) throw new Error('AI is not configured (no workspace key and ANTHROPIC_API_KEY missing)')

  const c = ai.client
  const model = ai.model

  const userContent = params.description
    ? `Parent task: "${params.title}"\n\nDescription:\n${params.description}`
    : `Parent task: "${params.title}"`

  const response = await c.messages.create({
    model,
    max_tokens: 600,
    system: [
      {
        type: 'text',
        text: BREAKDOWN_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [
      {
        name: 'submit_subtasks',
        description: 'Submit the proposed subtask titles.',
        input_schema: {
          type: 'object',
          properties: {
            subtasks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Imperative-phrase subtask titles, 3–7 items.',
            },
          },
          required: ['subtasks'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_subtasks' },
    messages: [{ role: 'user', content: userContent }],
  })

  const block = response.content.find(b => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined
  if (!block) throw new Error('AI returned no tool_use block')
  const parsed = block.input as { subtasks?: unknown }
  if (!Array.isArray(parsed.subtasks)) {
    throw new Error('AI returned no subtasks array')
  }
  const subtasks = parsed.subtasks
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map(s => s.trim().slice(0, 200))
  return { subtasks }
}

// ── Feature 2: summarize a comment thread ────────────────────────────────────

const SUMMARIZE_SYSTEM = `You are summarizing a comment thread on a project-management task. The audience is a teammate catching up.

Rules:
- Output three lists via the submit_summary tool:
    1. tldr           — 2-4 short bullets capturing the substance of the conversation
    2. openQuestions  — unresolved questions, blocking issues, requests waiting on someone
    3. decisions      — concrete agreements / conclusions that have been reached
- Use the participants' names where helpful ("Bun proposed…", "Arief asked…").
- Each bullet ≤ 120 chars. Be concrete; quote short phrases when useful.
- Lists may be empty if there's nothing to put in them — don't invent items.
- Do not include preamble or commentary outside the tool call.`

export async function summarizeComments(params: {
  taskTitle: string
  comments: Array<{ author: string; createdAt: string; content: string }>
  organizationId?: string | null
}): Promise<{ tldr: string[]; openQuestions: string[]; decisions: string[] }> {
  const ai = await getOrgAnthropic(params.organizationId)
  if (!ai) throw new Error('AI is not configured (no workspace key and ANTHROPIC_API_KEY missing)')

  const c = ai.client
  const model = ai.model

  // Render the thread as a plain transcript
  const transcript = params.comments.map(c2 =>
    `[${c2.createdAt}] ${c2.author}:\n${c2.content}`
  ).join('\n\n')

  const userContent = `Task: "${params.taskTitle}"\n\nThread:\n\n${transcript}`

  const response = await c.messages.create({
    model,
    max_tokens: 700,
    system: [
      {
        type: 'text',
        text: SUMMARIZE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [
      {
        name: 'submit_summary',
        description: 'Submit the structured summary of the thread.',
        input_schema: {
          type: 'object',
          properties: {
            tldr: { type: 'array', items: { type: 'string' } },
            openQuestions: { type: 'array', items: { type: 'string' } },
            decisions: { type: 'array', items: { type: 'string' } },
          },
          required: ['tldr', 'openQuestions', 'decisions'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_summary' },
    messages: [{ role: 'user', content: userContent }],
  })

  const block = response.content.find(b => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined
  if (!block) throw new Error('AI returned no tool_use block')
  const parsed = block.input as {
    tldr?: unknown; openQuestions?: unknown; decisions?: unknown
  }
  const clean = (x: unknown): string[] =>
    Array.isArray(x)
      ? x.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : []
  return {
    tldr: clean(parsed.tldr),
    openQuestions: clean(parsed.openQuestions),
    decisions: clean(parsed.decisions),
  }
}
