import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/search?q=foo
 *
 * Returns up to 30 mixed results across tasks, projects, and workspaces that
 * the current user can see. SQLite LIKE matching is good enough for now; for
 * Neon/Postgres we'd switch to full-text search.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const qRaw = searchParams.get('q')?.trim() ?? ''
  if (qRaw.length < 1) {
    return NextResponse.json({ tasks: [], projects: [], workspaces: [] })
  }
  // SQLite LIKE is case-insensitive for ASCII by default; we add wildcards.
  const q = qRaw
  const userId = session.user.id

  // Workspaces the user is a member of — used to scope projects/tasks.
  const memberWorkspaces = await prisma.membership.findMany({
    where: { userId },
    select: { organizationId: true },
  })
  const organizationIds = memberWorkspaces.map(m => m.organizationId)
  if (organizationIds.length === 0) {
    return NextResponse.json({ tasks: [], projects: [], workspaces: [] })
  }

  const [tasks, projects, workspaces] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: { organizationId: { in: organizationIds } },
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { id: true, name: true, color: true } },
      },
      take: 12,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.project.findMany({
      where: {
        organizationId: { in: organizationIds },
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        _count: { select: { tasks: true } },
      },
      take: 6,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.organization.findMany({
      where: {
        id: { in: organizationIds },
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, color: true, slug: true },
      take: 4,
    }),
  ])

  return NextResponse.json({ tasks, projects, workspaces })
}
