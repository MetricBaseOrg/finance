import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiSuperAdmin } from '@/lib/superadmin'

/**
 * GET /api/admin/users?q=  — platform-wide user directory (super-admin only).
 * Returns each user with their org memberships (name + role) and last activity.
 */
export async function GET(req: Request) {
  const guard = await requireApiSuperAdmin()
  if (guard instanceof NextResponse) return guard

  const q = new URL(req.url).searchParams.get('q')?.trim()
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      kind: true,
      status: true,
      isSuperAdmin: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          role: true,
          appAccess: true,
          trialEndsAt: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  })

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      kind: u.kind,
      status: u.status,
      isSuperAdmin: u.isSuperAdmin,
      createdAt: u.createdAt,
      lastActiveAt: u.activities[0]?.createdAt ?? null,
      memberships: u.members.map((m) => ({
        id: m.id,
        role: m.role,
        appAccess: m.appAccess,
        trialEndsAt: m.trialEndsAt,
        org: m.organization,
      })),
    })),
  )
}
