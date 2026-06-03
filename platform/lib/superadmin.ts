import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { requireUser, type SessionUser } from '@/lib/org'

/**
 * Platform-wide super-admin resolution.
 *
 * A user is a super-admin if their `isSuperAdmin` row flag is true, OR their
 * email is listed in the SUPERADMIN_EMAILS env var (comma-separated). The env
 * allow-list is a bootstrap: it lets the first super-admin sign in and open the
 * /admin panel before any row has the flag set — after that, super-admins are
 * managed from the UI and the env var can be dropped.
 */

function bootstrapEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** True if the email is in the SUPERADMIN_EMAILS bootstrap allow-list. */
export function isBootstrapSuperAdmin(email?: string | null): boolean {
  if (!email) return false
  return bootstrapEmails().includes(email.toLowerCase())
}

/**
 * Resolve whether a user is a super-admin. Pass the row flag when you already
 * have it to avoid a query; otherwise it is fetched.
 */
export async function isSuperAdmin(user: {
  id: string
  email?: string | null
  isSuperAdmin?: boolean
}): Promise<boolean> {
  if (isBootstrapSuperAdmin(user.email)) return true
  if (typeof user.isSuperAdmin === 'boolean') return user.isSuperAdmin
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isSuperAdmin: true, email: true },
  })
  return !!row?.isSuperAdmin || isBootstrapSuperAdmin(row?.email)
}

/**
 * Require an authenticated super-admin. Redirects to /home if the signed-in
 * user is not one. Use at the top of /admin pages.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.isSuperAdmin) redirect('/home')
  return user
}

/**
 * API-route guard: resolves the session and verifies super-admin without
 * redirecting. Returns the user on success, or a ready-to-return NextResponse
 * (401/403) on failure — callers do `if (g instanceof NextResponse) return g`.
 */
export async function requireApiSuperAdmin(): Promise<{ id: string; email: string | null } | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = { id: session.user.id, email: session.user.email ?? null }
  if (!(await isSuperAdmin(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return user
}
