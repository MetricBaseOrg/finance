import '@/app/home/workspace.css'
import { Shield } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/superadmin'
import { AdminTabs } from './AdminTabs'

// Platform-wide admin panel. Gated to super-admins (the whole subtree redirects
// to /home otherwise). Styled with the workspace design system.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin()

  return (
    <div className="mb-root" data-app="workspace" style={{ minHeight: '100vh' }}>
      <div className="ws-page" style={{ maxWidth: 980, margin: '0 auto', padding: '26px var(--ws-gutter) 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--mb-brand-soft)', color: 'var(--mb-brand-ink)' }}>
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <div className="ws-eyebrow">Platform administration</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--mb-ink)' }}>Admin</div>
          </div>
        </div>
        <AdminTabs />
        {children}
      </div>
    </div>
  )
}
