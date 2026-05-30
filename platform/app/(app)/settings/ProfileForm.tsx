'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { updateProfile, type ProfileActionState } from '@/server/actions/profile'

export function ProfileForm({
  userId, initial,
}: {
  userId: string
  initial: { name: string; email: string; title: string | null; bio: string | null; image: string | null }
}) {
  const { update } = useSession()
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(updateProfile, {})
  const [name, setName] = useState(initial.name)
  const [image, setImage] = useState(initial.image ?? '')

  useEffect(() => {
    if (!pending && state?.ok) {
      toast.success('Profile updated')
      // Refresh the JWT-backed session so the topbar name/avatar update too.
      // Use the server-normalized image (drive share links → direct URL).
      void update({ name: state.name ?? name, image: state.image ?? null })
      if (state.image !== undefined) setImage(state.image ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state])

  const initials = (name || initial.email).split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <form action={formAction} className="ws-card" style={{ marginBottom: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--mb-border)' }} />
        ) : (
          <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--mb-brand)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 700 }}>{initials}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>{name || initial.email}</div>
          <div style={{ fontSize: 12, color: 'var(--mb-ink-muted)' }}>{initial.email}</div>
          <Link href={`/u/${userId}`} style={{ fontSize: 11.5, color: 'var(--mb-brand)', textDecoration: 'none' }}>View public profile →</Link>
        </div>
      </div>

      <Field label="Display name">
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="ws-input" style={inputStyle} />
      </Field>
      <Field label="Title (e.g. Lead Analyst)">
        <input name="title" defaultValue={initial.title ?? ''} maxLength={120} className="ws-input" style={inputStyle} />
      </Field>
      <Field label="Avatar — image URL, or a OneDrive / Google Drive share link">
        <input name="image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://… or a drive share link" className="ws-input" style={inputStyle} />
        <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>
          Paste a direct image URL, or a share link from OneDrive / Google Drive (set it to “anyone with the link”).
        </span>
      </Field>
      <Field label="Bio">
        <textarea name="bio" defaultValue={initial.bio ?? ''} rows={3} maxLength={1000} className="ws-input" style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      {state?.error && <p style={{ fontSize: 12, color: 'var(--mb-down, #e5484d)' }}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--mb-brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pending ? 0.6 : 1 }}
      >
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

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
