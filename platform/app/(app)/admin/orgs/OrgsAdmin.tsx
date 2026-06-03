'use client'

import { useEffect, useState } from 'react'
import { Building2, Trash2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { getInitials } from '@/lib/utils'
import { Pill } from '@/app/home/ui'
import { ROLES, ROLE_LABELS } from '@/lib/roles'
import { APP_IDS, APP_META, trialState, type AppAccessId } from '@/lib/apps'

type OrgRow = { id: string; name: string; slug: string; color: string; memberCount: number }
type Member = {
  id: string
  role: string
  appAccess: string[]
  trialEndsAt: string | null
  user: { id: string; name: string | null; email: string; image: string | null; status: string }
}

export function OrgsAdmin() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<OrgRow | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/orgs')
      .then((r) => r.json())
      .then((data: OrgRow[]) => { setOrgs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { toast.error('Failed to load organizations'); setLoading(false) })
  }, [])

  const openOrg = (org: OrgRow) => {
    setSelected(org)
    setLoadingMembers(true)
    fetch(`/api/admin/orgs/${org.id}/members`)
      .then((r) => r.json())
      .then((data: { members: Member[] }) => { setMembers(data.members ?? []); setLoadingMembers(false) })
      .catch(() => { toast.error('Failed to load members'); setLoadingMembers(false) })
  }

  const patchMember = async (m: Member, body: { role?: string; appAccess?: string[] }) => {
    setBusy(m.id)
    const snapshot = members
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...body } : x)))
    try {
      const res = await fetch(`/api/admin/members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMembers(snapshot); toast.error(data.error || 'Update failed'); return }
      toast.success('Updated')
    } catch {
      setMembers(snapshot); toast.error('Update failed')
    } finally {
      setBusy(null)
    }
  }

  const removeMember = async (m: Member) => {
    if (!confirm(`Remove ${m.user.name || m.user.email} from ${selected?.name}?`)) return
    setBusy(m.id)
    const snapshot = members
    setMembers((prev) => prev.filter((x) => x.id !== m.id))
    try {
      const res = await fetch(`/api/admin/members/${m.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMembers(snapshot); toast.error(data.error || 'Remove failed'); return }
      toast.success('Removed')
      setOrgs((prev) => prev.map((o) => (o.id === selected?.id ? { ...o, memberCount: o.memberCount - 1 } : o)))
    } catch {
      setMembers(snapshot); toast.error('Remove failed')
    } finally {
      setBusy(null)
    }
  }

  const toggleApp = (m: Member, app: AppAccessId) => {
    // Explicit grants. Empty = no apps granted (only the trial unlocks apps).
    const next = m.appAccess.includes(app)
      ? m.appAccess.filter((a) => a !== app)
      : [...m.appAccess, app]
    patchMember(m, { appAccess: next })
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mb-ink-soft)', fontSize: 13 }}>Loading…</div>

  // ── Org detail view ─────────────────────────────────────────────────────
  if (selected) {
    return (
      <div>
        <button onClick={() => { setSelected(null); setMembers([]) }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--mb-ink-muted)', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
          ← All organizations
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: selected.color, display: 'inline-block' }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--mb-ink)' }}>{selected.name}</div>
          <span style={{ fontSize: 11, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)' }}>/{selected.slug}</span>
        </div>

        {loadingMembers ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--mb-ink-soft)', fontSize: 13 }}>Loading members…</div>
        ) : (
          <div className="ws-card" style={{ overflow: 'hidden' }}>
            {members.map((m, i) => (
              <div key={m.id} style={{ borderTop: i ? '1px solid var(--mb-divider)' : 'none', padding: '13px 15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--mb-brand-soft)', color: 'var(--mb-brand-ink)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
                    {m.user.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.user.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitials(m.user.name || m.user.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>{m.user.name || 'Unnamed'}</span>
                      {m.user.status === 'SUSPENDED' && <Pill tone="bad" dot={false}>Suspended</Pill>}
                      {(() => {
                        const t = trialState(m.trialEndsAt)
                        return t.onTrial
                          ? <Pill tone="info" dot={false}>Trial · {t.daysLeft}d</Pill>
                          : t.endsAt ? <Pill tone="neutral" dot={false}>Trial ended</Pill> : null
                      })()}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--mb-ink-muted)' }}>{m.user.email}</div>
                  </div>
                  <select
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={(e) => patchMember(m, { role: e.target.value })}
                    style={{ appearance: 'none', border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', color: 'var(--mb-ink)', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button onClick={() => removeMember(m)} disabled={busy === m.id} title="Remove from org"
                    style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', borderRadius: 7, color: 'var(--mb-bad-ink)', cursor: 'pointer' }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {/* Per-app access */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 11, paddingLeft: 43 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--mb-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'center' }}>Apps</span>
                  {APP_IDS.map((app) => {
                    const granted = m.appAccess.includes(app)
                    return (
                      <button key={app} onClick={() => toggleApp(m, app)} disabled={busy === m.id}
                        title={granted ? 'Granted — click to revoke' : 'Not granted — click to grant'}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                          border: `1px solid ${granted ? 'transparent' : 'var(--mb-border)'}`,
                          background: granted ? 'var(--mb-brand-soft)' : 'var(--mb-surface)',
                          color: granted ? 'var(--mb-brand-ink)' : 'var(--mb-ink-soft)' }}>
                        {APP_META[app].name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {members.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--mb-ink-soft)', fontSize: 13 }}>No members.</div>}
          </div>
        )}
      </div>
    )
  }

  // ── Org list view ───────────────────────────────────────────────────────
  return (
    <div className="ws-card" style={{ overflow: 'hidden' }}>
      {orgs.map((o, i) => (
        <button key={o.id} onClick={() => openOrg(o)}
          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: 'none', border: 'none', borderTop: i ? '1px solid var(--mb-divider)' : 'none', cursor: 'pointer' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: o.color, display: 'grid', placeItems: 'center', color: '#fff' }}>
            <Building2 className="h-4 w-4" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>{o.name}</div>
            <div style={{ fontSize: 11, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)' }}>/{o.slug}</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--mb-ink-muted)' }}>{o.memberCount} member{o.memberCount === 1 ? '' : 's'}</span>
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--mb-ink-soft)' }} />
        </button>
      ))}
      {orgs.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--mb-ink-soft)', fontSize: 13 }}>No organizations.</div>}
    </div>
  )
}
