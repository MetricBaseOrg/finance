/**
 * Validate and describe a user-pasted "link attachment" — a Google Drive,
 * OneDrive, or arbitrary http(s) URL that we reference rather than host.
 *
 * Returns null for anything that isn't a parseable http/https URL (this also
 * rejects javascript:/data: and other non-web schemes, so the stored shareUrl
 * is always safe to put in an <a href>).
 */
export interface LinkAttachment {
  url: string
  name: string
  /** Lowercased hostname, for picking an icon/label in the UI. */
  host: string
}

export function describeLinkAttachment(rawUrl: string, providedName?: string | null): LinkAttachment | null {
  const raw = (rawUrl ?? '').trim()
  if (!raw) return null

  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  const host = u.hostname.toLowerCase()
  const explicit = (providedName ?? '').trim()
  const name = explicit || deriveName(u, host)
  return { url: raw, name: name.slice(0, 200), host }
}

function deriveName(u: URL, host: string): string {
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'Google Drive file'
  if (host === '1drv.ms' || host.endsWith('onedrive.live.com') || host.endsWith('sharepoint.com')) {
    return 'OneDrive file'
  }
  // Fall back to the last path segment (a filename, usually), else the host.
  const seg = u.pathname.split('/').filter(Boolean).pop()
  if (seg) {
    try {
      const decoded = decodeURIComponent(seg)
      if (decoded) return decoded
    } catch {
      return seg
    }
  }
  return host
}
