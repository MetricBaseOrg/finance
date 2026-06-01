import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { can, isRole, type Action, type Role } from '@/lib/permissions'

// Server-side helpers for the Telegram bot's thin-client API (/api/bot/*).
// The bot authenticates every call with the shared BOT_SERVICE_TOKEN and
// identifies the acting person by their Telegram user id, which we map to a
// platform User (linked via the Settings → Telegram handshake).

const SERVICE_TOKEN = process.env.BOT_SERVICE_TOKEN || ''

/** Constant-time check of the `Authorization: Bearer <BOT_SERVICE_TOKEN>` header. */
export function assertBotToken(req: Request): boolean {
  if (!SERVICE_TOKEN) return false
  const header = req.headers.get('authorization') || ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : header
  const a = Buffer.from(presented)
  const b = Buffer.from(SERVICE_TOKEN)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export type BotActor = {
  user: { id: string; name: string | null; email: string }
  organizationId: string
  organizationName: string
  role: Role
  orgs: { id: string; name: string; role: Role }[]
}

// Single-shape result (the repo runs with strictNullChecks off, so discriminated
// unions don't narrow via `!x.ok` — flat optional fields are the local idiom).
export type ResolveResult = {
  ok: boolean
  actor?: BotActor
  reason?: 'not_linked' | 'no_membership'
}

/**
 * Resolve a linked platform user + their active workspace + role from a
 * Telegram user id. Active workspace = `telegramActiveOrgId` if still a valid
 * membership, else the earliest membership (and we heal the stored value).
 */
export async function resolveBotUser(telegramUserId: bigint | number): Promise<ResolveResult> {
  const tgId = typeof telegramUserId === 'number' ? BigInt(telegramUserId) : telegramUserId
  const user = await prisma.user.findUnique({
    where: { telegramUserId: tgId },
    select: {
      id: true, name: true, email: true, telegramActiveOrgId: true,
      members: {
        orderBy: { createdAt: 'asc' },
        select: { organizationId: true, role: true, organization: { select: { name: true } } },
      },
    },
  })
  if (!user) return { ok: false, reason: 'not_linked' }
  if (user.members.length === 0) return { ok: false, reason: 'no_membership' }

  const orgs = user.members.map((m) => ({
    id: m.organizationId,
    name: m.organization.name,
    role: (isRole(m.role) ? m.role : 'VIEWER') as Role,
  }))

  let active = orgs.find((o) => o.id === user.telegramActiveOrgId) ?? orgs[0]
  // Heal a stale/empty pointer so /workspace stays consistent.
  if (user.telegramActiveOrgId !== active.id) {
    await prisma.user.update({ where: { id: user.id }, data: { telegramActiveOrgId: active.id } })
  }

  return {
    ok: true,
    actor: {
      user: { id: user.id, name: user.name, email: user.email },
      organizationId: active.id,
      organizationName: active.name,
      role: active.role,
      orgs,
    },
  }
}

export type BotAuthResult = {
  ok: boolean
  actor?: BotActor
  body?: Record<string, unknown>
  status?: number
  error?: string
}

/**
 * One-stop guard for /api/bot/* routes: verifies the service token, parses the
 * JSON body, resolves the linked user + active workspace, and (optionally)
 * checks a permission. Returns the actor + parsed body, or an HTTP-shaped error.
 */
export async function authorizeBot(req: Request, action?: Action): Promise<BotAuthResult> {
  if (!assertBotToken(req)) return { ok: false, status: 401, error: 'Unauthorized' }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const raw = body.telegram_user_id ?? body.telegramUserId
  if (raw == null) return { ok: false, status: 400, error: 'telegram_user_id is required' }

  let tgId: bigint
  try {
    tgId = BigInt(raw as string | number)
  } catch {
    return { ok: false, status: 400, error: 'telegram_user_id is invalid' }
  }

  const resolved = await resolveBotUser(tgId)
  if (!resolved.ok) {
    return { ok: false, status: 401, error: resolved.reason }
  }
  if (action && !can(resolved.actor.role, action)) {
    return { ok: false, status: 403, error: 'forbidden' }
  }
  return { ok: true, actor: resolved.actor, body }
}

type BotAuditInput = {
  chatId?: number | bigint | null
  botUserId?: number | bigint | null
  username?: string | null
  fullName?: string | null
  eventType: string
  command?: string | null
  payload?: string | null
  status?: string
  error?: string | null
}

/** Append-only bot interaction log. Best-effort — never throws into a handler. */
export async function logBotAudit(input: BotAuditInput): Promise<void> {
  try {
    await prisma.botAudit.create({
      data: {
        chatId: input.chatId != null ? BigInt(input.chatId) : null,
        botUserId: input.botUserId != null ? BigInt(input.botUserId) : null,
        username: input.username ?? null,
        fullName: input.fullName ?? null,
        eventType: input.eventType,
        command: input.command ?? null,
        payload: input.payload ?? null,
        status: input.status ?? 'ok',
        error: input.error ?? null,
      },
    })
  } catch (e) {
    console.error('[bot-audit]', e)
  }
}
