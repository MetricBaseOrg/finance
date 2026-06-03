import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { getOrgContext } from '@/lib/org'
import { APP_META, isAppId, trialState, type AppAccessId } from '@/lib/apps'
import { SUPPORT_EMAIL, SUPPORT_X, SUPPORT_X_URL } from '@/lib/support'
import { AppTile, Btn, Pill, type AppId } from '@/app/home/ui'

export const dynamic = 'force-dynamic'

// Per-app access id → the visual AppId used by AppTile (chat has no glyph).
const VISUAL: Record<AppAccessId, AppId | null> = {
  projects: 'probase', finance: 'metricbase', field: 'fieldflow', tools: 'ogtools', chat: null,
}

export default async function AccessNeededPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>
}) {
  const { app } = await searchParams
  const { activeOrg } = await getOrgContext()
  const appId = isAppId(app) ? app : null
  const meta = appId ? APP_META[appId] : null
  const trial = trialState(activeOrg.trialEndsAt)
  const visual = appId ? VISUAL[appId] : null

  const headline = trial.endsAt && !trial.onTrial ? 'Your trial has ended' : 'Access needed'
  const sub = trial.endsAt
    ? trial.onTrial
      ? `Your free trial ends in ${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'}.`
      : `Your free trial ended on ${trial.endsAt.toLocaleDateString()}.`
    : 'This app is not part of your current access.'

  const mailSubject = encodeURIComponent(
    `App access request — ${meta?.name ?? 'MetricBase Apps'} (${activeOrg.name})`,
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px var(--ws-gutter) 60px' }} className="ws-fade">
      <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mb-ink-muted)', textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
      </Link>

      <div className="ws-card" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {visual
            ? <AppTile app={visual} size={52} radius={14} />
            : <span style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--mb-brand-soft)', color: 'var(--mb-brand-ink)', fontSize: 20, fontWeight: 800 }}>{meta?.name?.[0] ?? 'M'}</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Pill tone={trial.onTrial ? 'info' : 'warn'} dot={false}>
            {trial.onTrial ? `Trial · ${trial.daysLeft}d left` : 'Locked'}
          </Pill>
        </div>

        <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--mb-ink)', margin: '0 0 8px' }}>
          {headline}
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--mb-ink-muted)', lineHeight: 1.6, margin: '0 auto 4px', maxWidth: 420 }}>
          {meta ? <><strong style={{ color: 'var(--mb-ink-2)' }}>{meta.name}</strong> isn’t available on your account. </> : null}
          {sub}
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--mb-ink-muted)', lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 420 }}>
          Contact <strong style={{ color: 'var(--mb-ink-2)' }}>Bun</strong> to request access or pay for it.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn kind="primary" href={`mailto:${SUPPORT_EMAIL}?subject=${mailSubject}`}>
            <Mail className="h-4 w-4" /> Email {SUPPORT_EMAIL}
          </Btn>
          <Btn kind="ghost" href={SUPPORT_X_URL}>
            DM {SUPPORT_X} on X
          </Btn>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--mb-divider)' }}>
          <Link href="/settings" style={{ fontSize: 12, color: 'var(--mb-brand)', textDecoration: 'none' }}>
            View your app access in Settings →
          </Link>
        </div>
      </div>
    </div>
  )
}
