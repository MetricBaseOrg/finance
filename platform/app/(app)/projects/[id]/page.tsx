'use client'
import { useState, useEffect, useCallback, use, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import {
  LayoutList, Kanban, Calendar, BarChart2,
  Settings, Plus, Users, Flag, MoreHorizontal, TrendingUp, LayoutTemplate,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/tasks/kanban-board'
import { TaskListView } from '@/components/tasks/task-list-view'
import { CalendarView } from '@/components/tasks/calendar-view'
import { TimelineView } from '@/components/tasks/timeline-view'
import { SCurveView } from '@/components/tasks/s-curve-view'
import { TaskDetail } from '@/components/tasks/task-detail'
import { ProjectFinanceCard } from '@/components/projects/project-finance-card'
import { NewTaskDialog } from '@/components/tasks/new-task-dialog'
import toast from 'react-hot-toast'

type View = 'list' | 'kanban' | 'calendar' | 'timeline' | 'scurve'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  order: number
  parentId?: string | null
  dueDate?: string | null
  startDate?: string | null
  recurrence?: string | null
  recurrenceEnd?: string | null
  assignee?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
  labels?: { id: string; name: string; color: string }[]
  blockedBy?: { id: string; blocker: { id: string; title?: string; status?: string } }[]
  _count?: { comments: number; subTasks: number }
}

interface Project {
  id: string
  name: string
  color: string
  description?: string | null
  tasks: Task[]
  workspace: {
    id: string
    name: string
    members: { id: string; role: string; user: { id: string; name?: string | null; email?: string | null; image?: string | null } }[]
  }
  milestones: { id: string; name: string; dueDate?: string | null }[]
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('kanban')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState('TODO')
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        console.error('Failed to load project', res.status, errBody)
        toast.error(errBody?.error || 'Failed to load project')
        setProject(null)
        setTasks([])
        return
      }
      const data = await res.json()
      setProject(data)
      setTasks(data.tasks || [])
    } catch (err) {
      console.error('Project fetch error', err)
      toast.error('Failed to load project')
      setProject(null)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchProject() }, [fetchProject])

  const handleNewTask = (status = 'TODO') => {
    setNewTaskStatus(status)
    setShowNewTask(true)
  }

  const handleSaveAsTemplate = async () => {
    if (!project) return
    const name = window.prompt('Template name:', project.name)
    if (!name) return
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'PROJECT',
          organizationId: project.workspace.id,
          name,
          fromProjectId: project.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to save template'); return }
      toast.success(`Saved "${name}" as a project template`)
    } catch {
      toast.error('Failed to save template')
    }
  }

  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [...prev, task])
    toast.success('Task created!')
  }

  const handleTaskUpdated = (updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
  }

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toast.success('Task deleted')
  }

  const parentTasks = tasks.filter(t => !t.parentId)
  const doneCount = parentTasks.filter(t => t.status === 'DONE').length
  const progress = parentTasks.length > 0 ? Math.round((doneCount / parentTasks.length) * 100) : 0

  // Derive the user's role from the project's workspace members payload.
  const myRole = useMemo(() => {
    if (!project || !currentUserId) return null
    return project.workspace.members.find(m => m.user.id === currentUserId)?.role ?? null
  }, [project, currentUserId])
  const canEdit = myRole === 'OWNER' || myRole === 'ADMIN' || myRole === 'MEMBER'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-gray-4">
        Project not found
      </div>
    )
  }

  const views = [
    { id: 'list'     as View, label: 'List',     icon: LayoutList },
    { id: 'kanban'   as View, label: 'Board',    icon: Kanban },
    { id: 'calendar' as View, label: 'Calendar', icon: Calendar },
    { id: 'timeline' as View, label: 'Timeline', icon: BarChart2 },
    { id: 'scurve'   as View, label: 'S-curve',  icon: TrendingUp },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Project header */}
      <div className="flex-shrink-0 bg-bg-card border-b border-line px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0"
              style={{ backgroundColor: project.color }}
            >
              {project.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-1 truncate">{project.name}</h1>
              {project.description && (
                <p className="hidden sm:block text-sm text-gray-3 mt-0.5 truncate">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex -space-x-2">
                {project.workspace.members.slice(0, 4).map(m => (
                  <UserAvatar
                      key={m.id}
                      user={m.user}
                      className="w-7 h-7 border-2 border-white"
                    />
                ))}
              </div>
              <span className="text-xs text-gray-3">{project.workspace.members.length} member{project.workspace.members.length !== 1 ? 's' : ''}</span>
            </div>
            {canEdit && (
              <button
                onClick={handleSaveAsTemplate}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-bg-hover hover:text-gray-700"
                title="Save this project as a template"
                aria-label="Save as template"
              >
                <LayoutTemplate className="h-4 w-4" />
              </button>
            )}
            {canEdit && (
              <Button onClick={() => handleNewTask()} size="sm">
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">New Task</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {parentTasks.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: project.color }}
              />
            </div>
            <span className="text-xs text-gray-3 flex-shrink-0">
              {doneCount}/{parentTasks.length} done ({progress}%)
            </span>
          </div>
        )}

        {/* View switcher */}
        <div className="flex items-center gap-1 mt-3 sm:mt-4 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-none">
          {views.map(({ id: vid, label, icon: Icon }) => (
            <button
              key={vid}
              onClick={() => setView(vid)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 min-h-[40px]',
                view === vid
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-500 hover:bg-bg-hover hover:text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mb-4 max-w-md">
          <ProjectFinanceCard projectId={id} />
        </div>
        {view === 'kanban' && (
          <KanbanBoard
            tasks={tasks}
            expandedTaskIds={expandedTaskIds}
            onToggleExpand={toggleExpand}
            onTaskClick={setSelectedTaskId}
            onNewTask={handleNewTask}
            onTasksChanged={setTasks as unknown as (t: never[]) => void}
          />
        )}
        {view === 'list' && (
           <div className="bg-bg-card rounded-xl border border-line overflow-hidden">
            <TaskListView
              tasks={tasks}
              expandedTaskIds={expandedTaskIds}
              onToggleExpand={toggleExpand}
              onTaskClick={setSelectedTaskId}
              onNewTask={handleNewTask}
              onTasksChanged={setTasks as unknown as (t: never[]) => void}
            />
          </div>
        )}
        {view === 'calendar' && (
          <CalendarView
            tasks={tasks}
            onTaskClick={setSelectedTaskId}
          />
        )}
        {view === 'timeline' && (
          <TimelineView
            tasks={tasks}
            expandedTaskIds={expandedTaskIds}
            onToggleExpand={toggleExpand}
            onTaskClick={setSelectedTaskId}
            onTasksChanged={setTasks as unknown as (t: never[]) => void}
          />
        )}
        {view === 'scurve' && (
          <SCurveView projectId={id} />
        )}
      </div>

      {/* Task detail panel */}
      <TaskDetail
        taskId={selectedTaskId}
        initialTask={selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : undefined}
        userRole={myRole}
        currentUserId={currentUserId}
        members={project?.workspace.members}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
        onTaskCreated={(t) => setTasks(prev => [...prev, t])}
      />

      {/* New task dialog */}
      <NewTaskDialog
        open={showNewTask}
        onOpenChange={setShowNewTask}
        projectId={id}
        organizationId={project.workspace.id}
        defaultStatus={newTaskStatus}
        members={project.workspace.members}
        userRole={myRole}
        currentUserId={currentUserId}
        onCreated={handleTaskCreated}
      />
    </div>
  )
}
