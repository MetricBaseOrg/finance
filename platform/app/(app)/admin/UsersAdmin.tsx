'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Shield, ShieldOff, Ban, CheckCircle2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { getInitials } from '@/lib/utils'
import { Pill, wsField } from '@/app/home/ui'
import { ROLE_LABELS } from '@/lib/roles'
import { trialState } from '@/lib/apps'

type Membership = {
  id: string
  role: string
  appAccess: string[]
  trialEndsAt: string | null
  org: { id: string; name: string; slug: string }
}
type AdminUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  kind: string
  status: string
  isSuperAdmin: boolean
  createdAt: string
  lastActiveAt: string | null
  memberships: Membership[]
}

function rel(iso: string | null): string {
  if (!iso) return 'never'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function UsersAdmin({ meId }: { meId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback((query: string) => {
    setLoading(true)
    const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}` : '/api/admin/users'
    fetch(url)
      .then((r) => r.json())
      .then((data: AdminUser[]) => { setUsers(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { toast.error('Failed to load users'); setLoading(false) })
  }, [])

  useEffect(() => { load('') }, [load])
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q, load])

  const patchUser = async (u: AdminUser, body: { status?: string; isSuperAdmin?: boolean }) => {
    setBusy(u.id)
    const snapshot = users
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...body } : x)))
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setUsers(snapshot); toast.error(data.error || 'Update failed'); return }
      toast.success('Updated')
    } catch {
      setUsers(snapshot); toast.error('Update failed')
    } finally {
      setBusy(null)
    }
  }

  const toggleStatus = (u: AdminUser) => {
    const next = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
    if (next === 'SUSPENDED' && !confirm(`Suspend ${u.name || u.email}? They'll be signed out and blocked.`)) return
    patchUser(u, { status: next })
  }
  const toggleSuper = (u: AdminUser) => {
    if (u.isSuperAdmin && !confirm(`Remove super-admin from ${u.name || u.email}?`)) return
    patchUser(u, { isSuperAdmin: !u.isSuperAdmin })
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
        <Search className="h-4 w-4" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mb-ink-soft)' }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          style={{ ...wsField, paddingLeft: 33 }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mb-ink-soft)', fontSize: 13 }}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mb-ink-soft)', fontSize: 13 }}>No users found.</div>
      ) : (
        <div className="ws-card" style={{ overflow: 'hidden' }}>
          {users.map((u, i) => {
            const isSelf = u.id === meId
            const open = expanded === u.id
            return (
              <div key={u.id} style={{ borderTop: i ? '1px solid var(--mb-divider)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--mb-brand-soft)', color: 'var(--mb-brand-ink)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>
                    {u.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={u.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitials(u.name || u.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || 'Unnamed'}</span>
                      {isSelf && <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mb-ink-soft)', fontWeight: 600 }}>you</span>}
                      {u.isSuperAdmin && <Pill tone="info" dot={false}>Super-admin</Pill>}
                      {u.status === 'SUSPENDED' && <Pill tone="bad" dot={false}>Suspended</Pill>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--mb-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', whiteSpace: 'nowrap' }}>{rel(u.lastActiveAt)}</div>
                  <button onClick={() => setExpanded(open ? null : u.id)} title="Memberships"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', borderRadius: 7, padding: '5px 8px', fontSize: 11.5, color: 'var(--mb-ink-2)', cursor: 'pointer' }}>
                    {u.memberships.length} org{u.memberships.length === 1 ? '' : 's'}
                    <ChevronDown className="h-3.5 w-3.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                  </button>
                  <button onClick={() => toggleSuper(u)} disabled={busy === u.id || isSelf} title={u.isSuperAdmin ? 'Revoke super-admin' : 'Grant super-admin'}
                    style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', borderRadius: 7, color: u.isSuperAdmin ? 'var(--mb-brand-ink)' : 'var(--mb-ink-soft)', cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.4 : 1 }}>
                    {u.isSuperAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </button>
                  <button onClick={() => toggleStatus(u)} disabled={busy === u.id || isSelf} title={u.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                    style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', borderRadius: 7, color: u.status === 'SUSPENDED' ? 'var(--mb-ok-ink)' : 'var(--mb-bad-ink)', cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.4 : 1 }}>
                    {u.status === 'SUSPENDED' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  </button>
                </div>
                {open && (
                  <div style={{ padding: '4px 15px 14px 61px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {u.memberships.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--mb-ink-soft)' }}>No organization memberships.</div>
                    ) : u.memberships.map((m) => {
                      const t = trialState(m.trialEndsAt)
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: 'var(--mb-ink)' }}>{m.org.name}</span>
                          <Pill tone="neutral" dot={false}>{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</Pill>
                          {t.onTrial && <Pill tone="info" dot={false}>Trial · {t.daysLeft}d</Pill>}
                          <span style={{ color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', fontSize: 11 }}>
                            {m.appAccess.length === 0 ? 'no apps granted' : m.appAccess.join(', ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
