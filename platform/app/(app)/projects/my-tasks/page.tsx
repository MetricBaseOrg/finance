'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { CheckSquare, Check, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_LABELS, PRIORITY_BG } from '@/lib/utils'
import { TaskDetail } from '@/components/tasks/task-detail'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SubTask {
  id: string
  title: string
  status: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  order: number
  project?: { id: string; name: string; color: string }
  assignee?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
  labels?: { id: string; name: string; color: string }[]
  subTasks?: SubTask[]
  _count?: { comments: number; subTasks: number }
}

const STATUS_BG: Record<string, string> = {
  BACKLOG:     'bg-gray-100 text-gray-600',
  TODO:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  IN_REVIEW:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  DONE:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  CANCELLED:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

export default function MyTasksPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [userRole, setUserRole] = useState<string | null>(null)

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  // Fetch user's role from their workspaces
  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/workspaces')
      .then(r => r.json())
      .then((workspaces: Array<{ myRole?: string | null }>) => {
        // Check if user is OWNER or ADMIN in any workspace
        const hasElevatedRole = workspaces.some(w => w.myRole === 'OWNER' || w.myRole === 'ADMIN')
        setUserRole(hasElevatedRole ? 'ADMIN' : 'MEMBER')
      })
      .catch(() => setUserRole('MEMBER'))
  }, [session?.user?.id])

  // Fetch tasks — include IN_REVIEW tasks for admin/owner
  useEffect(() => {
    if (!session?.user?.id) return
    const isElevated = userRole === 'ADMIN' || userRole === 'OWNER'
    const url = `/api/tasks?assigneeId=${session.user.id}${isElevated ? '&reviewTasks=true' : ''}`
    fetch(url)
      .then(r => r.json())
      .then(data => { setTasks(data); setLoading(false) })
  }, [session?.user?.id, userRole])

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false
    return true
  })

  const handleTaskUpdated = (updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
  }

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    // Only close the panel if the deleted task is the one currently open
    // (handles deleting nested subtasks without auto-closing the parent panel).
    if (taskId === selectedTaskId) setSelectedTaskId(null)
  }

  // Toggle a subtask's DONE/TODO via its checklist UI
  const handleToggleSubtask = async (parentId: string, sub: SubTask) => {
    const nextStatus = sub.status === 'DONE' ? 'TODO' : 'DONE'
    // Optimistic: update the parent's subTasks array
    setTasks(prev => prev.map(t => t.id === parentId
      ? { ...t, subTasks: t.subTasks?.map(s => s.id === sub.id ? { ...s, status: nextStatus } : s) }
      : t))
    try {
      const res = await fetch(`/api/tasks/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      // If the server auto-managed the parent, update it
      if (data.parentStatusChanged) {
        const { newStatus } = data.parentStatusChanged
        const statusLabel = newStatus === 'IN_REVIEW' ? 'In Review' : 'In Progress'
        toast.success(`Parent moved to ${statusLabel}`, { icon: '✅' })
        setTasks(prev => prev.map(t =>
          t.id === data.parentStatusChanged.id
            ? { ...t, status: newStatus }
            : t.id === parentId
              ? { ...t, subTasks: t.subTasks?.map(s => s.id === sub.id ? { ...s, status: nextStatus } : s) }
              : t
        ))
      }
    } catch {
      // Revert
      setTasks(prev => prev.map(t => t.id === parentId
        ? { ...t, subTasks: t.subTasks?.map(s => s.id === sub.id ? { ...s, status: sub.status } : s) }
        : t))
      toast.error('Failed to update subtask')
    }
  }

  // Toggle complete/incomplete via the checklist UI on each row
  const handleToggleComplete = async (task: Task) => {
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    // Optimistic
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('failed')
      if (nextStatus === 'DONE') toast.success('Task completed')
    } catch {
      // Revert
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      toast.error('Failed to update task')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-1 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
            My Tasks
          </h1>
          <p className="text-sm text-gray-3 mt-1">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="flex-1 sm:w-36 h-9 sm:h-8 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'].map(s => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="flex-1 sm:w-36 h-9 sm:h-8 text-xs">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priorities</SelectItem>
              {['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NO_PRIORITY'].map(p => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-bg-card rounded-xl border border-line">
          <CheckSquare className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-3">No tasks assigned to you</p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-line overflow-hidden">
          {/* Table header (sm+) */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_100px_120px] gap-4 px-4 py-2.5 text-xs font-semibold text-gray-3 uppercase tracking-wider border-b border-line bg-gray-50">
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Due</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.map(task => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !['DONE', 'CANCELLED'].includes(task.status)
              const isDone = task.status === 'DONE'
              const subs = task.subTasks || []
              const hasSubs = subs.length > 0
              const isExpanded = expandedTaskIds.has(task.id)
              const doneSubs = subs.filter(s => s.status === 'DONE').length
              return (
                <div key={task.id}>
                  <div
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      'flex flex-col sm:grid sm:grid-cols-[1fr_120px_100px_120px] gap-2 sm:gap-4 px-4 py-3 cursor-pointer hover:bg-bg-hover sm:items-center group active:bg-bg-hover',
                      isDone && 'opacity-60'
                    )}
                  >
                    {/* Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Expand chevron */}
                      {hasSubs ? (
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpand(task.id) }}
                          className="h-6 w-6 -ml-1 flex items-center justify-center rounded text-gray-4 hover:bg-bg-hover hover:text-gray-700 flex-shrink-0"
                          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="w-6 -ml-1 flex-shrink-0" />
                      )}
                      {/* Checklist toggle */}
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleComplete(task) }}
                        className={cn(
                          'h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          isDone
                            ? 'bg-indigo-500 border-indigo-500 text-white'
                            : 'border-gray-300 hover:border-indigo-400'
                        )}
                        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                        aria-pressed={isDone}
                      >
                        {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'text-sm font-medium truncate group-hover:text-indigo-600 transition-colors',
                            isDone
                              ? 'line-through text-gray-4'
                              : 'text-gray-1'
                          )}>
                            {task.title}
                          </p>
                          {/* "Needs review" badge for admin/owner */}
                          {task.status === 'IN_REVIEW' && (userRole === 'ADMIN' || userRole === 'OWNER') && (
                            <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 rounded-full px-2 py-0.5 flex-shrink-0">
                              Needs review
                            </span>
                          )}
                          {hasSubs && (
                            <span className="text-[10px] font-mono text-gray-3 bg-bg-hover rounded px-1.5 py-0.5 flex-shrink-0 border border-line">
                              {doneSubs}/{subs.length}
                            </span>
                          )}
                        </div>
                        {task.project && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: task.project.color }} />
                            <span className="text-xs text-gray-4">{task.project.name}</span>
                          </div>
                        )}
                      </div>
                      {/* Mobile: due date inline (right) */}
                      {task.dueDate && (
                        <span className={cn('sm:hidden text-xs flex-shrink-0 ml-2', isOverdue ? 'text-red-500 font-medium' : 'text-gray-3')}>
                          {format(new Date(task.dueDate), 'MMM d')}
                        </span>
                      )}
                    </div>
                    {/* Status / Priority badges (wrap on mobile) */}
                    <div className="flex items-center gap-2 sm:contents flex-wrap pl-4 sm:pl-0">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', STATUS_BG[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', PRIORITY_BG[task.priority])}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      {/* Show assignee for review tasks (admin/owner) */}
                      {task.status === 'IN_REVIEW' && task.assignee && task.assignee.id !== session?.user?.id && (userRole === 'ADMIN' || userRole === 'OWNER') && (
                        <span className="text-[10px] text-gray-3 bg-bg-hover rounded-full px-2 py-0.5 border border-line flex-shrink-0">
                          by {task.assignee.name || task.assignee.email || 'Unknown'}
                        </span>
                      )}
                    </div>
                    {/* Desktop-only due column */}
                    <span className={cn('hidden sm:inline text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-gray-3')}>
                      {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
                    </span>
                  </div>
                  {/* Expanded subtasks */}
                  {hasSubs && isExpanded && (
                    <div className="ml-10 pl-3 mr-4 mb-2 border-l-2 border-line py-1 space-y-0.5">
                      {subs.map(sub => {
                        const subDone = sub.status === 'DONE'
                        return (
                          <div
                            key={sub.id}
                            onClick={() => setSelectedTaskId(sub.id)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 group/sub"
                          >
                            <button
                              onClick={e => { e.stopPropagation(); handleToggleSubtask(task.id, sub) }}
                              className={cn(
                                'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                subDone
                                  ? 'bg-indigo-500 border-indigo-500 text-white'
                                  : 'border-gray-300 hover:border-indigo-400'
                              )}
                              aria-label={subDone ? 'Mark incomplete' : 'Mark complete'}
                              aria-pressed={subDone}
                            >
                              {subDone && <Check className="h-3 w-3" strokeWidth={3} />}
                            </button>
                            <span className={cn(
                              'text-sm flex-1 min-w-0 truncate',
                              subDone
                                ? 'line-through text-gray-4'
                                : 'text-gray-2 group-hover/sub:text-indigo-600'
                            )}>
                              {sub.title}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <TaskDetail
        taskId={selectedTaskId}
        initialTask={selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : undefined}
        userRole={userRole}
        currentUserId={session?.user?.id}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    </div>
  )
}
