import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { buildAuthorizeUrl, isConfigured } from '@/lib/onedrive'
import { randomBytes } from 'crypto'

/**
 * GET /api/onedrive/auth?returnTo=/path
 *
 * Starts the OneDrive OAuth flow. Generates a random state, stashes it in a
 * short-lived HttpOnly cookie, then redirects the user to Microsoft.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', process.env.APP_URL || new URL(req.url).origin))
  }
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'OneDrive integration is not configured on this server (MS_CLIENT_ID / MS_CLIENT_SECRET missing).' },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const returnTo = url.searchParams.get('returnTo') || '/dashboard'

  // CSRF protection: state cookie verified at callback. We also pack the
  // returnTo path into the state so it survives the round-trip.
  const nonce = randomBytes(16).toString('base64url')
  const state = `${nonce}.${Buffer.from(returnTo).toString('base64url')}`

  const authorizeUrl = buildAuthorizeUrl(state)
  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set('onedrive_oauth_state', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  return res
}
