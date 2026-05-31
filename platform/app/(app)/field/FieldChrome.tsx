'use client'

import { usePathname } from 'next/navigation'
import { AppHeader } from '@/app/home/ui'

const TABS = [
  { id: 'overview', label: 'Overview', href: '/field' },
  { id: 'dashboard', label: 'Dashboard', href: '/field/dashboard' },
  { id: 'analytics', label: 'Analytics', href: '/field/analytics' },
  { id: 'nodes', label: 'Nodes', href: '/field/nodes' },
  { id: 'flow-log', label: 'Flow Log', href: '/field/flow-log' },
  { id: 'liftings', label: 'Liftings', href: '/field/liftings' },
  { id: 'transfers', label: 'Transfers', href: '/field/transfers' },
  { id: 'targets', label: 'Targets', href: '/field/targets' },
  { id: 'formulas', label: 'Formulas', href: '/field/formulas' },
  { id: 'reports', label: 'Reports', href: '/field/reports' },
  { id: 'data', label: 'Data', href: '/field/data' },
  { id: 'audit', label: 'Audit', href: '/field/audit' },
]

export function FieldChrome() {
  const pathname = usePathname()
  // longest-matching segment wins so /field/flow-log doesn't match /field
  const active =
    [...TABS].reverse().find((t) => t.href !== '/field' && pathname.startsWith(t.href))?.id ||
    'overview'

  return (
    <AppHeader
      app="fieldflow"
      breadcrumb="Field operations"
      title="FieldFlow"
      tabs={TABS}
      active={active}
      hideTitle
    />
  )
}
