import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { decryptToken, encryptToken } from '@/lib/crypto'

/**
 * Google Drive client for file attachments. Mirrors lib/onedrive.ts.
 *
 * Auth: delegated OAuth2 reusing the existing Google app (AUTH_GOOGLE_ID /
 * AUTH_GOOGLE_SECRET) with an added `drive.file` scope — granted via a separate
 * consent flow (not sign-in), so users explicitly opt into Drive access. The
 * `drive.file` scope only exposes files this app creates, never the user's whole
 * Drive. Refresh tokens are AES-GCM-encrypted at rest; access tokens are cached
 * and refreshed lazily within 60s of expiry.
 *
 * Upload strategy: multipart upload to Drive root (<= 4 MB), then an
 * "anyone with the link / reader" permission so workspace members can view.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export const GOOGLE_DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024 // 4 MB

function env() {
  const clientId = process.env.AUTH_GOOGLE_ID
  const clientSecret = process.env.AUTH_GOOGLE_SECRET
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI
    || `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/googledrive/callback`
  return { clientId, clientSecret, redirectUri }
}

export function isConfigured(): boolean {
  const { clientId, clientSecret } = env()
  return Boolean(clientId && clientSecret)
}

/** URL to redirect the user to in order to start the Drive OAuth flow. */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = env()
  if (!clientId) throw new Error('AUTH_GOOGLE_ID not set')
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: GOOGLE_DRIVE_SCOPES,
    state,
    // offline + consent guarantees a refresh_token on the first grant.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `${AUTH_URL}?${params.toString()}`
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
  const { clientId, clientSecret } = env()
  if (!clientId || !clientSecret) throw new Error('Google client credentials not configured')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }
  return res.json()
}

/** Exchange the auth code for tokens and upsert the GoogleAccount row. */
export async function completeOAuth(userId: string, code: string) {
  const { redirectUri } = env()
  const token = await exchangeToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  if (!token.refresh_token) {
    throw new Error('No refresh token returned — re-consent with offline access.')
  }

  const profile = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then(r => r.json()).catch(() => ({})) as { sub?: string; email?: string; name?: string }

  const expiresAt = new Date(Date.now() + (token.expires_in - 60) * 1000)
  const data = {
    googleUserId: profile.sub || 'unknown',
    displayName: profile.name || null,
    email: profile.email || null,
    refreshTokenEnc: encryptToken(token.refresh_token),
    accessToken: token.access_token,
    accessTokenExpiry: expiresAt,
    scope: token.scope || GOOGLE_DRIVE_SCOPES,
  }
  return prisma.googleAccount.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
}

/**
 * Returns a valid access token for the user, refreshing if missing or within
 * 60s of expiry. Throws if the user hasn't connected Google Drive.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const acct = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!acct) throw new Error('Google Drive not connected for this user')

  const now = Date.now()
  if (acct.accessToken && acct.accessTokenExpiry && acct.accessTokenExpiry.getTime() > now + 60_000) {
    return acct.accessToken
  }

  const refreshToken = decryptToken(acct.refreshTokenEnc)
  const token = await exchangeToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
  const newExpiry = new Date(now + (token.expires_in - 60) * 1000)
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      accessToken: token.access_token,
      accessTokenExpiry: newExpiry,
      // Google rarely rotates refresh tokens, but persist if it does.
      ...(token.refresh_token && { refreshTokenEnc: encryptToken(token.refresh_token) }),
    },
  })
  return token.access_token
}

/**
 * Upload a file to the user's Drive (root). Returns the created file's id, name,
 * size, and a thumbnail URL for images. Caller enforces the 4 MB ceiling.
 */
export async function uploadFile(opts: {
  userId: string
  taskId: string
  filename: string
  mimeType: string
  body: Buffer | Uint8Array
}): Promise<{ id: string; name: string; size: number; thumbnailUrl?: string }> {
  const token = await getAccessToken(opts.userId)
  const mimeType = opts.mimeType || 'application/octet-stream'

  // Tag with the originating task so files are traceable in the user's Drive.
  const metadata = { name: safeName(opts.filename), appProperties: { probaseTaskId: opts.taskId } }
  const boundary = 'probase' + randomBytes(8).toString('hex')
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  )
  const post = Buffer.from(`\r\n--${boundary}--`)
  const reqBody = Buffer.concat([pre, Buffer.from(opts.body), post])

  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,size`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: reqBody,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Drive upload failed (${res.status}): ${text}`)
  }
  const item = await res.json() as { id: string; name: string; size?: string }

  // For images, drive.google.com/thumbnail works once the file is anyone-shared
  // (the share permission is added separately in createAnonymousLink).
  const thumbnailUrl = mimeType.startsWith('image/')
    ? `https://drive.google.com/thumbnail?id=${item.id}&sz=w512`
    : undefined

  return { id: item.id, name: item.name, size: Number(item.size) || 0, thumbnailUrl }
}

/**
 * Make a Drive file viewable by anyone with the link and return its webViewLink.
 * Mirrors the OneDrive createAnonymousLink signature.
 */
export async function createAnonymousLink(userId: string, fileId: string): Promise<string> {
  const token = await getAccessToken(userId)
  const permRes = await fetch(`${DRIVE}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  if (!permRes.ok) {
    const text = await permRes.text()
    throw new Error(`Drive permission failed (${permRes.status}): ${text}`)
  }
  const fileRes = await fetch(`${DRIVE}/files/${fileId}?fields=webViewLink`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await fileRes.json() as { webViewLink?: string }
  return data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
}

/** Delete a Drive file. Errors are swallowed — caller still wipes the DB row. */
export async function deleteItem(userId: string, fileId: string): Promise<void> {
  try {
    const token = await getAccessToken(userId)
    await fetch(`${DRIVE}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    console.error('googledrive deleteItem failed', err)
  }
}

/** Disconnect: remove the row. */
export async function disconnect(userId: string): Promise<void> {
  await prisma.googleAccount.deleteMany({ where: { userId } })
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 240)
}
