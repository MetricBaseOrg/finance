import '@/app/home/workspace.css'
import { AppHeader } from '@/app/home/ui'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-root" data-app="ogtools" style={{ minHeight: '100vh' }}>
      <AppHeader app="ogtools" breadcrumb="Field calculators" title="OGtools" />
      {children}
    </div>
  )
}
