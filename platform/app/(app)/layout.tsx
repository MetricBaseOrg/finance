import '@/app/home/workspace.css'
import { getOrgContext } from '@/lib/org'
import { WorkspaceTopBar } from './_components/workspace-topbar'
import { GlobalSearch } from '@/components/search/global-search'

// Unified workspace shell: a single top bar (logo→Home, app switcher, org
// switcher, notifications, theme, account) across every module.
// The shell uses a fixed-height flex container so the WorkspaceTopBar
// never moves. Scrolling is isolated to the <main> area below it.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, orgs, activeOrg } = await getOrgContext()

  return (
    <div className="mb-root" data-app="workspace" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <WorkspaceTopBar user={user} orgs={orgs} activeOrgId={activeOrg.id} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{children}</main>
      <GlobalSearch />
    </div>
  )
}
