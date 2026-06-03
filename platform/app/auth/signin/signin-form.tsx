'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import '@/app/home/workspace.css'
import { AppMark, Icon, type AppId } from '@/app/home/ui'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const APPS: { id: AppId; name: string; sub: string }[] = [
  { id: 'probase', name: 'ProBase', sub: 'Projects' },
  { id: 'metricbase', name: 'Finance', sub: 'Tracker' },
  { id: 'fieldflow', name: 'FieldFlow', sub: 'Field ops' },
  { id: 'ogtools', name: 'OGtools', sub: 'Calculators' },
]

const field: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--mb-border)',
  background: 'var(--mb-surface-2)', fontFamily: 'inherit', fontSize: 13, color: 'var(--mb-ink)', outline: 'none',
}

export function SignInForm({ suspended = false }: { suspended?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'cred' | 'magic' | 'google' | 'microsoft' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading('cred')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(null)
    if (res?.error) setError('Invalid email or password.')
    else window.location.href = '/home'
  }
  async function onMagic() {
    if (!email) { setError('Enter your email first.'); return }
    setError(null); setLoading('magic')
    await signIn('resend', { email, callbackUrl: '/home' })
  }

  return (
    <div className="mb-root" data-app="workspace" style={{ width: '100%', minHeight: '100vh', display: 'flex' }}>
      {/* Brand panel */}
      <div style={{
        flex: '1 1 52%', minWidth: 0, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(150deg, oklch(0.30 0.06 235) 0%, oklch(0.22 0.05 240) 55%, oklch(0.18 0.04 245) 100%)',
        color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px 52px',
      }} className="ws-brandpanel">
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)', backgroundSize: '46px 46px', maskImage: 'radial-gradient(ellipse 80% 80% at 30% 20%, #000, transparent 75%)' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, right: -160, top: -120, borderRadius: '50%', background: 'radial-gradient(circle, oklch(0.6 0.12 220 / 0.28), transparent 65%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <svg width="30" height="30" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" fill="none" stroke="#fff" strokeWidth="1.8" /><rect x="8.8" y="8.8" width="6.4" height="6.4" transform="rotate(45 12 12)" fill="#fff" opacity="0.46" /></svg>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.025em' }}>Metric<span style={{ opacity: 0.62 }}>Base</span></span>
          <span style={{ marginLeft: 8, fontSize: 10.5, fontFamily: 'var(--mb-font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.55, border: '1px solid rgba(255,255,255,.22)', borderRadius: 5, padding: '3px 7px' }}>Workspace</span>
        </div>
        <div style={{ position: 'relative', maxWidth: 460 }}>
          <div style={{ fontFamily: 'var(--mb-font-mono)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'oklch(0.78 0.09 220)', marginBottom: 18 }}>One sign-in · four apps</div>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0 }}>Every MetricBase tool,<br />in one workspace.</h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)', marginTop: 18, maxWidth: 420 }}>Markets, projects, field operations and engineering calculators — unified access, one identity, shared search.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 32, maxWidth: 420 }}>
            {APPS.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center' }}><AppMark app={a.id} size={18} c="#fff" /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--mb-font-mono)', letterSpacing: '0.04em' }}>
          <span>apps.metricbase.org</span><span>Bridging data and digital logic</span>
        </div>
      </div>

      {/* Form */}
      <div className="ws-formpanel" style={{ flex: '1 1 48%', minWidth: 0, padding: 32, overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <ThemeToggle className="ws-btn" />
        </div>
        <div style={{ width: 'min(380px, 100%)', margin: 'auto 0' }}>
          <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--mb-ink)', margin: 0 }}>Sign in</h2>
            <p style={{ fontSize: 13, color: 'var(--mb-ink-muted)', marginTop: 6 }}>Use your MetricBase organization account.</p>
          </div>

          {suspended && (
            <div style={{ marginBottom: 18, padding: '11px 13px', borderRadius: 9, background: 'var(--mb-bad-soft)', border: '1px solid color-mix(in oklch, var(--mb-bad) 30%, transparent)', fontSize: 12.5, color: 'var(--mb-bad-ink)', lineHeight: 1.5 }}>
              Your account has been suspended. Contact an administrator to restore access.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button className="ws-btn" disabled={loading !== null} onClick={() => { setLoading('microsoft'); signIn('microsoft-entra-id', { callbackUrl: '/home' }) }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 14px', background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--mb-ink)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" fill="#F25022" /><rect x="13" y="3" width="8" height="8" fill="#7FBA00" /><rect x="3" y="13" width="8" height="8" fill="#00A4EF" /><rect x="13" y="13" width="8" height="8" fill="#FFB900" /></svg>
              {loading === 'microsoft' ? 'Redirecting…' : 'Continue with Microsoft'}
            </button>
            <button className="ws-btn" disabled={loading !== null} onClick={() => { setLoading('google'); signIn('google', { callbackUrl: '/home' }) }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 14px', background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--mb-ink)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M21.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z" fill="#4285F4" /><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0012 22z" fill="#34A853" /><path d="M6.4 13.9a6 6 0 010-3.8V7.5H3.1a10 10 0 000 9z" fill="#FBBC05" /><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 003.1 7.5l3.3 2.6C7.2 7.7 9.4 6 12 6z" fill="#EA4335" /></svg>
              {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--mb-divider)' }} />
            <span style={{ fontSize: 10.5, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>or email</span>
            <span style={{ flex: 1, height: 1, background: 'var(--mb-divider)' }} />
          </div>

          <form onSubmit={onCredentials}>
            <label style={{ display: 'block', marginBottom: 13 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mb-ink-2)', display: 'block', marginBottom: 6 }}>Work email</span>
              <input type="email" placeholder="you@metricbase.org" style={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label style={{ display: 'block', marginBottom: 13 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mb-ink-2)', display: 'block', marginBottom: 6 }}>Password</span>
              <input type="password" placeholder="••••••••••" style={field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <p style={{ fontSize: 12, color: 'var(--mb-bad-ink)', marginBottom: 10 }}>{error}</p>}
            <button className="ws-btn" type="submit" disabled={loading !== null}
              style={{ width: '100%', marginTop: 2, background: 'var(--mb-brand)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading === 'cred' ? 'Signing in…' : <>Sign in <Icon name="arrowr" size={15} color="#fff" /></>}
            </button>
          </form>

          <button className="ws-btn" disabled={loading !== null} onClick={onMagic}
            style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--mb-ink-2)', border: '1px solid var(--mb-border)', borderRadius: 9, padding: '11px', fontSize: 12.5, fontWeight: 600 }}>
            {loading === 'magic' ? 'Sending link…' : 'Email me a magic link'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--mb-ink-soft)', textAlign: 'center', marginTop: 22, lineHeight: 1.6 }}>
            Protected by MetricBase SSO. By continuing you agree to the acceptable-use policy.
          </p>
        </div>
      </div>
    </div>
  )
}
