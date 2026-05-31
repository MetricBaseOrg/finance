import { DashboardBuilder } from '@/components/field/dashboard/DashboardBuilder'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

// Custom dashboard builder — workspace-shared widget layouts (UserDashboard).
// All members view; OWNER/ADMIN create and edit. Distinct from /field/analytics
// (a fixed operational view).
export default async function FieldDashboardPage() {
  const ctx = await getFieldContext()
  const canManage = ctx ? ctx.role === 'OWNER' || ctx.role === 'ADMIN' : false
  return <DashboardBuilder canManage={canManage} />
}
