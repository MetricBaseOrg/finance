'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Building2 } from 'lucide-react'

const TABS = [
  { href: '/admin', label: 'Users', icon: Users, match: (p: string) => p === '/admin' },
  { href: '/admin/orgs', label: 'Organizations', icon: Building2, match: (p: string) => p.startsWith('/admin/orgs') },
]

export function AdminTabs() {
  const pathname = usePathname()
  return (
    <div className="ws-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--mb-border)', marginBottom: 22 }}>
      {TABS.map((t) => {
        const active = t.match(pathname)
        const I = t.icon
        return (
          <Link key={t.href} href={t.href}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', padding: '10px 14px', fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? 'var(--mb-brand-ink)' : 'var(--mb-ink-muted)', borderBottom: active ? '2px solid var(--mb-brand)' : '2px solid transparent', marginBottom: -1 }}>
            <I className="h-4 w-4" />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
