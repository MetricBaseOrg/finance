import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/app/generated/prisma/client'

export const ACTIVE_ORG_COOKIE = 'mb_org'

export type SessionUser = {
  id: string
  name: string | null
  email: string
  image: string | null
}

export type OrgSummary = {
  id: string
  slug: string
  name: string
  role: Role
}

/** Require an authenticated session or redirect to sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  // Always read name/image from DB so stale JWTs (e.g. after OAuth link
  // adds a Google profile photo) reflect the current row immediately.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, image: true },
  })
  return {
    id: session.user.id,
    name: dbUser?.name ?? session.user.name ?? null,
    email: session.user.email ?? '',
    image: dbUser?.image ?? session.user.image ?? null,
  }
}

/** All organizations the user belongs to, with their role in each. */
export async function getMemberships(userId: string): Promise<OrgSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
  return memberships.map((m) => ({
    id: m.organization.id,
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role,
  }))
}

/**
 * Resolve the active org context for the current request: session user, the
 * list of orgs they belong to, and the selected one (cookie, else first).
 * Redirects to /welcome when the user has no org yet.
 */
export async function getOrgContext() {
  const user = await requireUser()
  const orgs = await getMemberships(user.id)
  if (orgs.length === 0) redirect('/welcome')

  const cookieStore = await cookies()
  const selectedId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  const activeOrg = orgs.find((o) => o.id === selectedId) ?? orgs[0]

  return { user, orgs, activeOrg }
}
