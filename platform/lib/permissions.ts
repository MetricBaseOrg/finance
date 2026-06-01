import { prisma } from '@/lib/prisma'

/**
 * Workspace role model. The `role` column on Membership is a free-form
 * String in the schema (SQLite has no enums) — this module is the source of
 * truth for which values are allowed and what each role can do.
 */

export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const
export type Role = typeof ROLES[number]

export function isRole(s: unknown): s is Role {
  return typeof s === 'string' && (ROLES as readonly string[]).includes(s)
}

/** Higher number = more authority. */
export const ROLE_LEVEL: Record<Role, number> = {
  OWNER:  3,
  ADMIN:  2,
  MEMBER: 1,
  VIEWER: 0,
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER:  'Owner',
  ADMIN:  'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER:  'Full control including deleting the workspace.',
  ADMIN:  'Manage members and everything content-wise except deleting the workspace.',
  MEMBER: 'Create and edit projects and tasks, comment, attach files.',
  VIEWER: 'Read-only access to everything in the workspace.',
}

// ── Action surface ──────────────────────────────────────────────────────────

/** Every capability the permission system gates on. */
export type Action =
  | 'workspace.update' | 'workspace.delete'
  | 'workspace.member.invite' | 'workspace.member.remove' | 'workspace.member.changeRole'
  | 'project.create' | 'project.update' | 'project.delete'
  | 'task.create' | 'task.update' | 'task.delete'
  | 'comment.create' | 'comment.delete'
  | 'attachment.upload' | 'attachment.delete'
  | 'label.manage' | 'milestone.manage'
  | 'dependency.manage'
  | 'chat.send' | 'chat.read' | 'chat.channel.manage'
  | 'field.read' | 'field.write' | 'field.manage'

const MATRIX: Record<Action, Role[]> = {
  'workspace.update':              ['OWNER', 'ADMIN'],
  'workspace.delete':              ['OWNER'],
  'workspace.member.invite':       ['OWNER', 'ADMIN'],
  'workspace.member.remove':       ['OWNER', 'ADMIN'],
  'workspace.member.changeRole':   ['OWNER', 'ADMIN'],
  'project.create':                ['OWNER', 'ADMIN', 'MEMBER'],
  'project.update':                ['OWNER', 'ADMIN', 'MEMBER'],
  'project.delete':                ['OWNER', 'ADMIN'],
  'task.create':                   ['OWNER', 'ADMIN', 'MEMBER'],
  'task.update':                   ['OWNER', 'ADMIN', 'MEMBER'],
  'task.delete':                   ['OWNER', 'ADMIN', 'MEMBER'],
  'comment.create':                ['OWNER', 'ADMIN', 'MEMBER'],
  'comment.delete':                ['OWNER', 'ADMIN', 'MEMBER'],
  'attachment.upload':             ['OWNER', 'ADMIN', 'MEMBER'],
  'attachment.delete':             ['OWNER', 'ADMIN', 'MEMBER'],
  'label.manage':                  ['OWNER', 'ADMIN', 'MEMBER'],
  'milestone.manage':              ['OWNER', 'ADMIN', 'MEMBER'],
  'dependency.manage':             ['OWNER', 'ADMIN', 'MEMBER'],
  'chat.send':                     ['OWNER', 'ADMIN', 'MEMBER'],
  'chat.read':                     ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'chat.channel.manage':           ['OWNER', 'ADMIN'],
  // Field ops (FieldFlow + Telegram bot): viewers read reports/recap/lifting;
  // members add/edit/delete records; admins/owners manage config (targets, etc.).
  'field.read':                    ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'field.write':                   ['OWNER', 'ADMIN', 'MEMBER'],
  'field.manage':                  ['OWNER', 'ADMIN'],
}

/** Pure predicate. Does this role permit this action? */
export function can(role: Role, action: Action): boolean {
  return MATRIX[action].includes(role)
}

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
