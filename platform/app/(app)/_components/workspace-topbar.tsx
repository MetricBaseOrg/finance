'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LogOut, Grip, Search } from 'lucide-react'
import { AppMark, AppTile, type AppId } from '@/app/home/ui'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { setActiveOrg, signOutAction } from '../actions'
import type { OrgSummary, SessionUser } from '@/lib/org'

const APPS: { id: AppId | 'workspace'; name: string; sub: string; href: string }[] = [
  { id: 'workspace', name: 'Workspace', sub: 'Home', href: '/home' },
  { id: 'probase', name: 'ProBase', sub: 'Projects', href: '/projects' },
  { id: 'metricbase', name: 'Finance', sub: 'Tracker', href: '/finance' },
  { id: 'fieldflow', name: 'FieldFlow', sub: 'Field ops', href: '/field' },
  { id: 'ogtools', name: 'OGtools', sub: 'Calculators', href: '/tools' },
]

function currentApp(pathname: string): typeof APPS[number] {
  if (pathname.startsWith('/projects')) return APPS[1]
  if (pathname.startsWith('/finance')) return APPS[2]
  if (pathname.startsWith('/field')) return APPS[3]
  if (pathname.startsWith('/tools')) return APPS[4]
  return APPS[0]
}

export function WorkspaceTopBar({ user, orgs, activeOrgId }: {
  user: SessionUser; orgs: OrgSummary[]; activeOrgId: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const cur = currentApp(pathname)
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()
  const logoColor = cur.id === 'workspace' ? 'var(--mb-brand)' : `var(--c-${cur.id})`

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as any)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <header className="ws-topbar">
      {/* logo → home */}
      <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
        <svg width={22} height={22} viewBox="0 0 24 24" aria-label="MetricBase">
          <rect x="5.4" y="5.4" width="13.2" height="13.2" transform="rotate(45 12 12)" fill="none" stroke={logoColor} strokeWidth="1.7" />
          <rect x="9.2" y="9.2" width="5.6" height="5.6" transform="rotate(45 12 12)" fill={logoColor} opacity="0.42" />
        </svg>
        <span className="ws-brandtext" style={{ fontWeight: 800, letterSpacing: '-0.025em', fontSize: 15, color: 'var(--mb-ink)' }}>
          Metric<span style={{ color: logoColor }}>Base</span>
        </span>
      </Link>

      {/* app switcher */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button className="ws-btn" onClick={() => setOpen((o) => !o)} title="Switch app"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', borderRadius: 8, padding: '6px 9px', color: 'var(--mb-ink)' }}>
          <Grip className="h-4 w-4" style={{ color: 'var(--mb-ink-muted)' }} />
          {cur.id !== 'workspace' && <AppMark app={cur.id as AppId} size={15} />}
          <span className="ws-applabel" style={{ fontSize: 12.5, fontWeight: 700 }}>{cur.id === 'workspace' ? 'Workspace' : cur.name}</span>
          <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--mb-ink-soft)' }} />
        </button>
        {open && (
          <div className="ws-card" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 248, padding: 6, zIndex: 40 }}>
            {APPS.map((a) => {
              const active = a.id === cur.id
              return (
                <Link key={a.id} href={a.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 8, textDecoration: 'none', background: active ? 'var(--mb-surface-2)' : 'transparent' }}>
                  {a.id === 'workspace'
                    ? <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', border: '1px solid var(--mb-border)' }}><Grip className="h-4 w-4" style={{ color: 'var(--mb-ink-muted)' }} /></span>
                    : <AppTile app={a.id as AppId} size={28} radius={8} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mb-ink)' }}>{a.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{a.sub}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Global search trigger */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
        className="ws-btn"
        title="Search everything (⌘K)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          border: '1px solid var(--mb-border)',
          background: 'var(--mb-surface)',
          borderRadius: 8,
          padding: '6px 10px',
          color: 'var(--mb-ink-muted)',
          fontSize: 12.5,
          marginLeft: 4,
        }}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden lg:inline-block text-[10px] font-mono opacity-60 border rounded px-1.5 py-px" style={{ borderColor: 'var(--mb-border)' }}>
          ⌘K
        </kbd>
      </button>

      <div style={{ flex: 1 }} />

      {/* org switcher */}
      <div className="ws-orgswitch" style={{ position: 'relative' }}>
        <select
          value={activeOrgId}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value
            const next = orgs.find((o) => o.id === id)
            startTransition(async () => {
              await setActiveOrg(id)
              if (next && pathname.startsWith('/finance/')) window.location.href = `/finance/${next.slug}/dashboard`
              else window.location.reload()
            })
          }}
          style={{ appearance: 'none', border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', color: 'var(--mb-ink)', borderRadius: 8, padding: '6px 26px 6px 10px', fontSize: 12.5, fontWeight: 600, maxWidth: 180 }}
          aria-label="Organization"
        >
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <ChevronDown className="h-3.5 w-3.5" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--mb-ink-soft)', pointerEvents: 'none' }} />
      </div>

      <NotificationBell className="ws-iconbtn" />
      <ThemeToggle className="ws-iconbtn" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href="/settings" title="Account & settings" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--mb-brand)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>{initials}</Link>
        <button className="ws-iconbtn" title="Sign out" onClick={() => startTransition(() => signOutAction())}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
