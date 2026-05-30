'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Paperclip, Upload, Trash2, FileText, FileImage, File as FileIcon,
  ExternalLink, Cloud, Loader2,
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
  shareUrl: string
  thumbnailUrl: string | null
  createdAt: string
  uploader: { id: string; name?: string | null; email?: string | null; image?: string | null }
}

const MAX_BYTES = 4 * 1024 * 1024 // mirrors lib/onedrive.MAX_ATTACHMENT_BYTES

export function AttachmentsSection({ taskId }: { taskId: string }) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id || ''
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [oneDriveConnected, setOneDriveConnected] = useState<boolean | null>(null)
  const [oneDriveConfigured, setOneDriveConfigured] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshConnection = useCallback(async () => {
    try {
      const r = await fetch('/api/onedrive/me', { cache: 'no-store' })
      if (!r.ok) return
      const me = await r.json()
      setOneDriveConfigured(!!me.configured)
      setOneDriveConnected(!!me.connected)
    } catch {}
  }, [])

  // Initial fetch
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/attachments?taskId=${taskId}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
      fetch('/api/onedrive/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([list, me]) => {
      if (cancelled) return
      setItems(Array.isArray(list) ? list : [])
      if (me) {
        setOneDriveConfigured(!!me.configured)
        setOneDriveConnected(!!me.connected)
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [taskId])

  // Re-check connection when the window regains focus — handles the case
  // where the user opened a task, then connected OneDrive in another tab.
  useEffect(() => {
    const onFocus = () => refreshConnection()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshConnection])

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
      const res = await fetch('/api/attachments', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'onedrive_not_connected') {
          toast.error('Connect OneDrive first (the cloud icon in the sidebar).')
          setOneDriveConnected(false)
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
  }, [taskId])

  const onFiles = (files: FileList | null) => {
    if (!files) return
    // Sequential to keep things simple; parallel uploads are cheap to add later.
    for (const f of Array.from(files)) {
      void upload(f)
    }
  }

  const remove = async (att: Attachment) => {
    if (!confirm(`Delete "${att.name}"? This removes it from OneDrive too.`)) return
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
        {oneDriveConnected === false && oneDriveConfigured && (
          <a
            href={`/api/onedrive/auth?returnTo=${encodeURIComponent(window.location.pathname)}`}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Cloud className="h-3 w-3" /> Connect OneDrive
          </a>
        )}
      </div>

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
          if (oneDriveConnected !== true) {
            await refreshConnection()
          }
          if (oneDriveConnected === false) {
            toast.error('Connect OneDrive first (the cloud icon in the sidebar).')
            return
          }
          onFiles(e.dataTransfer.files)
        }}
        onClick={async () => {
          if (oneDriveConnected !== true) {
            await refreshConnection()
          }
          if (oneDriveConnected === false) {
            toast.error('Connect OneDrive first (the cloud icon in the sidebar).')
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
                  <span>{formatSize(a.size)}</span>
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
  const Icon = isImage ? FileImage : att.mimeType?.includes('pdf') ? FileText : FileIcon
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
