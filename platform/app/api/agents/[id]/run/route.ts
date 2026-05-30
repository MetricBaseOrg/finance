import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRole } from '@/lib/permissions'
import { runAgentRun } from '@/lib/agent/runtime'

/**
 * POST /api/agents/[id]/run
 * On-demand agent invocation. Body: { taskId?, prompt? }.
 * Caller must be a member of the agent's workspace. Runs synchronously and
 * returns the result so the UI can show it immediately.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const taskId: string | undefined = body?.taskId
  const prompt: string | undefined = body?.prompt

  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { id: true, organizationId: true, enabled: true },
  })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const role = await getRole(session.user.id, agent.organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!agent.enabled) return NextResponse.json({ error: 'Agent is disabled' }, { status: 400 })

  if (taskId) {
    const t = await prisma.task.findUnique({
      where: { id: taskId },
      select: { project: { select: { organizationId: true } } },
    })
    if (t?.project.organizationId !== agent.organizationId) {
      return NextResponse.json({ error: 'Task not found in this workspace' }, { status: 404 })
    }
  }

  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      organizationId: agent.organizationId,
      trigger: 'manual',
      taskId: taskId ?? null,
      prompt: prompt ?? null,
    },
    select: { id: true },
  })

  await runAgentRun(run.id)

  const finished = await prisma.agentRun.findUnique({
    where: { id: run.id },
    select: { status: true, result: true, error: true, toolCalls: true },
  })

  // Don't surface the raw internal error string to the client — it can leak
  // implementation/infra detail. Log it server-side; return a generic message.
  if (finished?.status === 'error') {
    console.error('agent run failed', { runId: run.id, error: finished.error })
  }
  return NextResponse.json({
    runId: run.id,
    status: finished?.status ?? 'error',
    result: finished?.result ?? null,
    toolCalls: finished?.toolCalls ?? 0,
    ...(finished?.status === 'error' && {
      error: 'The agent run failed. Check the agent settings or try again.',
    }),
  })
}
