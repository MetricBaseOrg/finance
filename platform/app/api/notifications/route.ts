import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/notifications — list the current user's notifications.
 * Query params:
 *   unreadOnly=true to filter to unread
 *   limit=N         (default 50, max 200)
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)

  const [items, unreadCount] = await Promise.all([
    prisma.taskNotification.findMany({
      where: { userId: session.user.id, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.taskNotification.count({ where: { userId: session.user.id, read: false } }),
  ])

  // Hydrate task and actor info so the UI doesn't need a second roundtrip
  const taskIds = [...new Set(items.map(i => i.taskId).filter(Boolean) as string[])]
  const actorIds = [...new Set(items.map(i => i.actorId).filter(Boolean) as string[])]

  const [tasks, actors] = await Promise.all([
    taskIds.length
      ? prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true, project: { select: { id: true, name: true, color: true } } },
        })
      : Promise.resolve([]),
    actorIds.length
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : Promise.resolve([]),
  ])

  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const actorMap = new Map(actors.map(a => [a.id, a]))

  return NextResponse.json({
    notifications: items.map(i => ({
      ...i,
      task: i.taskId ? taskMap.get(i.taskId) : null,
      actor: i.actorId ? actorMap.get(i.actorId) : null,
    })),
    unreadCount,
  })
}

/**
 * PATCH /api/notifications  body: { ids?: string[]; markAllRead?: boolean }
 * Marks the listed notifications (or all of the user's notifications) as read.
 */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, markAllRead } = await req.json()
  const userId = session.user.id

  if (markAllRead) {
    await prisma.taskNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  } else if (Array.isArray(ids) && ids.length > 0) {
    await prisma.taskNotification.updateMany({
      where: { userId, id: { in: ids } },
      data: { read: true },
    })
  }

  return NextResponse.json({ ok: true })
}
