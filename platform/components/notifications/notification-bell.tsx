'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellDot, Check, AtSign, UserPlus, MessageSquare, ArrowLeftRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn, getInitials } from '@/lib/utils'

interface Notification {
  id: string
  kind: string
  taskId: string | null
  commentId: string | null
  actorId: string | null
  metadata: string | null
  read: boolean
  createdAt: string
  module?: string
  href?: string | null
  task: { id: string; title: string; project: { id: string; name: string; color: string } } | null
  actor: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
}

const KIND_ICON: Record<string, React.ElementType> = {
  mention: AtSign,
  'task.assigned': UserPlus,
  'comment.added': MessageSquare,
  'finance.notification': ArrowLeftRight,
}

const POLL_MS = 60_000 // 1 minute

// Width of the desktop popover; mobile takes (almost) the full viewport
const POPOVER_W = 360
const POPOVER_MARGIN = 8

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Compute popover position from the trigger's bounding rect every time we open.
  // Using fixed positioning sidesteps overflow / stacking-context clipping in the sidebar.
  const recompute = useCallback(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      // Full-width-ish below the top bar
      setPos({
        top: rect.bottom + POPOVER_MARGIN,
        left: POPOVER_MARGIN,
        placement: 'bottom',
      })
      return
    }
    // Desktop placement strategy:
    //   1. If there's room to the RIGHT of the trigger (the common case: bell
    //      sits in the left sidebar), pop out to the right and pin the bottom
    //      of the popover to the bottom of the bell.
    //   2. Otherwise try below, then above.
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const desiredH = 500
    const spaceRight = viewportW - rect.right - POPOVER_MARGIN
    const spaceBelow = viewportH - rect.bottom
    const spaceAbove = rect.top

    let top: number
    let left: number
    let placement: 'top' | 'bottom' = 'bottom'

    if (spaceRight >= POPOVER_W) {
      // Pop to the right of the trigger; anchor the popover bottom to the
      // trigger bottom so the dropdown opens upward (since the bell is near
      // the bottom of the sidebar).
      left = rect.right + POPOVER_MARGIN
      const idealTop = rect.bottom - desiredH
      top = Math.max(POPOVER_MARGIN, Math.min(idealTop, viewportH - desiredH - POPOVER_MARGIN))
      placement = 'bottom'
    } else {
      const placeAbove = spaceBelow < desiredH && spaceAbove > spaceBelow
      placement = placeAbove ? 'top' : 'bottom'
      top = placeAbove
        ? Math.max(POPOVER_MARGIN, rect.top - Math.min(desiredH, spaceAbove) - POPOVER_MARGIN)
        : rect.bottom + POPOVER_MARGIN
      const idealLeft = rect.right - POPOVER_W
      left = Math.max(POPOVER_MARGIN, Math.min(idealLeft, viewportW - POPOVER_W - POPOVER_MARGIN))
    }
    setPos({ top, left, placement })
  }, [open])

  useLayoutEffect(() => { recompute() }, [open, recompute])
  useEffect(() => {
    if (!open) return
    const onResize = () => recompute()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, recompute])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }, [])

  // Initial load + poll
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, POLL_MS)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // Re-fetch when dropdown opens (gives an instant refresh on click)
  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchNotifications().finally(() => setLoading(false))
    }
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const markAllRead = async () => {
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
    } catch {}
  }

  const handleOpen = (n: Notification) => {
    setOpen(false)
    // Mark this one read (optimistic)
    if (!n.read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnreadCount(c => Math.max(0, c - 1))
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {})
    }
    if (n.href) {
      router.push(n.href)
    } else if (n.task) {
      const q = new URLSearchParams({ task: n.task.id })
      if (n.commentId) q.set('comment', n.commentId)
      router.push(`/projects/${n.task.project.id}?${q.toString()}`)
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={className}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {unreadCount > 0
          ? <BellDot className="h-5 w-5 md:h-4 md:w-4" />
          : <Bell className="h-5 w-5 md:h-4 md:w-4" />}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && pos && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            // Mobile: take most of the viewport width; desktop: fixed width
            width: typeof window !== 'undefined' && window.innerWidth < 768
              ? `calc(100vw - ${POPOVER_MARGIN * 2}px)`
              : POPOVER_W,
          }}
          className={cn(
            'bg-bg-card rounded-xl shadow-2xl border border-line overflow-hidden z-[60] flex flex-col max-h-[80dvh] md:max-h-[500px]'
          )}
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-3" />
              <span className="text-sm font-semibold text-gray-1">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-3">
                Loading…
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-3">
                <Bell className="h-10 w-10 mx-auto mb-2 text-gray-3" />
                You&apos;re all caught up.
              </div>
            )}
            {notifications.map(n => {
              const Icon = KIND_ICON[n.kind] || Bell
              const meta: { preview?: string; taskTitle?: string; title?: string } = (() => {
                try { return n.metadata ? JSON.parse(n.metadata) : {} } catch { return {} }
              })()
              return (
                <button
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-line last:border-b-0',
                    !n.read && 'bg-indigo-50/40 dark:bg-indigo-950/20',
                    'hover:bg-bg-hover'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {n.actor?.image ? (
                      <img src={n.actor.image} className="h-8 w-8 rounded-full" alt="" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                        {getInitials(n.actor?.name || n.actor?.email || '?')}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-gray-3 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-1 truncate">
                        {n.actor?.name || n.actor?.email || 'Someone'}
                      </span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-2 mt-0.5 line-clamp-2">
                      {describeNotification(n.kind, meta)}
                    </p>
                    {n.task && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-3">
                        <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: n.task.project.color }} />
                        <span className="truncate">{n.task.title}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-3 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function describeNotification(kind: string, meta: { preview?: string; taskTitle?: string; title?: string; body?: string }): string {
  switch (kind) {
    case 'mention':
      return meta.preview ? `mentioned you: "${meta.preview}"` : 'mentioned you in a comment'
    case 'task.assigned':
      return meta.title ? `assigned you to "${meta.title}"` : 'assigned a task to you'
    case 'comment.added':
      return meta.preview ? `commented: "${meta.preview}"` : 'left a comment'
    case 'finance.notification':
      return meta.body || meta.title || 'New notification'
    default:
      return kind
  }
}
