import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertBotToken, logBotAudit } from '@/server/bot'

export const dynamic = 'force-dynamic'

// Redeem a one-time code (from Settings → Telegram) and bind this Telegram user
// to the platform account. No prior link required — this is how linking starts.
export async function POST(req: NextRequest) {
  if (!assertBotToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim().toUpperCase()
  const rawId = body.telegram_user_id ?? body.telegramUserId
  const username = body.username ? String(body.username) : null
  const fullName = body.full_name ? String(body.full_name) : null
  const chatId = body.chat_id ?? body.chatId ?? null

  if (!code || rawId == null) {
    return NextResponse.json({ error: 'code and telegram_user_id are required' }, { status: 400 })
  }

  let tgId: bigint
  try { tgId = BigInt(rawId) } catch { return NextResponse.json({ error: 'invalid telegram_user_id' }, { status: 400 }) }

  const token = await prisma.telegramLinkToken.findUnique({
    where: { code },
    include: { user: { select: { id: true, name: true, members: { orderBy: { createdAt: 'asc' }, take: 1, select: { organizationId: true, organization: { select: { name: true } } } } } } },
  })
  if (!token || token.expiresAt < new Date()) {
    await logBotAudit({ botUserId: tgId, chatId, username, fullName, eventType: 'link', command: '/start', status: 'error', error: 'invalid_or_expired_code' })
    return NextResponse.json({ error: 'This code is invalid or has expired. Generate a new one in Settings.' }, { status: 400 })
  }

  const defaultOrg = token.user.members[0]?.organizationId ?? null

  // A Telegram id can only be linked to one account: release it from any other
  // user first, then bind to the code's owner.
  await prisma.user.updateMany({ where: { telegramUserId: tgId }, data: { telegramUserId: null, telegramUsername: null, telegramLinkedAt: null, telegramActiveOrgId: null } })
  await prisma.user.update({
    where: { id: token.userId },
    data: { telegramUserId: tgId, telegramUsername: username, telegramLinkedAt: new Date(), telegramActiveOrgId: defaultOrg },
  })
  await prisma.telegramLinkToken.deleteMany({ where: { userId: token.userId } })

  await logBotAudit({ botUserId: tgId, chatId, username, fullName, eventType: 'link', command: '/start', status: 'ok' })

  return NextResponse.json({
    ok: true,
    name: token.user.name,
    workspace: token.user.members[0]?.organization.name ?? null,
  })
}
