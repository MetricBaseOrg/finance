import Link from 'next/link'
import '@/app/home/workspace.css'

export const metadata = { title: 'Check your email · MetricBase' }

export default function VerifyPage() {
  return (
    <div
      className="mb-root"
      data-app="workspace"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div className="ws-card" style={{ width: 'min(420px, 100%)', padding: 32, textAlign: 'center' }}>
        {/* mail glyph in a soft brand tile */}
        <div style={{ width: 52, height: 52, margin: '0 auto 18px', borderRadius: 14, background: 'var(--mb-brand-soft)', display: 'grid', placeItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mb-brand-ink)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </div>

        <div className="ws-eyebrow" style={{ justifyContent: 'center', display: 'flex', marginBottom: 10 }}>One sign-in · four apps</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--mb-ink)', margin: 0 }}>Check your email</h1>
        <p style={{ fontSize: 13, color: 'var(--mb-ink-muted)', marginTop: 8, lineHeight: 1.6 }}>
          A magic sign-in link is on its way. Open it on this device to continue into your MetricBase workspace.
        </p>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--mb-divider)' }}>
          <p style={{ fontSize: 11.5, color: 'var(--mb-ink-soft)', lineHeight: 1.6 }}>
            Didn’t get it? Check spam, or
            {' '}
            <Link href="/auth/signin" style={{ color: 'var(--mb-brand)', fontWeight: 600, textDecoration: 'none' }}>try another way to sign in</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
