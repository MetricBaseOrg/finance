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

// Shared flow-create logic, reused by the cookie-authed REST route
// (app/api/field/flows) and the Telegram bot route (app/api/bot/flow).
// Returns a typed result so callers can map to HTTP / chat responses.

// Flat result shape (repo runs strictNullChecks off — see EngineResult).
export type CreateFlowResult = {
  ok: boolean
  flow?: Awaited<ReturnType<typeof prisma.flow.create>>
  status?: number
  error?: string
}

export async function createFlow(
  actor: { organizationId: string; userId?: string | null },
  body: Record<string, unknown>,
): Promise<CreateFlowResult> {
  const nodeId = String(body.nodeId ?? '')
  const date = String(body.date ?? '').slice(0, 10)
  const flowType = String(body.flowType ?? '').trim().toLowerCase()
  const volume = Number(body.volume)

  if (!nodeId || !date) return { ok: false, status: 400, error: 'nodeId and date are required' }
  if (!FIELD_ENUMS.FLOW_TYPES.includes(flowType)) {
    return { ok: false, status: 400, error: `flowType must be one of ${FIELD_ENUMS.FLOW_TYPES.join(', ')}` }
  }
  if (!Number.isFinite(volume)) return { ok: false, status: 400, error: 'volume must be a number' }

  // Verify node belongs to the org.
  const node = await prisma.node.findFirst({ where: { id: nodeId, organizationId: actor.organizationId } })
  if (!node) return { ok: false, status: 400, error: 'Unknown node' }

  const status = FIELD_ENUMS.FLOW_STATUS.includes(body.status as string) ? (body.status as string) : 'actual'
  const flow = await prisma.flow.create({
    data: {
      organizationId: actor.organizationId,
      nodeId,
      date,
      flowType,
      volume,
      swPct: body.swPct != null ? Number(body.swPct) : null,
      category: body.category ? String(body.category) : null,
      status,
      memo: body.memo ? String(body.memo) : null,
      reportedBy: body.reportedBy ? String(body.reportedBy) : null,
    },
  })
  await logFieldAudit({
    organizationId: actor.organizationId, userId: actor.userId,
    action: 'CREATE', entityType: 'FLOW', entityId: flow.id, summary: `Logged ${flow.flowType} ${flow.volume} on ${flow.date}`,
  })
  return { ok: true, flow }
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
