import { prisma } from '@/lib/prisma'
import { ROLES, isRole, can, type Role } from '@/lib/roles'

/**
 * Workspace role model. The pure parts (role list, labels, the capability
 * matrix and `can`) live in lib/roles.ts so they can be imported from client
 * components without dragging Prisma into the browser bundle. This module adds
 * the membership-lookup and invariant helpers that need DB access.
 */

// Re-export the pure role model so existing `@/lib/permissions` imports keep
// working unchanged.
export {
  ROLES,
  isRole,
  ROLE_LEVEL,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  can,
  type Role,
  type Action,
} from '@/lib/roles'

// ── Membership lookup ───────────────────────────────────────────────────────

/**
 * Fetch the current user's role in a workspace, or null if not a member.
 * Defensive against bad role values stored in the DB — anything unrecognized
 * falls back to VIEWER.
 */
export async function getRole(userId: string, organizationId: string): Promise<Role | null> {
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  })
  if (!m) return null
  return isRole(m.role) ? m.role : 'VIEWER'
}

/** Convenience: organizationId by projectId. */
export async function getWorkspaceForProject(projectId: string): Promise<string | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  })
  return p?.organizationId ?? null
}

/** Convenience: organizationId by taskId. */
export async function getWorkspaceForTask(taskId: string): Promise<string | null> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { organizationId: true } } },
  })
  return t?.project.organizationId ?? null
}

// ── Role-management invariants ──────────────────────────────────────────────

/**
 * Validate a proposed role change. Returns null if allowed, or a string
 * error reason if not.
 *
 * Rules:
 *   1. Acting user must be OWNER or ADMIN.
 *   2. ADMINs cannot promote anyone to OWNER (only OWNER can transfer
 *      ownership).
 *   3. ADMINs cannot demote or modify another OWNER.
 *   4. Cannot demote the last remaining OWNER.
 *   5. The target role must be valid.
 */
export async function validateRoleChange(opts: {
  actorRole: Role
  targetCurrentRole: Role
  targetNewRole: string
  organizationId: string
}): Promise<string | null> {
  if (!can(opts.actorRole, 'workspace.member.changeRole')) return 'Not allowed'
  if (!isRole(opts.targetNewRole)) return 'Invalid role'

  // ADMIN cannot promote to OWNER or touch an existing OWNER
  if (opts.actorRole === 'ADMIN') {
    if (opts.targetNewRole === 'OWNER') return 'Only an Owner can transfer ownership'
    if (opts.targetCurrentRole === 'OWNER') return 'Admins cannot modify an Owner'
  }

  // Last-Owner check: can't demote if this is the only OWNER
  if (opts.targetCurrentRole === 'OWNER' && opts.targetNewRole !== 'OWNER') {
    const ownerCount = await prisma.membership.count({
      where: { organizationId: opts.organizationId, role: 'OWNER' },
    })
    if (ownerCount <= 1) return 'A workspace must have at least one Owner'
  }
  return null
}

/**
 * Same constraints for removal: ADMIN can't remove an OWNER, and you can't
 * remove the last OWNER.
 */
export async function validateMemberRemoval(opts: {
  actorRole: Role
  targetRole: Role
  organizationId: string
}): Promise<string | null> {
  if (!can(opts.actorRole, 'workspace.member.remove')) return 'Not allowed'
  if (opts.actorRole === 'ADMIN' && opts.targetRole === 'OWNER') {
    return 'Admins cannot remove an Owner'
  }
  if (opts.targetRole === 'OWNER') {
    const ownerCount = await prisma.membership.count({
      where: { organizationId: opts.organizationId, role: 'OWNER' },
    })
    if (ownerCount <= 1) return 'A workspace must have at least one Owner'
  }
  return null
}
