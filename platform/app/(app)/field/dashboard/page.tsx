import { DashboardBuilder } from '@/components/field/dashboard/DashboardBuilder'

export const dynamic = 'force-dynamic'

// Custom dashboard builder — per-user, configurable widget layouts persisted in
// UserDashboard. Distinct from /field/analytics (a fixed operational view).
export default function FieldDashboardPage() {
  return <DashboardBuilder />
}
