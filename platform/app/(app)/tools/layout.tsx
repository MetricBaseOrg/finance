import '@/app/home/workspace.css'
import { AppHeader } from '@/app/home/ui'
import { requireAppAccess } from '@/lib/org'

export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  await requireAppAccess('tools')
  return (
    <div className="mb-root" data-app="ogtools" style={{ minHeight: '100vh' }}>
      <AppHeader app="ogtools" breadcrumb="Field calculators" title="OGtools" hideTitle />
      {children}
    </div>
  )
}
