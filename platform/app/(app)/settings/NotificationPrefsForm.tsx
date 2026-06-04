'use client'

import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { updateNotificationPrefs } from '@/server/actions/profile'

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="ws-btn"
      style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: on ? 'var(--mb-brand)' : 'var(--mb-border-strong)', display: 'inline-flex', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(16px)' : 'translateX(0)', transition: 'transform .18s' }} />
    </button>
  )
}

function Row({ label, sub, children, last }: { label: string; sub?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', borderBottom: last ? 'none' : '1px solid var(--mb-divider)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mb-ink)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--mb-ink-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export function NotificationPrefsForm({ initial }: {
  initial: { emailNotifications: boolean; dailyDigest: boolean }
}) {
  const [notif, setNotif] = useState(initial.emailNotifications)
  const [digest, setDigest] = useState(initial.dailyDigest)
  const [pending, startTransition] = useTransition()

  // Persist on every change with optimistic UI; revert if the save fails.
  const save = (next: { emailNotifications: boolean; dailyDigest: boolean }) => {
    const prev = { emailNotifications: notif, dailyDigest: digest }
    setNotif(next.emailNotifications)
    setDigest(next.dailyDigest)
    startTransition(async () => {
      try {
        await updateNotificationPrefs(next)
      } catch {
        setNotif(prev.emailNotifications)
        setDigest(prev.dailyDigest)
        toast.error('Could not save preferences')
      }
    })
  }

  return (
    <div className="ws-card" style={{ marginBottom: 18 }}>
      <Row label="Email notifications" sub="Task assignments and alerts across all apps">
        <Toggle on={notif} disabled={pending} onChange={(v) => save({ emailNotifications: v, dailyDigest: digest })} />
      </Row>
      {/* The digest is part of email delivery, so it's only meaningful when the
          master email switch is on. */}
      <Row label="Daily digest" sub="A morning summary of cross-app activity" last>
        <Toggle on={notif && digest} disabled={pending || !notif} onChange={(v) => save({ emailNotifications: notif, dailyDigest: v })} />
      </Row>
    </div>
  )
}
