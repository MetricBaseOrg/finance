import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createComment } from '@/lib/comments/create'
import { can, getRole, getWorkspaceForTask } from '@/lib/permissions'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, taskId } = await req.json()
  if (!content || !taskId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const userId = session.user.id

  const organizationId = await getWorkspaceForTask(taskId)
  if (!organizationId) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  const role = await getRole(userId, organizationId)
  if (!role || !can(role, 'comment.create')) {
    return NextResponse.json({ error: 'Your role does not permit commenting.' }, { status: 403 })
  }

  // Delegate to the shared service so the HTTP and agent paths stay in lockstep:
  // it logs activity, resolves @mentions, and notifies the assignee on every
  // comment (not only when there's a mention).
  const comment = await createComment({ taskId, actorUserId: userId, content })

  return NextResponse.json(comment)
}
