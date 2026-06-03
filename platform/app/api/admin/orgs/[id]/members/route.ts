import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiSuperAdmin } from '@/lib/superadmin'

/**
 * GET /api/admin/orgs/:id/members — members of one org with role + appAccess.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiSuperAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  })
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await prisma.membership.findMany({
    where: { organizationId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      appAccess: true,
      trialEndsAt: true,
      user: { select: { id: true, name: true, email: true, image: true, status: true } },
    },
  })

  return NextResponse.json({ org, members })
}
