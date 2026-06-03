import '@/app/home/workspace.css'
import { requireAppAccess } from '@/lib/org'
import { FieldChrome } from './FieldChrome'

// Field module adopts the new MetricBase Workspace design (OKLCH, Plus Jakarta,
// teal accent). Scoped under .mb-root[data-app=fieldflow] so the new tokens
// only apply here.
export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  await requireAppAccess('field')
  return (
    <div className="mb-root" data-app="fieldflow" style={{ minHeight: '100vh' }}>
      <FieldChrome />
      <div className="ws-page">{children}</div>
    </div>
  )
}
