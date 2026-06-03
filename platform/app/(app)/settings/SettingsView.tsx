'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { AppTile, Pill, SectionHead, Btn, Icon, type AppId } from '@/app/home/ui'
import { APP_IDS, APP_META, canAccessApp, trialState, type AppAccessId } from '@/lib/apps'
import { SUPPORT_EMAIL, SUPPORT_X, SUPPORT_X_URL } from '@/lib/support'

// Per-app access id → visual AppId for AppTile (chat has no glyph → icon tile).
const APP_VISUAL: Record<AppAccessId, AppId | null> = {
  projects: 'probase', finance: 'metricbase', field: 'fieldflow', tools: 'ogtools', chat: null,
}
const APP_TAGLINE: Record<AppAccessId, string> = {
  projects: 'Plan, schedule & track delivery',
  finance: 'Multi-currency books, P&L & balance sheet',
  field: 'Crude production, lifting & dispatch',
  tools: 'Oilfield engineering calculators',
  chat: 'Team channels & direct messages',
}

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

export function SettingsView({ role, orgName, orgCount, appAccess, trialEndsAt, isSuperAdmin, profileForm, telegramConnect, changePasswordForm }: {
  userName?: string; email?: string; role: string; orgName: string; orgCount: number
  appAccess: string[]; trialEndsAt: string | null; isSuperAdmin: boolean
  profileForm?: React.ReactNode; telegramConnect?: React.ReactNode; changePasswordForm?: React.ReactNode
}) {
  const [notif, setNotif] = useState(true)
  const [digest, setDigest] = useState(false)
  const trial = trialState(trialEndsAt)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px var(--ws-gutter) 60px' }} className="ws-fade">
      <div style={{ marginBottom: 18 }}>
        <div className="ws-eyebrow" style={{ marginBottom: 6 }}>Workspace · Account</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--mb-ink)', margin: 0 }}>Account &amp; settings</h1>
      </div>

      {/* profile (editable) */}
      <SectionHead eyebrow="Profile" title="Your profile" sub={`${role} · ${orgName}`} />
      {profileForm}

      {/* telegram bot */}
      {telegramConnect && (
        <>
          <SectionHead eyebrow="Integrations" title="Telegram bot" sub="Link your Telegram to use the bot with your workspace role" />
          {telegramConnect}
        </>
      )}

      {/* preferences */}
      <SectionHead eyebrow="Preferences" title="Notifications" />
      <div className="ws-card" style={{ marginBottom: 18 }}>
        <Row label="Email notifications" sub="Task assignments and alerts across all apps"><Toggle on={notif} onChange={setNotif} /></Row>
        <Row label="Daily digest" sub="A morning summary of cross-app activity" last><Toggle on={digest} onChange={setDigest} /></Row>
      </div>

      {/* connected apps + trial / access status */}
      <SectionHead eyebrow="Access" title="Connected apps" sub="Your app access in this workspace" />

      {/* trial / contact banner */}
      <div className="ws-card" style={{ marginBottom: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mb-ink)' }}>
            {isSuperAdmin
              ? 'Full platform access'
              : trial.onTrial
                ? `Free trial — ${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left`
                : 'Trial ended'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mb-ink-muted)', marginTop: 2 }}>
            {isSuperAdmin
              ? 'You can open every app.'
              : trial.onTrial
                ? `All apps are unlocked until your trial ends${trial.endsAt ? ` on ${trial.endsAt.toLocaleDateString()}` : ''}.`
                : 'Contact Bun to request access or pay for the apps you need.'}
          </div>
        </div>
        {!isSuperAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn kind="soft" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`App access request (${orgName})`)}`}>{SUPPORT_EMAIL}</Btn>
            <Btn kind="quiet" href={SUPPORT_X_URL} style={{ color: 'var(--mb-brand)' }}>{SUPPORT_X} on X</Btn>
          </div>
        )}
      </div>

      <div className="ws-card" style={{ marginBottom: 18 }}>
        {APP_IDS.map((id, i) => {
          const meta = APP_META[id]
          const visual = APP_VISUAL[id]
          const granted = isSuperAdmin || appAccess.includes(id)
          const allowed = canAccessApp(id, { appAccess, trialEndsAt, isSuperAdmin })
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', borderBottom: i < APP_IDS.length - 1 ? '1px solid var(--mb-divider)' : 'none' }}>
              {visual
                ? <AppTile app={visual} size={36} radius={10} />
                : <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--mb-surface-2)', border: '1px solid var(--mb-border)', color: 'var(--mb-ink-muted)' }}><MessageSquare className="h-4 w-4" /></span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>{meta.name} <span style={{ fontWeight: 400, color: 'var(--mb-ink-soft)' }}>· {meta.sub}</span></div>
                <div style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>{APP_TAGLINE[id]}</div>
              </div>
              {granted ? (
                <Pill tone="ok">Granted</Pill>
              ) : allowed ? (
                <Pill tone="info">Trial</Pill>
              ) : (
                <Pill tone="warn">Locked</Pill>
              )}
              {allowed ? (
                <Btn kind="quiet" href={meta.href} style={{ color: 'var(--mb-brand)' }}>Open</Btn>
              ) : (
                <Btn kind="quiet" href={`/access?app=${id}`} style={{ color: 'var(--mb-brand)' }}>Request</Btn>
              )}
            </div>
          )
        })}
      </div>

      {/* team / agents */}
      <SectionHead eyebrow="Team" title="AI agents" sub="AI members that act on tasks and in chat for this workspace" />
      <div className="ws-card" style={{ marginBottom: 18 }}>
        <Row
          label="AI agents"
          sub={role === 'OWNER' || role === 'ADMIN' ? 'Create, configure & manage agents' : 'View the workspace agents'}
          last
        >
          <Btn kind="quiet" href="/settings/agents" style={{ color: 'var(--mb-brand)' }}>Manage</Btn>
        </Row>
      </div>

      {/* security */}
      <SectionHead eyebrow="Security" title="Sign-in & sessions" />
      <div className="ws-card" style={{ marginBottom: 18 }}>
        <Row label="Google sign-in" sub="OAuth · enabled"><Pill tone="ok">Active</Pill></Row>
        <Row label="Magic-link email" sub="Passwordless sign-in via Resend"><Pill tone="ok">Enabled</Pill></Row>
        <Row label="Organizations" sub={`You belong to ${orgCount} organization${orgCount === 1 ? '' : 's'}`} last>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mb-ink-muted)' }}><Icon name="dot" size={10} />{orgName}</span>
        </Row>
      </div>

      {changePasswordForm && (
        <>
          <SectionHead eyebrow="Security" title="Password" sub="Set a password to sign in with your email and password" />
          {changePasswordForm}
        </>
      )}
    </div>
  )
}
