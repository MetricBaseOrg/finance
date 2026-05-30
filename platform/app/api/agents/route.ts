import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRole, getWorkspaceForTask } from '@/lib/permissions'

/**
 * GET /api/agents?taskId=... | ?organizationId=...
 * Returns the enabled agents for a workspace (resolved from a task or org id).
 * Caller must be a member. Used by the task-detail "Ask agent" control.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  let organizationId = searchParams.get('organizationId')
  if (!organizationId && taskId) organizationId = await getWorkspaceForTask(taskId)
  if (!organizationId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const role = await getRole(session.user.id, organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const agents = await prisma.agent.findMany({
    where: { organizationId, enabled: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ agents })
}
