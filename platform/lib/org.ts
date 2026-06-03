import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/app/generated/prisma/client'
import { canAccessApp, type AppAccessId } from '@/lib/apps'

export const ACTIVE_ORG_COOKIE = 'mb_org'

// Bootstrap super-admins by email (parsed inline to avoid a circular import
// with lib/superadmin.ts, which depends on this module).
function bootstrapSuperAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export type SessionUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  /** Platform-wide super-admin (DB flag or SUPERADMIN_EMAILS bootstrap). */
  isSuperAdmin: boolean
}

export type OrgSummary = {
  id: string
  slug: string
  name: string
  role: Role
  /** Per-app grants for this membership (post-trial; empty = none). */
  appAccess: string[]
  /** Trial expiry as ISO string, or null. While active, all apps are unlocked. */
  trialEndsAt: string | null
}

/** Require an authenticated session or redirect to sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  // Always read name/image from DB so stale JWTs (e.g. after OAuth link
  // adds a Google profile photo) reflect the current row immediately.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, image: true, status: true, isSuperAdmin: true },
  })
  // Suspended accounts are bounced even on a still-valid OAuth/magic-link
  // session (the credentials provider already rejects them at sign-in).
  if (dbUser?.status === 'SUSPENDED') redirect('/auth/signin?suspended=1')
  const email = session.user.email ?? ''
  return {
    id: session.user.id,
    name: dbUser?.name ?? session.user.name ?? null,
    email,
    image: dbUser?.image ?? session.user.image ?? null,
    isSuperAdmin: !!dbUser?.isSuperAdmin || bootstrapSuperAdminEmails().includes(email.toLowerCase()),
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
    appAccess: m.appAccess,
    trialEndsAt: m.trialEndsAt ? m.trialEndsAt.toISOString() : null,
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

/**
 * Server guard for an app section: resolve org context and redirect to the
 * "access needed" screen when the active membership can't open this app
 * (trial expired and not granted). Returns the context so callers can reuse
 * it. Defense-in-depth behind the UI hiding.
 */
export async function requireAppAccess(app: AppAccessId) {
  const ctx = await getOrgContext()
  const allowed = canAccessApp(app, {
    appAccess: ctx.activeOrg.appAccess,
    trialEndsAt: ctx.activeOrg.trialEndsAt,
    isSuperAdmin: ctx.user.isSuperAdmin,
  })
  if (!allowed) redirect(`/access?app=${app}`)
  return ctx
}
