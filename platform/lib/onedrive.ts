import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/crypto'

/**
 * Microsoft Graph (OneDrive Personal) client.
 *
 * Auth: delegated OAuth2 against the "consumers" tenant (personal Microsoft
 * accounts only — outlook.com, live.com, hotmail.com). Refresh tokens are
 * AES-GCM-encrypted at rest; access tokens are cached in the DB and refreshed
 * lazily when they're within 60 seconds of expiry.
 *
 * Upload strategy: simple PUT to the item path (<= 4 MB). Files over 4 MB are
 * rejected at the API boundary.
 */

const MS_AUTHORITY = 'https://login.microsoftonline.com/consumers'
const GRAPH = 'https://graph.microsoft.com/v1.0'

export const ONEDRIVE_SCOPES = ['Files.ReadWrite', 'User.Read', 'offline_access'].join(' ')
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024 // 4 MB

function env() {
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  const redirectUri = process.env.MS_REDIRECT_URI
    || `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/onedrive/callback`
  return { clientId, clientSecret, redirectUri }
}

export function isConfigured(): boolean {
  const { clientId, clientSecret } = env()
  return Boolean(clientId && clientSecret)
}

/** Returns the URL to redirect the user to in order to start the OAuth flow. */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = env()
  if (!clientId) throw new Error('MS_CLIENT_ID not set')
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: ONEDRIVE_SCOPES,
    state,
    prompt: 'select_account',
  })
  return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
  id_token?: string
}

async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = env()
  if (!clientId || !clientSecret) throw new Error('Microsoft client credentials not configured')
  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      ...body,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }
  return res.json()
}

/**
 * Exchange the authorization code returned by Microsoft for tokens, then upsert
 * the MicrosoftAccount row. Returns the persisted row.
 */
export async function completeOAuth(userId: string, code: string) {
  const token = await exchangeToken({
    grant_type: 'authorization_code',
    code,
    scope: ONEDRIVE_SCOPES,
  })
  if (!token.refresh_token) {
    throw new Error('No refresh token returned — did you include the offline_access scope?')
  }

  // Fetch profile so we can store display name + email + msUserId
  const profile = await fetch(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then(r => r.json()) as { id: string; displayName?: string; mail?: string; userPrincipalName?: string }

  const expiresAt = new Date(Date.now() + (token.expires_in - 60) * 1000)
  return prisma.microsoftAccount.upsert({
    where: { userId },
    create: {
      userId,
      msUserId: profile.id,
      displayName: profile.displayName || null,
      email: profile.mail || profile.userPrincipalName || null,
      refreshTokenEnc: encryptToken(token.refresh_token),
      accessToken: token.access_token,
      accessTokenExpiry: expiresAt,
      scope: token.scope || ONEDRIVE_SCOPES,
    },
    update: {
      msUserId: profile.id,
      displayName: profile.displayName || null,
      email: profile.mail || profile.userPrincipalName || null,
      refreshTokenEnc: encryptToken(token.refresh_token),
      accessToken: token.access_token,
      accessTokenExpiry: expiresAt,
      scope: token.scope || ONEDRIVE_SCOPES,
    },
  })
}

/**
 * Returns a valid access token for the given user, refreshing if it's missing
 * or within 60 seconds of expiry. Throws if the user hasn't connected OneDrive.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const acct = await prisma.microsoftAccount.findUnique({ where: { userId } })
  if (!acct) throw new Error('OneDrive not connected for this user')

  const now = Date.now()
  if (acct.accessToken && acct.accessTokenExpiry && acct.accessTokenExpiry.getTime() > now + 60_000) {
    return acct.accessToken
  }

  // Refresh
  const refreshToken = decryptToken(acct.refreshTokenEnc)
  const token = await exchangeToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: ONEDRIVE_SCOPES,
  })
  const newExpiry = new Date(now + (token.expires_in - 60) * 1000)

  await prisma.microsoftAccount.update({
    where: { userId },
    data: {
      accessToken: token.access_token,
      accessTokenExpiry: newExpiry,
      // Microsoft may rotate the refresh token; persist if returned
      ...(token.refresh_token && { refreshTokenEnc: encryptToken(token.refresh_token) }),
    },
  })
  return token.access_token
}

/**
 * Upload a file to `/Apps/ProBase/<taskId>/<filename>` in the user's OneDrive.
 * Caller is responsible for enforcing the 4 MB ceiling — this function does
 * a simple PUT and Graph returns 413 for oversized payloads.
 */
export async function uploadFile(opts: {
  userId: string
  taskId: string
  filename: string
  mimeType: string
  body: Buffer | Uint8Array
}): Promise<{ id: string; name: string; size: number; thumbnailUrl?: string }> {
  const token = await getAccessToken(opts.userId)
  const path = `Apps/ProBase/${opts.taskId}/${encodeURIComponent(safeName(opts.filename))}`
  // Conflict behaviour: rename (so two files with the same name don't overwrite)
  const url = `${GRAPH}/me/drive/root:/${path}:/content?@microsoft.graph.conflictBehavior=rename`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': opts.mimeType || 'application/octet-stream',
    },
    // @ts-expect-error — node fetch accepts Buffer
    body: opts.body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OneDrive upload failed (${res.status}): ${text}`)
  }
  const item = await res.json() as { id: string; name: string; size: number; thumbnails?: unknown[] }

  // Best-effort: fetch a small thumbnail URL for image-y files
  let thumbnailUrl: string | undefined
  try {
    const tres = await fetch(`${GRAPH}/me/drive/items/${item.id}/thumbnails/0/medium`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (tres.ok) {
      const t = await tres.json() as { url?: string }
      thumbnailUrl = t.url
    }
  } catch {}

  return { id: item.id, name: item.name, size: item.size, thumbnailUrl }
}

/** Create an anonymous "view" share link for a OneDrive item. */
export async function createAnonymousLink(userId: string, itemId: string): Promise<string> {
  const token = await getAccessToken(userId)
  const res = await fetch(`${GRAPH}/me/drive/items/${itemId}/createLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createLink failed (${res.status}): ${text}`)
  }
  const data = await res.json() as { link?: { webUrl?: string } }
  if (!data.link?.webUrl) throw new Error('createLink returned no webUrl')
  return data.link.webUrl
}

/** Delete a OneDrive item by id. Errors are swallowed — caller still wipes the DB row. */
export async function deleteItem(userId: string, itemId: string): Promise<void> {
  try {
    const token = await getAccessToken(userId)
    await fetch(`${GRAPH}/me/drive/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    console.error('deleteItem failed', err)
  }
}

/** Disconnect: remove the row. Microsoft tokens are revocable via the user's
 *  Microsoft account page; we just stop using them. */
export async function disconnect(userId: string): Promise<void> {
  await prisma.microsoftAccount.deleteMany({ where: { userId } })
}

// Strip filename of path separators and trim — OneDrive accepts most chars but
// we sanitise to avoid trouble.
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 240)
}
