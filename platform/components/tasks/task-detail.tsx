'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Calendar, Flag, User, Tag, MessageSquare, Trash2, Edit2, Check, AlertCircle, ArrowUp, ArrowDown, Minus, Plus, ListChecks, History, AtSign, GitCommitVertical, Repeat, LayoutTemplate } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AttachmentsSection } from './attachments-section'
import { DependenciesSection } from './dependencies-section'
import { AIBreakdownButton } from './ai-breakdown-button'
import { AISummarizeComments } from './ai-summarize-comments'
import { cn, STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_BG, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import toast from 'react-hot-toast'

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const
const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NO_PRIORITY'] as const

const STATUS_BG: Record<string, string> = {
  BACKLOG: 'bg-gray-100 text-gray-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  IN_REVIEW: 'bg-purple-100 text-purple-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

interface Comment {
  id: string
  content: string
  createdAt: string
  user: { id: string; name?: string | null; email?: string | null; image?: string | null }
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  order?: number
  dueDate?: string | null
  startDate?: string | null
  assignee?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
  creator?: { id: string; name?: string | null; email?: string | null }
  labels?: { id: string; name: string; color: string }[]
  comments?: Comment[]
  subTasks?: { id: string; title: string; status: string }[]
  project?: { id: string; name: string; color: string }
  milestone?: { id: string; name: string } | null
  blockedBy?: { id: string; blocker: { id: string; title: string; status: string; priority: string } }[]
  blocking?: { id: string; blocked: { id: string; title: string; status: string; priority: string } }[]
  recurrence?: string | null
  recurrenceEnd?: string | null
  recurringFromId?: string | null
}

interface TaskDetailProps {
  taskId: string | null
  // Optional parent-known task object — used as initial state to avoid a race
  // condition where a freshly-PATCHed status is overwritten by an in-flight GET.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialTask?: any
  userRole?: string | null
  currentUserId?: string | null
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdated: (task: any) => void
  onDeleted: (taskId: string) => void
  // Optional: bubble up newly-created subtasks so parent lists/boards refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onTaskCreated?: (task: any) => void
}

// Fields the parent's optimistic state is authoritative for. After a
// background refresh, we preserve the client value to avoid showing
// stale data from a GET that raced an in-flight PATCH.
const CLIENT_AUTHORITATIVE_FIELDS = [
  'status', 'priority', 'order', 'dueDate', 'startDate', 'assignee', 'assigneeId',
] as const

export function TaskDetail({ taskId, initialTask, userRole, currentUserId, onClose, onUpdated, onDeleted, onTaskCreated }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(initialTask && initialTask.id === taskId ? initialTask : null)
  const [loading, setLoading] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(initialTask?.title ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState(initialTask?.description ?? '')
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [newSubTitle, setNewSubTitle] = useState('')
  const [addingSub, setAddingSub] = useState(false)
  const [activities, setActivities] = useState<Array<{
    id: string
    kind: string
    metadata: string | null
    createdAt: string
    user: { id: string; name?: string | null; email?: string | null; image?: string | null }
  }>>([])
  const [activityOpen, setActivityOpen] = useState(false)

  // Track the taskId we last fetched for, so we re-fetch on switch but not on
  // every render. When initialTask is provided we still GET to load comments
  // and sub-tasks, but we merge so authoritative client fields aren't clobbered.
  useEffect(() => {
    if (!taskId) {
      setTask(null)
      return
    }
    // Seed with initialTask if it matches the requested id
    if (initialTask && initialTask.id === taskId) {
      setTask(initialTask)
      setTitleValue(initialTask.title || '')
      setDescValue(initialTask.description || '')
    } else {
      setTask(null)
    }
    setLoading(!initialTask || initialTask.id !== taskId)

    // Lazily fetch the activity feed in parallel
    fetch(`/api/tasks/${taskId}/activity`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setActivities)
      .catch(() => setActivities([]))

    fetch(`/api/tasks/${taskId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setTask(prev => {
          // If we have a prior (optimistic) state, preserve client-authoritative
          // fields so an in-flight PATCH that races this GET isn't undone.
          if (!prev) return data
          const merged: Record<string, unknown> = { ...data }
          for (const f of CLIENT_AUTHORITATIVE_FIELDS) {
            if (prev[f as keyof typeof prev] !== undefined) {
              merged[f] = prev[f as keyof typeof prev]
            }
          }
          return merged as unknown as Task
        })
        // Only overwrite editable text fields if the user hasn't already
        // started editing (avoids stomping in-progress edits).
        setTitleValue(prev => (prev && prev !== (initialTask?.title || '')) ? prev : data.title)
        setDescValue(prev => (prev && prev !== (initialTask?.description || '')) ? prev : (data.description || ''))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const update = async (patch: Partial<Task>, opts: { force?: boolean } = {}) => {
    if (!task) return
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, ...(opts.force && { force: true }) }),
      })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'blocked_by_dependencies') {
          const list = (data.blockers || []).map((b: { title: string }) => `• ${b.title}`).join('\n')
          const proceed = window.confirm(
            `This task is still blocked by:\n\n${list}\n\nMark complete anyway?`
          )
          if (proceed) return update(patch, { force: true })
          return
        }
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'approval_required') {
          toast.error('Only admins or owners can approve tasks from In Review to Done.')
          return
        }
        toast.error('Failed to update')
        return
      }
      if (!res.ok) {
        toast.error('Failed to update')
        return
      }
      const updated = await res.json()
      // If the server spawned a recurring follow-up, propagate it before
      // touching local state.
      if (updated.spawnedRecurring && onTaskCreated) {
        onTaskCreated(updated.spawnedRecurring)
        toast.success(`Next instance scheduled: "${updated.spawnedRecurring.title}"`, { icon: '🔁' })
      }
      // If the server auto-managed the parent, notify the user
      if (updated.parentStatusChanged) {
        const { title, newStatus } = updated.parentStatusChanged
        const statusLabel = newStatus === 'IN_REVIEW' ? 'In Review' : 'In Progress'
        toast.success(`Parent task "${title}" moved to ${statusLabel}`, { icon: '✅' })
        onUpdated(updated.parentStatusChanged)
      }
      // Strip our shipping-only field before merging into local state
      const { spawnedRecurring: _drop, parentStatusChanged: _parent, ...rest } = updated as Record<string, unknown>
      setTask(prev => prev ? { ...prev, ...rest } as Task : null)
      onUpdated(rest)
    } catch {
      toast.error('Failed to update')
    }
  }

  const handleDelete = async () => {
    if (!task || !confirm('Delete this task?')) return
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    onDeleted(task.id)
    onClose()
  }

  const handleSaveAsTemplate = async () => {
    if (!task?.project) return
    const name = window.prompt('Template name:', task.title)
    if (!name) return
    try {
      // Resolve the workspace id via the project (task.project only has id/name/color)
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'TASK',
          // organizationId is derived server-side from fromTaskId
          name,
          fromTaskId: task.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to save template'); return }
      toast.success(`Saved "${name}" as a task template`)
    } catch {
      toast.error('Failed to save template')
    }
  }

  const handleAddSubtask = async () => {
    if (!task || !newSubTitle.trim()) return
    const projectId = task.project?.id
    if (!projectId) {
      toast.error('Missing project context for subtask')
      return
    }
    setAddingSub(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSubTitle.trim(),
          projectId,
          parentId: task.id,
          status: 'TODO',
          priority: 'MEDIUM',
        }),
      })
      if (!res.ok) throw new Error('failed')
      const created = await res.json()
      const stub = { id: created.id, title: created.title, status: created.status }
      let bubbledCount = 0
      setTask(prev => {
        if (!prev) return null
        const nextSubs = [...(prev.subTasks || []), stub]
        bubbledCount = nextSubs.length
        return { ...prev, subTasks: nextSubs }
      })
      if (task) {
        onUpdated({ id: task.id, _count: { ...((task as any)._count || {}), subTasks: bubbledCount } })
      }
      // Propagate the new child task up so views can show it under its parent
      if (onTaskCreated) onTaskCreated(created)
      setNewSubTitle('')
    } catch {
      toast.error('Failed to add subtask')
    } finally {
      setAddingSub(false)
    }
  }

  const handleToggleSubtask = async (subId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE'
    // Optimistic
    setTask(prev => prev ? {
      ...prev,
      subTasks: prev.subTasks?.map(s => s.id === subId ? { ...s, status: nextStatus } : s),
    } : null)
    try {
      const res = await fetch(`/api/tasks/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      // Revert on failure
      setTask(prev => prev ? {
        ...prev,
        subTasks: prev.subTasks?.map(s => s.id === subId ? { ...s, status: currentStatus } : s),
      } : null)
      toast.error('Failed to update subtask')
    }
  }

  const handleDeleteSubtask = async (subId: string) => {
    if (!task) return
    const prevSubs = task.subTasks ?? []
    const nextSubs = prevSubs.filter(s => s.id !== subId)
    setTask(prev => prev ? { ...prev, subTasks: nextSubs } : null)
    onUpdated({ id: task.id, _count: { ...((task as any)._count || {}), subTasks: nextSubs.length } })
    try {
      const res = await fetch(`/api/tasks/${subId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      onDeleted(subId)
    } catch {
      setTask(prev => prev ? { ...prev, subTasks: prevSubs } : null)
      toast.error('Failed to delete subtask')
    }
  }

  const handleComment = async () => {
    if (!task || !comment.trim()) return
    setSubmittingComment(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment, taskId: task.id }),
      })
      const newComment = await res.json()
      setTask(prev => prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null)
      setComment('')
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (!taskId) return null

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center sm:justify-end items-end sm:items-stretch"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/40 sm:bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl h-[92dvh] sm:h-full bg-bg-card shadow-2xl overflow-y-auto flex flex-col z-50 rounded-t-2xl sm:rounded-none pb-[env(safe-area-inset-bottom)]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : task ? (
          <>
            {/* Mobile grab handle */}
            <div className="sm:hidden flex-shrink-0 pt-2 pb-1 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-gray-3" />
            </div>
            {/* Header */}
            <div className="sticky top-0 bg-bg-card border-b border-line px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-4 z-10">
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={titleValue}
                      onChange={e => setTitleValue(e.target.value)}
                      className="flex-1 text-lg font-semibold border-b-2 border-indigo-500 outline-none bg-transparent text-gray-1"
                      onBlur={() => {
                        if (titleValue.trim() && titleValue !== task.title) {
                          update({ title: titleValue })
                        }
                        setEditingTitle(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (titleValue.trim() && titleValue !== task.title) update({ title: titleValue })
                          setEditingTitle(false)
                        }
                        if (e.key === 'Escape') { setTitleValue(task.title); setEditingTitle(false) }
                      }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="text-lg font-semibold text-gray-1 hover:text-indigo-600 text-left w-full transition-colors"
                  >
                    {task.title}
                  </button>
                )}
                {task.project && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: task.project.color }} />
                    <span className="text-xs text-gray-3">{task.project.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSaveAsTemplate}
                  title="Save task as template"
                   className="text-gray-4 hover:text-indigo-600 hover:bg-bg-hover"
                >
                  <LayoutTemplate className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={handleDelete} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6">
              {/* Status + Priority row */}
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-3 mb-1.5">Status</label>
                  <Select
                    value={task.status}
                    onValueChange={v => update({ status: v })}
                    disabled={
                      task.status === 'IN_REVIEW' &&
                      userRole !== 'OWNER' && userRole !== 'ADMIN' &&
                      task.assignee?.id !== currentUserId
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => {
                        // Members can only approve (IN_REVIEW → DONE) their own tasks
                        const canApprove = task.status === 'IN_REVIEW' && s === 'DONE' &&
                          (userRole === 'OWNER' || userRole === 'ADMIN' || task.assignee?.id === currentUserId)
                        const isBlocked = task.status === 'IN_REVIEW' && s === 'DONE' && !canApprove
                        return (
                          <SelectItem key={s} value={s} disabled={isBlocked}>
                            {STATUS_LABELS[s]}{isBlocked ? ' (restricted)' : ''}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Approve button: admin/owner can approve any, member can self-approve */}
                {task.status === 'IN_REVIEW' && (
                  (userRole === 'OWNER' || userRole === 'ADMIN') ||
                  (userRole === 'MEMBER' && task.assignee?.id === currentUserId)
                ) && (
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      onClick={() => update({ status: 'DONE' })}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-3 mb-1.5">Priority</label>
                  <Select value={task.priority} onValueChange={v => update({ priority: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-3 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    defaultValue={task.startDate ? task.startDate.split('T')[0] : ''}
                    onChange={e => update({ startDate: e.target.value || null } as Partial<Task>)}
                    className="flex h-8 w-full rounded-lg border border-line bg-bg-card px-3 py-1 text-xs text-gray-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-3 mb-1.5">Due Date</label>
                  <input
                    type="date"
                    defaultValue={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={e => update({ dueDate: e.target.value || null } as Partial<Task>)}
                    className="flex h-8 w-full rounded-lg border border-line bg-bg-card px-3 py-1 text-xs text-gray-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-3 mb-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  Repeat
                </label>
                <Select
                  value={task.recurrence ?? 'NONE'}
                  onValueChange={v => update({ recurrence: (v === 'NONE' ? null : v) as never } as Partial<Task>)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Don&apos;t repeat</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                {task.recurrence && (
                  <p className="mt-1 text-[11px] text-gray-4">
                    A new instance will be created the moment this task is marked Done.
                    {!task.dueDate && (
                      <span className="block text-amber-600 dark:text-amber-400 mt-0.5">
                        Tip: set a due date so the next instance gets a sensible deadline.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                {editingDesc ? (
                  <div className="space-y-2">
                    <Textarea
                      value={descValue}
                      onChange={e => setDescValue(e.target.value)}
                      rows={4}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          update({ description: descValue })
                          setEditingDesc(false)
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setDescValue(task.description || '')
                        setEditingDesc(false)
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="w-full text-left text-sm text-gray-2 p-3 rounded-lg border border-transparent hover:border-border-str hover:bg-bg-hover transition-colors min-h-[60px]"
                  >
                    {task.description || <span className="text-gray-400 italic">Add a description...</span>}
                  </button>
                )}
              </div>

              {/* Labels */}
              {(task.labels?.length ?? 0) > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-3 mb-1.5">Labels</label>
                  <div className="flex flex-wrap gap-1.5">
                    {task.labels?.map(l => (
                      <span
                        key={l.id}
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: l.color + '20', color: l.color }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tasks */}
              {(() => {
                const subs = task.subTasks || []
                const doneCount = subs.filter(s => s.status === 'DONE').length
                const pct = subs.length > 0 ? Math.round((doneCount / subs.length) * 100) : 0
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-3">
                        <ListChecks className="h-3.5 w-3.5" />
                        Sub-tasks {subs.length > 0 && <span>({doneCount}/{subs.length})</span>}
                      </label>
                      <div className="flex items-center gap-3">
                        {task.project && (
                          <AIBreakdownButton
                            taskId={task.id}
                            projectId={task.project.id}
                            onCreated={created => {
                              const stub = { id: created.id, title: created.title, status: created.status }
                              setTask(prev => prev ? { ...prev, subTasks: [...(prev.subTasks || []), stub] } : null)
                              if (onTaskCreated) onTaskCreated(created)
                            }}
                          />
                        )}
                        {subs.length > 0 && (
                          <span className="text-xs text-gray-4">{pct}%</span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    {subs.length > 0 && (
                      <div className="mb-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {/* List */}
                    <div className="space-y-0.5">
                      {subs.map(sub => {
                        const isDone = sub.status === 'DONE'
                        return (
                          <div
                            key={sub.id}
                            className="group flex items-center gap-2.5 py-1.5 sm:py-1 px-2 rounded-lg hover:bg-bg-hover"
                          >
                            <button
                              onClick={() => handleToggleSubtask(sub.id, sub.status)}
                              className={cn(
                                'h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                isDone
                                  ? 'bg-indigo-500 border-indigo-500 text-white'
                                  : 'border-gray-3 hover:border-indigo-400'
                              )}
                              aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                              aria-pressed={isDone}
                            >
                              {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </button>
                            <span className={cn(
                              'text-sm flex-1 min-w-0 truncate',
                              isDone
                                ? 'line-through text-gray-4'
                                : 'text-gray-1'
                            )}>
                              {sub.title}
                            </span>
                            <button
                              onClick={() => handleDeleteSubtask(sub.id)}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-7 w-7 flex items-center justify-center text-gray-4 hover:text-red-500 hover:bg-red-50 rounded-md transition-opacity flex-shrink-0"
                              aria-label="Delete subtask"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {/* Add new */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-5 w-5 rounded-md border-2 border-dashed border-gray-3 flex items-center justify-center flex-shrink-0">
                        <Plus className="h-3 w-3 text-gray-400" />
                      </div>
                      <input
                        value={newSubTitle}
                        onChange={e => setNewSubTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() }
                          if (e.key === 'Escape') setNewSubTitle('')
                        }}
                        placeholder="Add a subtask…"
                        disabled={addingSub}
                        className="flex-1 bg-transparent text-sm text-gray-1 placeholder:text-gray-4 outline-none border-b border-transparent focus:border-border-str py-1 disabled:opacity-50"
                      />
                      {newSubTitle.trim() && (
                        <Button
                          size="sm"
                          onClick={handleAddSubtask}
                          disabled={addingSub}
                          className="flex-shrink-0"
                        >
                          {addingSub ? 'Adding…' : 'Add'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Dependencies */}
              {task.project && (
                <DependenciesSection
                  taskId={task.id}
                  projectId={task.project.id}
                  initial={{
                    blockedBy: task.blockedBy as never,
                    blocking: task.blocking as never,
                  }}
                />
              )}

              {/* Attachments */}
              <AttachmentsSection taskId={task.id} />

              {/* Activity */}
              {activities.length > 0 && (
                <div>
                  <button
                    onClick={() => setActivityOpen(o => !o)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-3 mb-2 hover:text-gray-2"
                    aria-expanded={activityOpen}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Activity</span>
                    <span className="text-gray-4">· {activities.length}</span>
                    <span className="ml-1 text-[10px] text-gray-4">
                      {activityOpen ? 'hide' : 'show'}
                    </span>
                  </button>
                  {activityOpen && (
                    <div className="space-y-2 border-l-2 border-line ml-1 pl-3">
                      {activities.slice(0, 30).map(a => (
                        <ActivityRow key={a.id} activity={a} />
                      ))}
                      {activities.length > 30 && (
                        <p className="text-xs text-gray-4 italic pt-1">
                          (showing 30 of {activities.length})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Comments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-3">
                    Comments ({task.comments?.length || 0})
                  </label>
                  {(task.comments?.length || 0) >= 4 && (
                    <AISummarizeComments taskId={task.id} />
                  )}
                </div>
                <div className="space-y-4">
                  {task.comments?.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={c.user.image ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(c.user.name || c.user.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-gray-1">{c.user.name || c.user.email}</span>
                          <span className="text-xs text-gray-4">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-sm text-gray-2 mt-0.5 whitespace-pre-wrap break-words">
                          <CommentBody text={c.content} />
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Write a comment… use @ to mention"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={2}
                      />
                      <Button
                        size="sm"
                        onClick={handleComment}
                        disabled={!comment.trim() || submittingComment}
                      >
                        {submittingComment ? 'Sending...' : 'Comment'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">Task not found</div>
        )}
      </div>
    </div>
  )
}

// ── @mention highlighter ─────────────────────────────────────────────────────
const MENTION_TOKEN_RE = /(@[\w.+-]+)/g
function CommentBody({ text }: { text: string }) {
  const parts = text.split(MENTION_TOKEN_RE)
  return (
    <>
      {parts.map((p, i) =>
        MENTION_TOKEN_RE.test(p)
          ? <span key={i} className="bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded px-1 py-0.5 text-[0.95em] font-medium">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// ── Activity row ─────────────────────────────────────────────────────────────
interface ActivityItem {
  id: string
  kind: string
  metadata: string | null
  createdAt: string
  user: { id: string; name?: string | null; email?: string | null; image?: string | null }
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const meta: { from?: unknown; to?: unknown; preview?: string; title?: string } = (() => {
    if (!activity.metadata) return {}
    try { return JSON.parse(activity.metadata) } catch { return {} }
  })()
  const who = activity.user.name || activity.user.email || 'Someone'
  const when = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })

  const describe = (): React.ReactNode => {
    switch (activity.kind) {
      case 'task.created':
        return <>created this task</>
      case 'status.changed':
        return <>changed status from <ValueChip>{String(meta.from)}</ValueChip> to <ValueChip>{String(meta.to)}</ValueChip></>
      case 'priority.changed':
        return <>changed priority from <ValueChip>{String(meta.from)}</ValueChip> to <ValueChip>{String(meta.to)}</ValueChip></>
      case 'title.changed':
        return <>renamed the task</>
      case 'description.changed':
        return <>updated the description</>
      case 'assignee.changed':
        return meta.to ? <>assigned the task</> : <>unassigned the task</>
      case 'due.changed':
        return <>changed due date</>
      case 'start.changed':
        return <>changed start date</>
      case 'milestone.changed':
        return <>changed milestone</>
      case 'comment.added':
        return <>commented{meta.preview ? <>: <span className="italic text-gray-2">&ldquo;{meta.preview}&rdquo;</span></> : null}</>
      case 'subtask.added':
        return <>added subtask {meta.title ? <ValueChip>{String(meta.title)}</ValueChip> : null}</>
      default:
        return <>did <ValueChip>{activity.kind}</ValueChip></>
    }
  }

  return (
    <div className="flex items-start gap-2 text-xs">
      <GitCommitVertical className="h-3.5 w-3.5 text-gray-4 flex-shrink-0 mt-0.5 -ml-[18px] bg-bg-card" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-gray-2">{who}</span>{' '}
        <span className="text-gray-3">{describe()}</span>{' '}
        <span className="text-gray-4">· {when}</span>
      </div>
    </div>
  )
}

function ValueChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-gray-100 text-gray-2 rounded px-1 py-0.5 font-mono text-[10px]">
      {children}
    </span>
  )
}
