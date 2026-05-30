/**
 * Normalize an avatar source into a directly-embeddable image URL.
 *
 * Accepts:
 *   - a plain direct image URL (used as-is)
 *   - a OneDrive personal share link (1drv.ms / onedrive.live.com / sharepoint)
 *     → converted to the public Graph `/shares/.../root/content` endpoint
 *   - a Google Drive personal share link (drive.google.com / docs.google.com)
 *     → converted to the public `drive.google.com/thumbnail?id=…` endpoint
 *
 * The file must be shared "anyone with the link" in the user's drive for it to
 * render for other viewers — this only rewrites the URL, it doesn't change
 * sharing. Returns null for empty input.
 */
export function normalizeAvatarUrl(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null

  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    // Not a parseable URL — store as-is and let the <img> decide.
    return raw
  }

  // ── Google Drive ──
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const id = extractGoogleDriveId(raw)
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w512`
    return raw
  }

  // ── OneDrive personal ──
  if (host === '1drv.ms' || host.endsWith('onedrive.live.com') || host.endsWith('sharepoint.com')) {
    // Already a direct content endpoint? leave it.
    if (host === 'api.onedrive.com') return raw
    const b64 = Buffer.from(raw).toString('base64')
    const encoded = 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
    return `https://api.onedrive.com/v1.0/shares/${encoded}/root/content`
  }

  // Plain URL (incl. already-direct image links).
  return raw
}

function extractGoogleDriveId(url: string): string | null {
  // /file/d/<id>/view  ·  /d/<id>  ·  ?id=<id>  ·  /uc?id=<id>
  const m1 = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/)
  if (m1) return m1[1]
  try {
    const id = new URL(url).searchParams.get('id')
    if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return id
  } catch {
    /* ignore */
  }
  return null
}
