import type { Role } from '@/app/generated/prisma/client'

/** Identity + scope an agent's tool calls execute under. */
export type ToolContext = {
  agentUserId: string
  organizationId: string
  agentRole: Role
  agentName: string
}

export type ToolDef = {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type AgentTool = {
  /** Tool groups this tool belongs to — gated by Agent.scopes. */
  scope: 'tasks' | 'finance' | 'field' | 'chat'
  definition: ToolDef
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (ctx: ToolContext, input: any) => Promise<unknown>
}
