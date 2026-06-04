'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Paperclip, Upload, Trash2, FileText, FileImage, File as FileIcon,
  ExternalLink, Cloud, Loader2, Link2, Plus,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Attachment {
  id: string
  taskId: string
  name: string
  size: number
  mimeType: string | null
  // "onedrive" | "googledrive" | "link"
  provider: string
  // null for "link" attachments (a pasted Drive/OneDrive/arbitrary URL).
  msItemId: string | null
  shareUrl: string
  thumbnailUrl: string | null
  createdAt: string
  uploader: { id: string; name?: string | null; email?: string | null; image?: string | null }
}

const MAX_BYTES = 4 * 1024 * 1024 // mirrors lib/onedrive.MAX_ATTACHMENT_BYTES

type CloudProvider = 'onedrive' | 'googledrive'
type ProviderState = { configured: boolean; connected: boolean }
type ProviderStates = Record<CloudProvider, ProviderState>
const PROVIDER_LABEL: Record<CloudProvider, string> = {
  onedrive: 'OneDrive',
  googledrive: 'Google Drive',
}

export function AttachmentsSection({ taskId }: { taskId: string }) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id || ''
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [addingLink, setAddingLink] = useState(false)
  const [providers, setProviders] = useState<ProviderStates>({
    onedrive: { configured: false, connected: false },
    googledrive: { configured: false, connected: false },
  })
  // Which cloud to upload to (only matters when both are connected).
  const [target, setTarget] = useState<CloudProvider>('onedrive')
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshConnection = useCallback(async () => {
    try {
      const [od, gd] = await Promise.all([
        fetch('/api/onedrive/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
        fetch('/api/googledrive/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      ])
      setProviders(prev => ({
        onedrive: od ? { configured: !!od.configured, connected: !!od.connected } : prev.onedrive,
        googledrive: gd ? { configured: !!gd.configured, connected: !!gd.connected } : prev.googledrive,
      }))
    } catch {}
  }, [])

  // Initial fetch
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/attachments?taskId=${taskId}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
      fetch('/api/onedrive/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/googledrive/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([list, od, gd]) => {
      if (cancelled) return
      setItems(Array.isArray(list) ? list : [])
      setProviders(prev => ({
        onedrive: od ? { configured: !!od.configured, connected: !!od.connected } : prev.onedrive,
        googledrive: gd ? { configured: !!gd.configured, connected: !!gd.connected } : prev.googledrive,
      }))
      // Default the upload target to whichever cloud is connected.
      if (gd?.connected && !od?.connected) setTarget('googledrive')
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [taskId])

  // Re-check connections when the window regains focus — handles the case where
  // the user opened a task, then connected a cloud in another tab.
  useEffect(() => {
    const onFocus = () => refreshConnection()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshConnection])

  const anyConnected = providers.onedrive.connected || providers.googledrive.connected
  // Effective upload provider: the user's choice, but fall back to whichever
  // single cloud is actually connected.
  const effectiveTarget: CloudProvider =
    providers[target].connected ? target
    : providers.onedrive.connected ? 'onedrive'
    : 'googledrive'

  const upload = useCallback(async (file: File) => {
    if (file.size === 0) {
      toast.error('Empty file')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 4 MB.`)
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('taskId', taskId)
      form.append('file', file)
      form.append('provider', effectiveTarget)
      const res = await fetch('/api/attachments', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'onedrive_not_connected' || data.code === 'googledrive_not_connected') {
          toast.error(data.error || 'Connect a cloud account first.')
          void refreshConnection()
        } else {
          toast.error(data.error || `Upload failed (${res.status})`)
        }
        return
      }
      const att = await res.json() as Attachment
      setItems(prev => [att, ...prev])
      toast.success(`Uploaded ${att.name}`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }, [taskId, effectiveTarget, refreshConnection])

  const addLink = useCallback(async () => {
    const url = linkUrl.trim()
    if (!url) return
    // Basic client-side guard; the server re-validates and rejects non-http(s).
    try {
      const u = new URL(url)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
    } catch {
      toast.error('Enter a valid http(s) link.')
      return
    }
    setAddingLink(true)
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, url }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || `Could not add link (${res.status})`)
        return
      }
      const att = await res.json() as Attachment
      setItems(prev => [att, ...prev])
      setLinkUrl('')
      setShowLink(false)
      toast.success('Link attached')
    } catch {
      toast.error('Could not add link')
    } finally {
      setAddingLink(false)
    }
  }, [linkUrl, taskId])

  const onFiles = (files: FileList | null) => {
    if (!files) return
    // Sequential to keep things simple; parallel uploads are cheap to add later.
    for (const f of Array.from(files)) {
      void upload(f)
    }
  }

  const remove = async (att: Attachment) => {
    const where = att.provider === 'link' ? '' : ` This removes it from ${PROVIDER_LABEL[att.provider as CloudProvider] || 'the cloud'} too.`
    if (!confirm(`Delete "${att.name}"?${where}`)) return
    const prev = items
    setItems(prev.filter(i => i.id !== att.id))
    try {
      const res = await fetch(`/api/attachments/${att.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
    } catch {
      setItems(prev)
      toast.error('Failed to delete')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-3">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments
          {items.length > 0 && <span className="text-gray-4">· {items.length}</span>}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLink(v => !v)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Link2 className="h-3 w-3" /> Add link
          </button>
          {providers.onedrive.configured && !providers.onedrive.connected && (
            <a
              href={`/api/onedrive/auth?returnTo=${encodeURIComponent(window.location.pathname)}`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Cloud className="h-3 w-3" /> Connect OneDrive
            </a>
          )}
          {providers.googledrive.configured && !providers.googledrive.connected && (
            <a
              href={`/api/googledrive/auth?returnTo=${encodeURIComponent(window.location.pathname)}`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Cloud className="h-3 w-3" /> Connect Google Drive
            </a>
          )}
        </div>
      </div>

      {/* Upload-target picker — only when both clouds are connected. */}
      {providers.onedrive.connected && providers.googledrive.connected && (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-gray-3">
          <span>Upload to:</span>
          {(['onedrive', 'googledrive'] as CloudProvider[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setTarget(p)}
              className={cn(
                'px-2 py-0.5 rounded-md border',
                target === p
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                  : 'border-line text-gray-3 hover:border-border-str',
              )}
            >
              {PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>
      )}

      {/* Paste-a-link row — attach a Google Drive / OneDrive / any URL without
          uploading or connecting an account. */}
      {showLink && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="url"
            autoFocus
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addLink() } }}
            placeholder="Paste a Google Drive, OneDrive, or any link…"
            className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-line bg-bg-card text-gray-1 outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={() => void addLink()}
            disabled={addingLink || !linkUrl.trim()}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {addingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Attach
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
        onDrop={async e => {
          e.preventDefault()
          setDragOver(false)
          // Verify connection right before acting — covers the case where the
          // user just connected and the cached state hasn't caught up.
          if (!anyConnected) await refreshConnection()
          if (!anyConnected) {
            toast.error('Connect OneDrive or Google Drive first, or paste a link.')
            return
          }
          onFiles(e.dataTransfer.files)
        }}
        onClick={async () => {
          if (!anyConnected) await refreshConnection()
          if (!anyConnected) {
            toast.error('Connect OneDrive or Google Drive first, or paste a link.')
            return
          }
          inputRef.current?.click()
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-3 text-center text-xs cursor-pointer transition-colors',
          dragOver
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
            : 'border-line text-gray-3 hover:border-border-str',
          uploading && 'opacity-60 pointer-events-none'
        )}
        role="button"
        aria-label="Upload attachment"
      >
        {uploading
          ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</span>
          : <span className="flex items-center justify-center gap-1.5">
              <Upload className="h-3 w-3" /> Drop a file or click to browse · max 4 MB
            </span>}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => onFiles(e.target.files)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="mt-3 text-xs text-gray-4">Loading…</div>
      ) : items.length === 0 ? null : (
        <ul className="mt-2 space-y-1.5">
          {items.map(a => (
            <li
              key={a.id}
              className="group flex items-center gap-2.5 p-2 rounded-lg border border-line hover:border-border-str bg-bg-card"
            >
              <AttachmentIcon att={a} />
              <a
                href={a.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <p className="text-sm text-gray-1 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {a.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-gray-4 mt-0.5">
                  <span>{a.msItemId ? formatSize(a.size) : 'Link'}</span>
                  <span>·</span>
                  <span title={a.uploader.name || a.uploader.email || ''}>
                    {getInitials(a.uploader.name || a.uploader.email || 'U')}
                  </span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                </div>
              </a>
              <a
                href={a.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 w-7 flex items-center justify-center text-gray-4 hover:text-gray-2 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {a.uploader.id === currentUserId && (
                <button
                  onClick={() => remove(a)}
                  className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Delete attachment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AttachmentIcon({ att }: { att: Attachment }) {
  const isImage = att.mimeType?.startsWith('image/')
  if (isImage && att.thumbnailUrl) {
    return (
      <img
        src={att.thumbnailUrl}
        alt=""
        className="h-9 w-9 rounded-md object-cover flex-shrink-0 border border-line"
      />
    )
  }
  // Link attachments (no hosted OneDrive item) get a link glyph.
  const Icon = att.msItemId === null
    ? Link2
    : isImage ? FileImage : att.mimeType?.includes('pdf') ? FileText : FileIcon
  return (
    <div className="h-9 w-9 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-gray-3" />
    </div>
  )
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
