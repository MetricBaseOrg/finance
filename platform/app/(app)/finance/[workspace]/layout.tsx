import '@/app/home/workspace.css'
import { requireMembership } from '@/server/workspace'
import { FinanceChrome } from './FinanceChrome'

// Finance adopts the new MetricBase Workspace design (bronze accent) via the
// .mb-root legacy-token bridge — re-skins the existing pages without rewriting
// each one.
export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspace: string }>
}) {
  const { workspace } = await requireMembership((await params).workspace)

  return (
    <div className="mb-root" data-app="metricbase" style={{ minHeight: '100vh' }}>
      <FinanceChrome slug={workspace.slug} orgName={workspace.name} />
      <div className="ws-page">{children}</div>
    </div>
  )
}
