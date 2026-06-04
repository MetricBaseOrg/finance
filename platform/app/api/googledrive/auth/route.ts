import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { buildAuthorizeUrl, isConfigured } from '@/lib/googledrive'
import { randomBytes } from 'crypto'

/**
 * GET /api/googledrive/auth?returnTo=/path
 *
 * Starts the Google Drive OAuth flow (drive.file scope). Stashes a CSRF nonce
 * in a short-lived HttpOnly cookie, then redirects the user to Google.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/signin', req.url))
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Google Drive integration is not configured on this server (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET missing).' },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const returnTo = url.searchParams.get('returnTo') || '/dashboard'

  const nonce = randomBytes(16).toString('base64url')
  const state = `${nonce}.${Buffer.from(returnTo).toString('base64url')}`

  const res = NextResponse.redirect(buildAuthorizeUrl(state))
  res.cookies.set('gdrive_oauth_state', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
  return res
}
