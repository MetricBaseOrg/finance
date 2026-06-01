'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { requireUser } from '@/server/workspace'

// Settings → Telegram linking. A user generates a one-time code here; the bot
// redeems it via /api/bot/link after the user sends /start <code>. We never let
// a user type a raw Telegram id (that would be trivially spoofable) — ownership
// is proven by the round-trip through the bot.

const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || ''

export type TelegramLinkState = {
  error?: string
  code?: string
  deepLink?: string
}

/** Generate (or replace) a one-time link code and return the bot deep link. */
export async function generateTelegramLink(): Promise<TelegramLinkState> {
  const user = await requireUser()
  if (!BOT_USERNAME) {
    return { error: 'Telegram bot is not configured yet. Ask an admin to set TELEGRAM_BOT_USERNAME.' }
  }

  // base32-ish, no ambiguous chars — short enough to type, long enough to be unguessable.
  const code = randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, 10).toUpperCase()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  // One pending code per user: clear old ones first.
  await db.telegramLinkToken.deleteMany({ where: { userId: user.id } })
  await db.telegramLinkToken.create({ data: { code, userId: user.id, expiresAt } })

  return { code, deepLink: `https://t.me/${BOT_USERNAME}?start=${code}` }
}

/** Unlink the Telegram account from the signed-in user. */
export async function disconnectTelegram(): Promise<{ ok: boolean }> {
  const user = await requireUser()
  await db.user.update({
    where: { id: user.id },
    data: {
      telegramUserId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramActiveOrgId: null,
    },
  })
  await db.telegramLinkToken.deleteMany({ where: { userId: user.id } })
  revalidatePath('/settings')
  return { ok: true }
}
