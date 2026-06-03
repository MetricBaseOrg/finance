/**
 * Pure role model — no DB imports, safe to import from client components.
 * The membership-lookup and invariant helpers (which need Prisma) live in
 * lib/permissions.ts and re-export these.
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
