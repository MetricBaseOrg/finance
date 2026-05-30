'use client'

import { useState } from 'react'
import { AppTile, Pill, SectionHead, Btn, Icon, type AppId } from '@/app/home/ui'

const APPS: { id: AppId; name: string; sub: string; tagline: string; href: string }[] = [
  { id: 'probase', name: 'ProBase', sub: 'Projects', tagline: 'Plan, schedule & track delivery', href: '/projects' },
  { id: 'metricbase', name: 'Finance', sub: 'Tracker', tagline: 'Multi-currency books, P&L & balance sheet', href: '/finance' },
  { id: 'fieldflow', name: 'FieldFlow', sub: 'Field ops', tagline: 'Crude production, lifting & dispatch', href: '/field' },
  { id: 'ogtools', name: 'OGtools', sub: 'Calculators', tagline: 'Oilfield engineering calculators', href: '/tools' },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="ws-btn"
      style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: on ? 'var(--mb-brand)' : 'var(--mb-border-strong)', display: 'inline-flex' }}>
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

export function SettingsView({ userName, email, role, orgName, orgCount }: {
  userName: string; email: string; role: string; orgName: string; orgCount: number
}) {
  const [notif, setNotif] = useState(true)
  const [digest, setDigest] = useState(false)
  const initials = userName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px var(--ws-gutter) 60px' }} className="ws-fade">
      <div style={{ marginBottom: 18 }}>
        <div className="ws-eyebrow" style={{ marginBottom: 6 }}>Workspace · Account</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--mb-ink)', margin: 0 }}>Account &amp; settings</h1>
      </div>

      {/* profile */}
      <div className="ws-card" style={{ marginBottom: 18 }}>
        <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 15, borderBottom: '1px solid var(--mb-divider)' }}>
          <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--mb-brand)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 700 }}>{initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--mb-ink)' }}>{userName}</div>
            <div style={{ fontSize: 12, color: 'var(--mb-ink-muted)' }}>{email} · {role} · {orgName}</div>
          </div>
        </div>
        <Row label="Email notifications" sub="Task assignments and alerts across all apps"><Toggle on={notif} onChange={setNotif} /></Row>
        <Row label="Daily digest" sub="A morning summary of cross-app activity" last><Toggle on={digest} onChange={setDigest} /></Row>
      </div>

      {/* connected apps */}
      <SectionHead eyebrow="Access" title="Connected apps" sub="Apps available to you in this workspace" />
      <div className="ws-card" style={{ marginBottom: 18 }}>
        {APPS.map((a, i) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', borderBottom: i < APPS.length - 1 ? '1px solid var(--mb-divider)' : 'none' }}>
            <AppTile app={a.id} size={36} radius={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>{a.name} <span style={{ fontWeight: 400, color: 'var(--mb-ink-soft)' }}>· {a.sub}</span></div>
              <div style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>{a.tagline}</div>
            </div>
            <Pill tone="ok">Access granted</Pill>
            <Btn kind="quiet" href={a.href} style={{ color: 'var(--mb-brand)' }}>Open</Btn>
          </div>
        ))}
      </div>

      {/* security */}
      <SectionHead eyebrow="Security" title="Sign-in & sessions" />
      <div className="ws-card">
        <Row label="Google sign-in" sub="OAuth · enabled"><Pill tone="ok">Active</Pill></Row>
        <Row label="Magic-link email" sub="Passwordless sign-in via Resend"><Pill tone="ok">Enabled</Pill></Row>
        <Row label="Organizations" sub={`You belong to ${orgCount} organization${orgCount === 1 ? '' : 's'}`} last>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mb-ink-muted)' }}><Icon name="dot" size={10} />{orgName}</span>
        </Row>
      </div>
    </div>
  )
}
