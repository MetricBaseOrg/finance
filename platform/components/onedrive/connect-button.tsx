'use client'

import { useEffect, useState, useCallback } from 'react'
import { Cloud, CloudCheck, CloudOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MeResponse {
  configured: boolean
  connected: boolean
  account: { email?: string | null; displayName?: string | null } | null
}

/**
 * Compact button showing OneDrive connection status. Click to connect or
 * disconnect. Used in the sidebar user section.
 */
export function OneDriveConnectButton({ className }: { className?: string }) {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/onedrive/me', { cache: 'no-store' })
      if (!r.ok) return
      setMe(await r.json())
    } catch {}
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Refresh when window comes back into focus (handles post-OAuth bounce)
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  if (!me) {
    return (
      <button className={className} disabled aria-label="Loading OneDrive status">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    )
  }

  if (!me.configured) {
    return (
      <button
        className={cn(className, 'cursor-not-allowed opacity-50')}
        title="OneDrive integration not configured on this server"
        disabled
      >
        <CloudOff className="h-4 w-4" />
      </button>
    )
  }

  if (me.connected) {
    return (
      <button
        onClick={async () => {
          if (!confirm(`Disconnect OneDrive (${me.account?.email || 'connected account'})?`)) return
          setBusy(true)
          try {
            await fetch('/api/onedrive/me', { method: 'DELETE' })
            await refresh()
          } finally { setBusy(false) }
        }}
        className={className}
        title={`OneDrive connected: ${me.account?.email || me.account?.displayName || 'click to disconnect'}`}
      >
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <CloudCheck className="h-4 w-4 text-emerald-500" />}
      </button>
    )
  }

  return (
    <a
      href={`/api/onedrive/auth?returnTo=${encodeURIComponent(window.location.pathname || '/projects/dashboard')}`}
      className={className}
      title="Connect OneDrive to enable file attachments"
    >
      <Cloud className="h-4 w-4" />
    </a>
  )
}
