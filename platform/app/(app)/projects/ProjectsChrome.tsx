'use client'

import { usePathname } from 'next/navigation'
import { AppHeader } from '@/app/home/ui'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', href: '/projects/dashboard' },
  { id: 'projects', label: 'Projects', href: '/projects' },
  { id: 'my-tasks', label: 'My Tasks', href: '/projects/my-tasks' },
  { id: 'members', label: 'Members', href: '/projects/members' },
]

export function ProjectsChrome() {
  const pathname = usePathname()
  const active =
    pathname.startsWith('/projects/dashboard') ? 'dashboard'
      : pathname.startsWith('/projects/my-tasks') ? 'my-tasks'
        : pathname.startsWith('/projects/members') ? 'members'
          : 'projects'

  return <AppHeader app="probase" breadcrumb="Project delivery" title="ProBase" tabs={TABS} active={active} />
}
