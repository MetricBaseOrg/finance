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
  const userId = session.user.id

  const [taskItems, generalItems, unreadCount] = await Promise.all([
    prisma.taskNotification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { readAt: null }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    Promise.all([
      prisma.taskNotification.count({ where: { userId, read: false } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]).then(([a, b]) => a + b),
  ])

  const taskNotifications = taskItems.map((i) => ({
    id: i.id,
    kind: i.kind,
    taskId: i.taskId,
    commentId: i.commentId,
    actorId: i.actorId,
    metadata: i.metadata,
    read: i.read,
    createdAt: i.createdAt.toISOString(),
    module: 'projects' as const,
    href: null as string | null,
  }))

  const generalNotifications = generalItems.map((i) => ({
    id: i.id,
    kind: `${i.module}.notification`,
    taskId: i.taskId,
    commentId: i.commentId,
    actorId: i.actorId,
    metadata: JSON.stringify({ title: i.title, body: i.body }),
    read: i.readAt !== null,
    createdAt: i.createdAt.toISOString(),
    module: i.module,
    href: i.href,
  }))

  const items = [...taskNotifications, ...generalNotifications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)

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
 */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, markAllRead } = await req.json()
  const userId = session.user.id

  if (markAllRead) {
    await Promise.all([
      prisma.taskNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      }),
      prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      }),
    ])
  } else if (Array.isArray(ids) && ids.length > 0) {
    await Promise.all([
      prisma.taskNotification.updateMany({
        where: { userId, id: { in: ids } },
        data: { read: true },
      }),
      prisma.notification.updateMany({
        where: { userId, id: { in: ids } },
        data: { readAt: new Date() },
      }),
    ])
  }

  return NextResponse.json({ ok: true })
}
