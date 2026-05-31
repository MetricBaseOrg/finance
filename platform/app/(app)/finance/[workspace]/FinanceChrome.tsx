'use client'

import { usePathname } from 'next/navigation'
import { AppHeader } from '@/app/home/ui'

export function FinanceChrome({ slug, orgName }: { slug: string; orgName: string }) {
  const pathname = usePathname()
  const base = `/finance/${slug}`
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', href: `${base}/dashboard` },
    { id: 'accounts', label: 'Accounts', href: `${base}/accounts` },
    { id: 'transactions', label: 'Transactions', href: `${base}/transactions` },
    { id: 'budgets', label: 'Budgets', href: `${base}/budgets` },
    { id: 'recurring', label: 'Recurring', href: `${base}/recurring` },
    { id: 'investments', label: 'Investments', href: `${base}/investments` },
    { id: 'projects', label: 'Projects', href: `${base}/projects` },
    { id: 'reports', label: 'Reports', href: `${base}/reports` },
    { id: 'settings', label: 'Settings', href: `${base}/settings/categories` },
  ]
  const active =
    [...tabs].reverse().find((t) => pathname.startsWith(t.id === 'settings' ? `${base}/settings` : t.href))?.id ||
    'dashboard'

  return <AppHeader app="metricbase" breadcrumb={`Finance · ${orgName}`} title="Finance" tabs={tabs} active={active} />
}
