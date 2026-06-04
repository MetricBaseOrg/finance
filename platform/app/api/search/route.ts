import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/search?q=foo
 *
 * Returns up to 30 mixed results across tasks, projects, and workspaces that
 * the current user can see. Postgres `contains` matching with case-insensitive
 * mode is good enough for now; we'd switch to full-text search to scale.
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
  // Postgres `contains` is case-SENSITIVE by default, so every filter below uses
  // `mode: 'insensitive'` to match keywords regardless of capitalisation.
  const q = qRaw
  const insensitive = { contains: q, mode: 'insensitive' as const }
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
          { title: insensitive },
          { description: insensitive },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        parentId: true,
        parent: { select: { id: true, title: true } },
        project: { select: { id: true, name: true, color: true } },
      },
      take: 12,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.project.findMany({
      where: {
        organizationId: { in: organizationIds },
        OR: [
          { name: insensitive },
          { description: insensitive },
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
          { name: insensitive },
          { description: insensitive },
        ],
      },
      select: { id: true, name: true, color: true, slug: true },
      take: 4,
    }),
  ])

  return NextResponse.json({ tasks, projects, workspaces })
}
