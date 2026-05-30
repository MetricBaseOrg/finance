import type { AgentTool, ToolContext } from '@/lib/agent/types'
import { taskTools } from '@/lib/agent/tools/tasks'
import { chatTools } from '@/lib/agent/tools/chat'
import { financeTools } from '@/lib/agent/tools/finance'
import { fieldTools } from '@/lib/agent/tools/field'

const ALL_TOOLS: AgentTool[] = [...taskTools, ...chatTools, ...financeTools, ...fieldTools]

/** Tools available to an agent, filtered by its enabled scopes. */
export function toolsForScopes(scopes: string[]): AgentTool[] {
  const set = new Set(scopes)
  return ALL_TOOLS.filter(t => set.has(t.scope))
}

/** Anthropic tool definitions for a tool set. */
export function toolDefinitions(tools: AgentTool[]) {
  return tools.map(t => t.definition)
}

/** Execute one tool call by name, returning a JSON-serializable result. */
export async function executeTool(
  tools: AgentTool[],
  ctx: ToolContext,
  name: string,
  input: unknown,
): Promise<unknown> {
  const tool = tools.find(t => t.definition.name === name)
  if (!tool) return { error: `Unknown tool: ${name}` }
  try {
    return await tool.execute(ctx, input)
  } catch (err) {
    console.error('agent tool failed', { name, err })
    return { error: 'Tool execution failed.', detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Tool names that post a message directly (so the runtime won't double-post the final text). */
export const DIRECT_POST_TOOLS = new Set(['post_comment', 'post_chat_message'])
