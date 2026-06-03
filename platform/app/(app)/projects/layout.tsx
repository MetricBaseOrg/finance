import '@/app/home/workspace.css'
import { requireAppAccess } from '@/lib/org'
import { ProjectsChrome } from './ProjectsChrome'

// Projects (ProBase) adopts the new Workspace design (indigo accent) via the
// Tailwind-scale bridge in workspace.css — slate/gray → surfaces/ink,
// indigo → accent, rounded corners restored.
export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAppAccess('projects')
  return (
    <div className="mb-root" data-app="probase" style={{ minHeight: '100vh' }}>
      <ProjectsChrome />
      <div>{children}</div>
    </div>
  )
}
