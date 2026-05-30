import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { can, getRole } from '@/lib/permissions'

/**
 * GET /api/tasks/:id/dependencies
 *
 * Returns both sides of the relation for a task:
 *   - blockedBy: tasks that must finish before this one
 *   - blocking : tasks that are waiting on this one
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const access = await assertMember(id, session.user.id)
  if (!access.ok) return access.res

  const [blockedBy, blocking] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { blockedId: id },
      include: {
        blocker: {
          select: {
            id: true, title: true, status: true, priority: true,
            project: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskDependency.findMany({
      where: { blockerId: id },
      include: {
        blocked: {
          select: {
            id: true, title: true, status: true, priority: true,
            project: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return NextResponse.json({ blockedBy, blocking })
}

/**
 * POST /api/tasks/:id/dependencies   body: { blockerId } | { blockedId }
 *
 * - `blockerId` means: "this task is blocked by blockerId"
 * - `blockedId` means: "this task blocks blockedId"
 *
 * Rejects self-loops, duplicates, and direct two-cycles.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: thisId } = await params
  const access = await assertMember(thisId, session.user.id)
  if (!access.ok) return access.res

  const body = await req.json().catch(() => ({}))
  const blockerId: string | undefined = body.blockerId
  const blockedId: string | undefined = body.blockedId
  if (!blockerId && !blockedId) {
    return NextResponse.json({ error: 'blockerId or blockedId required' }, { status: 400 })
  }

  // Normalize to the canonical (blocker, blocked) pair
  const pair = blockerId
    ? { blockerId, blockedId: thisId }
    : { blockerId: thisId, blockedId: blockedId! }

  if (pair.blockerId === pair.blockedId) {
    return NextResponse.json({ error: 'A task cannot block itself' }, { status: 400 })
  }

  // Both tasks must exist in projects the user can see (same workspace)
  const [a, b] = await Promise.all([
    prisma.task.findUnique({
      where: { id: pair.blockerId },
      select: { id: true, projectId: true, project: { select: { organizationId: true } } },
    }),
    prisma.task.findUnique({
      where: { id: pair.blockedId },
      select: { id: true, projectId: true, project: { select: { organizationId: true } } },
    }),
  ])
  if (!a || !b) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (a.project.organizationId !== b.project.organizationId) {
    return NextResponse.json({ error: 'Tasks must be in the same workspace' }, { status: 400 })
  }

  const role = await getRole(session.user.id, a.project.organizationId)
  if (!role || !can(role, 'dependency.manage')) {
    return NextResponse.json({ error: 'Your role does not permit managing dependencies.' }, { status: 403 })
  }

  // Cycle prevention (direct two-cycle): if blocked already blocks blocker, reject.
  const reverse = await prisma.taskDependency.findFirst({
    where: { blockerId: pair.blockedId, blockedId: pair.blockerId },
    select: { id: true },
  })
  if (reverse) {
    return NextResponse.json(
      { error: 'That would create a cycle (the other task already blocks this one).' },
      { status: 409 },
    )
  }

  // Upsert (idempotent on the unique pair)
  let dep
  try {
    dep = await prisma.taskDependency.create({
      data: pair,
      include: {
        blocker: {
          select: { id: true, title: true, status: true, priority: true },
        },
        blocked: {
          select: { id: true, title: true, status: true, priority: true },
        },
      },
    })
  } catch (err) {
    // Unique constraint violation
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Already linked' }, { status: 409 })
    }
    throw err
  }

  // Activity log on both tasks
  void logActivity({
    taskId: pair.blockedId,
    userId: session.user.id,
    kind: 'comment.added',
    metadata: { preview: `now blocked by "${dep.blocker.title}"`, depId: dep.id },
  })
  void logActivity({
    taskId: pair.blockerId,
    userId: session.user.id,
    kind: 'comment.added',
    metadata: { preview: `now blocks "${dep.blocked.title}"`, depId: dep.id },
  })

  return NextResponse.json(dep)
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function assertMember(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      project: {
        select: {
          workspace: { select: { members: { where: { userId }, select: { id: true } } } },
        },
      },
    },
  })
  if (!task) return { ok: false as const, res: NextResponse.json({ error: 'Task not found' }, { status: 404 }) }
  if (task.project.workspace.members.length === 0) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true as const }
}
