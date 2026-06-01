import { redirect } from 'next/navigation'
import { requireUser, getMemberships } from '@/lib/org'
import { createOrg } from '../(app)/actions'
import '@/app/home/workspace.css'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const APPS = [
  { label: 'ProBase', sub: 'Projects' },
  { label: 'Finance', sub: 'Tracker' },
  { label: 'FieldFlow', sub: 'Field ops' },
  { label: 'OGtools', sub: 'Calculators' },
]

const field: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--mb-border)',
  background: 'var(--mb-surface-2)', fontFamily: 'inherit', fontSize: 13,
  color: 'var(--mb-ink)', outline: 'none',
}

export default async function WelcomePage() {
  const user = await requireUser()
  const orgs = await getMemberships(user.id)
  if (orgs.length > 0) redirect('/projects')

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
              <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{a.label}</div>
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

      {/* Form panel */}
      <div className="ws-formpanel" style={{ flex: '1 1 48%', minWidth: 0, padding: 32, overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <ThemeToggle className="ws-btn" />
        </div>
        <div style={{ width: 'min(380px, 100%)', margin: 'auto 0' }}>
          <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--mb-ink)', margin: 0 }}>Create your organization</h2>
            <p style={{ fontSize: 13, color: 'var(--mb-ink-muted)', marginTop: 6 }}>One organization holds your projects, finances, and field operations.</p>
          </div>

          <form action={createOrg} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mb-ink-2)', display: 'block', marginBottom: 6 }}>Organization name</span>
              <input name="name" placeholder="Acme Energy" style={field} required />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mb-ink-2)', display: 'block', marginBottom: 6 }}>Base currency</span>
              <select name="baseCurrency" style={field} defaultValue="IDR">
                <option value="IDR">IDR — Indonesian Rupiah</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </label>
            <button
              type="submit"
              style={{ width: '100%', marginTop: 4, background: 'var(--mb-brand)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13.5, fontWeight: 700 }}
            >
              Create organization
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--mb-ink-soft)', textAlign: 'center', marginTop: 22, lineHeight: 1.6 }}>
            Signed in as {user.email}
          </p>
        </div>
      </div>
    </div>
  )
}
