'use client'

import { createOrg } from '../(app)/actions'
import '@/app/home/workspace.css'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const field: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--mb-border)',
  background: 'var(--mb-surface-2)', fontFamily: 'inherit', fontSize: 13, color: 'var(--mb-ink)', outline: 'none',
}

export function WelcomeForm() {
  return (
    <div className="mb-root" data-app="workspace" style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <ThemeToggle className="ws-btn" />
      </div>

      <div style={{ width: 'min(380px, 100%)', background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', borderRadius: 14, padding: '36px 32px' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
            <svg width="30" height="30" viewBox="0 0 24 24">
              <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" fill="none" stroke="var(--mb-brand)" strokeWidth="1.8" />
              <rect x="8.8" y="8.8" width="6.4" height="6.4" transform="rotate(45 12 12)" fill="var(--mb-brand)" opacity="0.46" />
            </svg>
            <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.025em', color: 'var(--mb-ink)' }}>Metric<span style={{ color: 'var(--mb-brand)' }}>Base</span></span>
            <span style={{ marginLeft: 4, fontSize: 10.5, fontFamily: 'var(--mb-font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.55, border: '1px solid var(--mb-border)', borderRadius: 5, padding: '3px 7px', color: 'var(--mb-ink-muted)' }}>Workspace</span>
          </div>
          <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--mb-ink)', margin: 0 }}>Create your organization</h2>
          <p style={{ fontSize: 13, color: 'var(--mb-ink-muted)', marginTop: 6 }}>One organization holds your projects, finances, and field operations.</p>
        </div>

        <form action={createOrg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mb-ink-2)', display: 'block', marginBottom: 6 }}>Organization name</span>
            <input name="name" placeholder="Acme Energy" style={field} required />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mb-ink-2)', display: 'block', marginBottom: 6 }}>Base currency</span>
            <select name="baseCurrency" style={{ ...field, cursor: 'pointer' }} defaultValue="IDR">
              <option value="IDR">IDR — Indonesian Rupiah</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </label>
          <button className="ws-btn" type="submit"
            style={{ width: '100%', marginTop: 2, background: 'var(--mb-brand)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13.5, fontWeight: 700 }}>
            Create organization
          </button>
        </form>

        <p style={{ fontSize: 11, color: 'var(--mb-ink-soft)', textAlign: 'center', marginTop: 22, lineHeight: 1.6 }}>
          Protected by MetricBase SSO. By continuing you agree to the acceptable-use policy.
        </p>
      </div>
    </div>
  )
}
