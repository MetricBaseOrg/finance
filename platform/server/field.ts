import 'server-only'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'

// Field module request context. Like the finance adapter, the active org is
// resolved from the `mb_org` cookie (set by the global sidebar org switcher).
// Returns null when unauthenticated or no membership — callers return 401/400.

export type FieldContext = {
  userId: string
  organizationId: string
  role: string
}

export async function getFieldContext(): Promise<FieldContext | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = session.user.id

  const cookieStore = await cookies()
  const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  let membership = cookieOrg
    ? await prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId: cookieOrg } },
      })
    : null
  if (!membership) {
    membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  }
  if (!membership) return null

  return { userId, organizationId: membership.organizationId, role: membership.role }
}

const NODE_TYPES = ['well', 'field', 'storage', 'pipeline', 'terminal', 'buyer']
const FLOW_TYPES = ['inflow', 'outflow', 'stock']
const FLOW_STATUS = ['actual', 'estimate', 'plan']
const LIFTING_STATUS = ['tentative', 'active', 'completed', 'cancelled']
const TARGET_CATEGORIES = ['production', 'lifting', 'transfer']

export const FIELD_ENUMS = {
  NODE_TYPES,
  FLOW_TYPES,
  FLOW_STATUS,
  LIFTING_STATUS,
  TARGET_CATEGORIES,
}

// Field audit logging — mirrors finance logAudit but writes module = "field".

type LogFieldAuditInput = {
  organizationId: string
  userId?: string | null
  action: string
  entityType: string
  entityId: string
  summary: string
  metadata?: unknown
}

export async function logFieldAudit(input: LogFieldAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.userId ?? null,
        module: 'field',
        action: input.action,
        entity: input.entityType,
        entityId: input.entityId,
        metadata: input.summary,
      },
    })
  } catch (e) {
    console.error('[field-audit]', e)
  }
}
