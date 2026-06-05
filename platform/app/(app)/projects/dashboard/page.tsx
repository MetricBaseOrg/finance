'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { format } from 'date-fns'
import { FolderKanban, CheckSquare, AlertCircle, TrendingUp, Calendar, ArrowRight, Plus } from 'lucide-react'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_BG } from '@/lib/utils'
import { PerformancePanel } from '@/components/projects/performance-panel'

interface Project {
  id: string
  name: string
  color: string
  _count: { tasks: number }
}

interface Workspace {
  id: string
  name: string
  color: string
  projects: Project[]
  _count: { projects: number; members: number }
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  project?: { id: string; name: string; color: string }
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/workspaces').then(r => r.json()),
    ]).then(([ws]) => {
      setWorkspaces(ws)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch(`/api/tasks?assigneeId=${session.user.id}`)
      .then(r => r.json())
      .then(setMyTasks)
  }, [session?.user?.id])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const rawName = session?.user?.name || session?.user?.email?.split('@')[0] || 'there'
  const firstPart = rawName.split(/[._\s]/)[0]
  const firstName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1)

  const overdueTasks = myTasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && !['DONE', 'CANCELLED'].includes(t.status)
  )
  const inProgressTasks = myTasks.filter(t => t.status === 'IN_PROGRESS')
  const allProjects = workspaces.flatMap(w => w.projects || [])
  const totalTasks = myTasks.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full min-w-0 overflow-x-hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* Greeting */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-1">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm sm:text-base text-gray-3 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: 'Total Tasks', value: totalTasks, icon: CheckSquare, iconColor: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          { label: 'In Progress', value: inProgressTasks.length, icon: TrendingUp, iconColor: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
          { label: 'Overdue', value: overdueTasks.length, icon: AlertCircle, iconColor: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
          { label: 'Projects', value: allProjects.length, icon: FolderKanban, iconColor: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
        ].map(stat => (
          <div key={stat.label} className="bg-bg-card rounded-xl border border-line p-4 sm:p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('h-4 w-4 sm:h-5 sm:w-5', stat.iconColor)} />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-gray-1">{stat.value}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-3 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Performance metrics */}
      <PerformancePanel />

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        {/* My tasks */}
        <div className="bg-bg-card rounded-xl border border-line p-4 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-1">My Tasks</h2>
            <Link href="/projects/my-tasks" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-gray-3 py-4 text-center">No tasks assigned to you</p>
          ) : (
            <div className="space-y-2">
              {myTasks.slice(0, 6).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[task.status])} />
                  <span className="text-sm text-gray-1 flex-1 min-w-0 truncate">{task.title}</span>
                  {task.dueDate && (
                    <span className={cn(
                      'text-xs flex-shrink-0 whitespace-nowrap',
                      new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                        ? 'text-red-500 font-medium'
                        : 'text-gray-3'
                    )}>
                      {format(new Date(task.dueDate), 'MMM d')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="bg-bg-card rounded-xl border border-line p-4 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-1">Projects</h2>
          </div>
          {allProjects.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-3 mb-3">No projects yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allProjects.slice(0, 6).map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: project.color }}>
                    {project.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-1 flex-1 min-w-0 truncate font-medium group-hover:text-indigo-600 transition-colors">{project.name}</span>
                  <span className="text-xs text-gray-3 flex-shrink-0 whitespace-nowrap">{project._count.tasks} tasks</span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-4 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="mt-6 bg-[rgba(212,82,74,0.08)] border border-[rgba(212,82,74,0.2)] rounded-xl p-6">
          <h2 className="font-semibold text-[var(--down)] flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4" />
            Overdue Tasks ({overdueTasks.length})
          </h2>
          <div className="space-y-2">
            {overdueTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-1">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[task.status])} />
                <span className="text-sm text-[var(--down)] font-medium flex-1 min-w-0 truncate">{task.title}</span>
                <span className="text-xs text-red-500 flex-shrink-0 whitespace-nowrap">
                  Due {format(new Date(task.dueDate!), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
