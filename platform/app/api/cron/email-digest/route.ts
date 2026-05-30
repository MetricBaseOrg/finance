import { NextResponse } from 'next/server'
import { sendDigests } from '@/lib/email'

/**
 * POST /api/cron/email-digest
 *
 * Sends a digest email of unread notifications to every affected user.
 * Intended to run once daily. Protect with the `CRON_SECRET` env var:
 *   - Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 *     when the project has the secret set.
 *   - External schedulers can also pass `?secret=...` for convenience.
 *
 * GET is allowed too so the endpoint can be smoke-tested from a browser when
 * the secret is supplied as a query string.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')
  const header = req.headers.get('authorization') || ''
  const headerSecret = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (querySecret !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const windowMinParam = url.searchParams.get('windowMin')
  const windowMin = windowMinParam ? parseInt(windowMinParam, 10) : 60

  const sent = await sendDigests({ instantWindowMinutes: isFinite(windowMin) ? windowMin : 60 })
  return NextResponse.json({ ok: true, sent })
}

export const GET = handle
export const POST = handle
