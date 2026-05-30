import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@/app/generated/prisma/client'
import { auth } from '@/auth'
import { db } from '@/server/db'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'

// Finance module org-context adapter. The platform resolves the active
// organization from the `mb_org` cookie (set by the sidebar org switcher),
// not from a URL slug. Ported finance code calls `requireMembership(slug)` —
// the slug argument is accepted but ignored; the active org wins.
//
// The returned object keeps the field name `workspace` (now an Organization)
// so the large body of ported finance code that reads `workspace.id`,
// `workspace.baseCurrency`, `workspace.slug`, etc. keeps working unchanged.

export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  return session.user
}

async function resolveActiveOrgId(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  if (cookieOrg) {
    const m = await db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: cookieOrg } },
    })
    if (m) return cookieOrg
  }
  const first = await db.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  return first?.organizationId ?? null
}

export async function getCurrentUserWorkspaces() {
  const user = await requireUser()
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { organization: { createdAt: 'asc' } },
  })
  // Alias `organization` → `workspace` for ported callers.
  return memberships.map((m) => ({ ...m, workspace: m.organization }))
}

export async function requireMembership(
  slug?: string,
  requiredRole?: 'ADMIN' | 'MEMBER',
) {
  const user = await requireUser()

  // Finance routes carry the org slug in the URL (/finance/<slug>/...). When
  // present it wins; otherwise fall back to the active-org cookie.
  const workspace = slug
    ? await db.organization.findUnique({ where: { slug } })
    : await (async () => {
        const orgId = await resolveActiveOrgId(user.id)
        return orgId ? db.organization.findUnique({ where: { id: orgId } }) : null
      })()
  if (!workspace) redirect('/welcome')

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId: workspace.id },
    },
  })
  if (!membership) redirect('/welcome')

  if (requiredRole && membership.role !== requiredRole) {
    redirect(`/finance/${workspace.slug}/dashboard`)
  }

  return { user, workspace, membership }
}

export async function requireRole(slug: string | undefined, allowed: Role[]) {
  const ctx = await requireMembership(slug)
  if (!allowed.includes(ctx.membership.role)) {
    redirect(`/finance/${ctx.workspace.slug}/dashboard`)
  }
  return ctx
}

// True when the membership is the org's only OWNER, so callers can block
// downgrades/removals that would orphan it.
export async function isSoleOwner(
  organizationId: string,
  membershipId: string,
): Promise<boolean> {
  const m = await db.membership.findUnique({ where: { id: membershipId } })
  if (!m || m.organizationId !== organizationId || m.role !== 'OWNER') return false
  const ownerCount = await db.membership.count({
    where: { organizationId, role: 'OWNER' },
  })
  return ownerCount <= 1
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'workspace'
}
