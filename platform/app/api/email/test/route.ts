import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

/**
 * POST /api/email/test
 *
 * Sends a single plain test email and returns the *raw* Resend result so the
 * caller can see what's actually going wrong. Used to verify the email pipeline
 * end-to-end (API key valid, domain verified, From address allowed, etc.)
 * without constructing an @mention / assignment flow.
 *
 * Body (all optional):
 *   { to?: string, subject?: string }
 *
 * Defaults: `to` is the signed-in user's email, `subject` is "ProBase test email".
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      error: 'RESEND_API_KEY is blank — email is disabled.',
    }, { status: 503 })
  }
  if (!from) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      error: 'EMAIL_FROM is blank — set it in .env.',
    }, { status: 503 })
  }

  const body = await req.json().catch(() => ({} as { to?: string; subject?: string }))

  // Default recipient = the signed-in user's own email
  let to = body.to
  if (!to) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })
    to = me?.email || undefined
  }
  if (!to) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      error: 'No recipient — pass { "to": "..." } or set the user account email.',
    }, { status: 400 })
  }

  const subject = body.subject || 'ProBase test email'
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 24px auto;">
      <h2 style="color:#0f172a;margin:0 0 12px">ProBase — email pipeline works ✅</h2>
      <p style="color:#374151;line-height:1.55;">
        If you're seeing this, your <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code>,
        and the verified-sender domain are all wired correctly. ProBase will
        now deliver instant emails on <code>@mention</code> / <code>task.assigned</code> /
        <code>comment.added</code>, plus a daily digest of everything else.
      </p>
      <p style="color:#6b7280;font-size:12px;">Sent at ${new Date().toISOString()}.</p>
    </div>
  `
  const text = `ProBase test email — pipeline works.\n\nSent at ${new Date().toISOString()}.`

  // Use Resend directly (rather than lib/email.ts) so we can surface the full
  // error payload to the caller for diagnosis.
  const resend = new Resend(apiKey)
  try {
    const result = await resend.emails.send({ from, to, subject, html, text })
    if (result.error) {
      return NextResponse.json({
        ok: false,
        stage: 'resend',
        to,
        from,
        error: result.error,
      }, { status: 502 })
    }
    return NextResponse.json({ ok: true, to, from, id: result.data?.id })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      stage: 'exception',
      to,
      from,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 502 })
  }
}
