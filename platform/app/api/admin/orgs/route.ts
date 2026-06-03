import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiSuperAdmin } from '@/lib/superadmin'

/** GET /api/admin/orgs — all organizations with member counts (super-admin). */
export async function GET() {
  const guard = await requireApiSuperAdmin()
  if (guard instanceof NextResponse) return guard

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  })

  return NextResponse.json(
    orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      color: o.color,
      createdAt: o.createdAt,
      memberCount: o._count.members,
    })),
  )
}
