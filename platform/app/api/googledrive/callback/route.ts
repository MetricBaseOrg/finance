import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { completeOAuth } from '@/lib/googledrive'

/**
 * GET /api/googledrive/callback?code=...&state=...
 *
 * Google redirects here after consent. Verifies the state cookie (CSRF),
 * exchanges the code for tokens, persists the GoogleAccount row, then bounces
 * the user back to where they came from.
 */
export async function GET(req: Request) {
  // Redirects must target the PUBLIC origin (APP_URL), not req.url — behind the
  // reverse proxy / tunnel req.url is the internal container host.
  const base = process.env.APP_URL || new URL(req.url).origin

  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/signin', base))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') || ''
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard?gdrive=error&msg=${encodeURIComponent(error)}`, base))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?gdrive=error&msg=missing+code', base))
  }

  const [nonce, returnToB64] = state.split('.', 2)
  const cookieNonce = req.headers
    .get('cookie')
    ?.split(';').map(c => c.trim())
    .find(c => c.startsWith('gdrive_oauth_state='))
    ?.split('=')[1]

  if (!nonce || !cookieNonce || nonce !== cookieNonce) {
    return NextResponse.redirect(new URL('/dashboard?gdrive=error&msg=invalid+state', base))
  }

  let returnTo = '/dashboard'
  try {
    if (returnToB64) returnTo = Buffer.from(returnToB64, 'base64url').toString('utf8')
  } catch {}
  if (!returnTo.startsWith('/')) returnTo = '/dashboard'

  try {
    await completeOAuth(session.user.id, code)
  } catch (err) {
    console.error('Google Drive callback error', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(new URL(`/dashboard?gdrive=error&msg=${encodeURIComponent(msg)}`, base))
  }

  const res = NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}gdrive=connected`, base))
  res.cookies.set('gdrive_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
