'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

// Re-runs the server component (status pill, assigned tasks, recent activity)
// so an agent's live state can be pulled on demand without a full reload.
export function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
        fontSize: 11, fontWeight: 600, color: 'var(--mb-ink-soft)', cursor: pending ? 'default' : 'pointer',
        background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', borderRadius: 6,
        padding: '4px 9px', opacity: pending ? 0.6 : 1,
      }}
    >
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        className={pending ? 'animate-spin' : undefined}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
      </svg>
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}
