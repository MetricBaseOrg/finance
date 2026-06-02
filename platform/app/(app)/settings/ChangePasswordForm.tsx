'use client'

import { useActionState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { changePassword, type ChangePasswordState } from '@/server/actions/profile'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--mb-border)',
  background: 'var(--mb-surface)', color: 'var(--mb-ink)', fontSize: 13.5,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mb-ink-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {})

  useEffect(() => {
    if (!pending && state?.ok) toast.success('Password updated')
  }, [pending, state])

  return (
    <form action={formAction} className="ws-card" style={{ marginBottom: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {hasPassword && (
        <Field label="Current password">
          <input name="current" type="password" autoComplete="current-password" required className="ws-input" style={inputStyle} />
        </Field>
      )}
      <Field label={hasPassword ? 'New password' : 'Password'}>
        <input name="next" type="password" autoComplete="new-password" required minLength={8} className="ws-input" style={inputStyle} />
      </Field>
      <Field label="Confirm password">
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className="ws-input" style={inputStyle} />
      </Field>

      {state?.error && <p style={{ fontSize: 12, color: 'var(--mb-down, #e5484d)', margin: 0 }}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--mb-brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pending ? 0.6 : 1 }}
      >
        {pending ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
      </button>
    </form>
  )
}
