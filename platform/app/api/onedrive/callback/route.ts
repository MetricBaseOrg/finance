import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { completeOAuth } from '@/lib/onedrive'

/**
 * GET /api/onedrive/callback?code=...&state=...
 *
 * Microsoft redirects here after the user consents. We verify the state cookie
 * (CSRF), exchange the code for tokens, persist the MicrosoftAccount row, then
 * bounce the user back to where they came from.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/signin', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') || ''
  const error = url.searchParams.get('error')

  if (error) {
    const desc = url.searchParams.get('error_description') || error
    return NextResponse.redirect(new URL(`/dashboard?onedrive=error&msg=${encodeURIComponent(desc)}`, req.url))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?onedrive=error&msg=missing+code', req.url))
  }

  // Verify state — first chunk is the nonce, second is the base64url returnTo.
  const [nonce, returnToB64] = state.split('.', 2)
  const cookieNonce = req.headers
    .get('cookie')
    ?.split(';').map(c => c.trim())
    .find(c => c.startsWith('onedrive_oauth_state='))
    ?.split('=')[1]

  if (!nonce || !cookieNonce || nonce !== cookieNonce) {
    return NextResponse.redirect(new URL('/dashboard?onedrive=error&msg=invalid+state', req.url))
  }

  let returnTo = '/dashboard'
  try {
    if (returnToB64) returnTo = Buffer.from(returnToB64, 'base64url').toString('utf8')
  } catch {}
  // Only allow same-origin relative paths
  if (!returnTo.startsWith('/')) returnTo = '/dashboard'

  try {
    await completeOAuth(session.user.id, code)
  } catch (err) {
    console.error('OneDrive callback error', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.redirect(new URL(`/dashboard?onedrive=error&msg=${encodeURIComponent(msg)}`, req.url))
  }

  const res = NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}onedrive=connected`, req.url))
  // Clear the state cookie
  res.cookies.set('onedrive_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
