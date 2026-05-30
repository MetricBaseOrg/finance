'use client'

import { format } from 'date-fns'
import { AlertCircle, ArrowUp, ArrowDown, Minus, Flag, Calendar, ChevronDown, ChevronRight, Check, GripVertical } from 'lucide-react'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_LABELS, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STATUS_ORDER = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']

const STATUS_BG: Record<string, string> = {
  BACKLOG:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  TODO:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  IN_REVIEW:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  DONE:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  CANCELLED:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const PRIORITY_ICONS = {
  URGENT:      <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  HIGH:        <ArrowUp className="h-3.5 w-3.5 text-orange-500" />,
  MEDIUM:      <Minus className="h-3.5 w-3.5 text-yellow-500" />,
  LOW:         <ArrowDown className="h-3.5 w-3.5 text-blue-500" />,
  NO_PRIORITY: <Flag className="h-3.5 w-3.5 text-gray-400" />,
}

const PRIORITY_BG: Record<string, string> = {
  URGENT:      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  HIGH:        'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  MEDIUM:      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  LOW:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  NO_PRIORITY: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  order?: number
  parentId?: string | null
  dueDate?: string | null
  assignee?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
  labels?: { id: string; name: string; color: string }[]
  _count?: { comments: number; subTasks: number }
}

interface TaskListViewProps {
  tasks: Task[]
  expandedTaskIds?: Set<string>
  onToggleExpand?: (taskId: string) => void
  onTaskClick: (taskId: string) => void
  onNewTask: (status?: string) => void
  onTasksChanged?: (tasks: Task[]) => void
}

export function TaskListView({
  tasks,
  expandedTaskIds,
  onToggleExpand,
  onTaskClick,
  onNewTask,
  onTasksChanged,
}: TaskListViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const expanded = expandedTaskIds ?? new Set<string>()
  const toggleExpand = onToggleExpand ?? (() => {})

  // Local order overrides (keyed by task id) so reordering survives parent re-renders/refetches
  const [localOrderOverrides, setLocalOrderOverrides] = useState<Record<string, number>>({})

  // Refs for drag handler (latest data)
  const tasksRef = useRef(tasks)
  const onTasksChangedRef = useRef(onTasksChanged)
  const localOrderOverridesRef = useRef(localOrderOverrides)

  useEffect(() => {
    tasksRef.current = tasks
    onTasksChangedRef.current = onTasksChanged
    localOrderOverridesRef.current = localOrderOverrides
  }, [tasks, onTasksChanged, localOrderOverrides])

  // Merge server tasks with local order overrides
  const effectiveTasks = useMemo(() => {
    return tasks.map(t => {
      if (localOrderOverrides[t.id] !== undefined) {
        return { ...t, order: localOrderOverrides[t.id] }
      }
      return t
    })
  }, [tasks, localOrderOverrides])

  // Only parents appear as top-level rows (using effective order)
  const parentTasks = effectiveTasks.filter(t => !t.parentId)

  const childrenByParent: Record<string, Task[]> = {}
  for (const t of tasks) {
    if (t.parentId) {
      if (!childrenByParent[t.parentId]) childrenByParent[t.parentId] = []
      childrenByParent[t.parentId].push(t)
    }
  }

  const handleToggleSubtask = async (sub: Task) => {
    if (!onTasksChanged) return
    const next = sub.status === 'DONE' ? 'TODO' : 'DONE'
    onTasksChanged(tasks.map(t => t.id === sub.id ? { ...t, status: next } : t))
    try {
      const res = await fetch(`/api/tasks/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      // If the server auto-managed the parent, update it
      if (data.parentStatusChanged) {
        const { newStatus } = data.parentStatusChanged
        const statusLabel = newStatus === 'IN_REVIEW' ? 'In Review' : 'In Progress'
        toast.success(`Parent moved to ${statusLabel}`, { icon: '✅' })
        onTasksChanged(tasks.map(t =>
          t.id === data.parentStatusChanged.id
            ? { ...t, status: newStatus }
            : t.id === sub.id ? { ...t, status: next } : t
        ))
      }
    } catch {
      onTasksChanged(tasks.map(t => t.id === sub.id ? { ...t, status: sub.status } : t))
      toast.error('Failed to update subtask')
    }
  }

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const group = parentTasks
      .filter(t => t.status === status)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    if (group.length > 0) acc[status] = group
    return acc
  }, {} as Record<string, Task[]>)

  const toggle = (status: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  // Handle reordering within the same status group
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    const currentTasks = tasksRef.current
    const currentOnTasksChanged = onTasksChangedRef.current

    if (!over || active.id === over.id || !currentOnTasksChanged) return

    const activeTask = currentTasks.find((t) => t.id === active.id && !t.parentId)
    const overTask = currentTasks.find((t) => t.id === over.id && !t.parentId)

    if (!activeTask || !overTask) return

    // Only allow reordering within the same status group
    if (activeTask.status !== overTask.status) return

    const status = activeTask.status
    const groupTasks = currentTasks
      .filter((t) => !t.parentId && t.status === status)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const oldIndex = groupTasks.findIndex((t) => t.id === active.id)
    const newIndex = groupTasks.findIndex((t) => t.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reorderedGroup = arrayMove(groupTasks, oldIndex, newIndex)

    // Assign new order values
    const withOrder = reorderedGroup.map((t, i) => ({
      ...t,
      order: (i + 1) * 1000,
    }))

    // Update local order overrides (this survives parent refetches within the session)
    const newOverrides = { ...localOrderOverridesRef.current }
    withOrder.forEach(t => {
      newOverrides[t.id] = t.order
    })
    setLocalOrderOverrides(newOverrides)

    // Also notify parent (for other views like Kanban to see the change immediately)
    const updatedTasks = currentTasks.map((t) => {
      const updated = withOrder.find((w) => w.id === t.id)
      return updated ? { ...t, order: updated.order } : t
    })
    currentOnTasksChanged(updatedTasks)

    // Persist the new order for the entire group (critical for persistence across navigation)
    const persistPromises = withOrder.map(t =>
      fetch(`/api/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: t.order }),
      })
    )

    Promise.all(persistPromises).catch(() => {
      toast.error('Failed to save new order')
      // Revert all local overrides for this group on error
      setLocalOrderOverrides(prev => {
        const copy = { ...prev }
        withOrder.forEach(t => delete copy[t.id])
        return copy
      })
    })
  }, [])  // safe because we use refs inside

  return (
    <div className="space-y-4">
      {/* Column header — hidden on mobile (cards stack vertically) */}
      <div className="hidden sm:grid grid-cols-[1fr_120px_100px_120px_80px] gap-4 px-4 py-2 text-xs font-semibold text-gray-3 uppercase tracking-wider border-b border-line">
        <span>Task</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Due Date</span>
        <span>Assignee</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {Object.entries(grouped).map(([status, group]) => {
          const isCollapsed = collapsedGroups.has(status)
          return (
            <div key={status}>
              {/* Group header */}
              <button
                onClick={() => toggle(status)}
                className="flex items-center gap-2 px-4 py-1.5 w-full hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-left"
              >
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-gray-4" />
                  : <ChevronDown className="h-4 w-4 text-gray-4" />}
                <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
                <span className="text-sm font-semibold text-gray-2">{STATUS_LABELS[status]}</span>
                <span className="text-xs text-gray-3 bg-bg-hover rounded-full px-2 py-0.5 border border-line">{group.length}</span>
              </button>

              {!isCollapsed && (
                <SortableContext items={group.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="mt-1 space-y-0.5">
                    {group.map(task => (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        isOverdue={task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'}
                        hasSubs={!!childrenByParent[task.id]?.length}
                        isExpanded={expanded.has(task.id)}
                        doneSubs={childrenByParent[task.id]?.filter(s => s.status === 'DONE').length || 0}
                        subs={childrenByParent[task.id] || []}
                        onTaskClick={onTaskClick}
                        onToggleExpand={toggleExpand}
                        onToggleSubtask={handleToggleSubtask}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          )
        })}
      </DndContext>

      {tasks.length === 0 && (
        <div className="text-center py-16 text-gray-4">
          <p className="text-sm">No tasks yet</p>
          <button onClick={() => onNewTask()} className="mt-2 text-sm text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Create your first task
          </button>
        </div>
      )}
    </div>
  )
}

// Sortable wrapper for task rows in list view
function SortableTaskRow({
  task,
  isOverdue,
  hasSubs,
  isExpanded,
  doneSubs,
  subs,
  onTaskClick,
  onToggleExpand,
  onToggleSubtask,
}: {
  task: Task
  isOverdue: boolean
  hasSubs: boolean
  isExpanded: boolean
  doneSubs: number
  subs: Task[]
  onTaskClick: (id: string) => void
  onToggleExpand: (id: string) => void
  onToggleSubtask: (sub: Task) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const isDone = task.status === 'DONE'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group"
    >
      <div
        onClick={() => onTaskClick(task.id)}
        className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_100px_120px_80px] gap-1.5 sm:gap-4 px-3 sm:px-4 py-2.5 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 group sm:items-center border border-transparent hover:border-gray-100 dark:hover:border-slate-700 active:bg-gray-100 dark:active:bg-slate-700"
      >
        {/* Title row */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Drag Handle */}
          <div
            {...listeners}
            className="h-6 w-5 -ml-1 flex items-center justify-center text-gray-4 hover:text-gray-2 cursor-grab active:cursor-grabbing flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          {/* Expand chevron */}
          {hasSubs ? (
            <button
              onClick={e => { e.stopPropagation(); onToggleExpand(task.id) }}
              className="h-6 w-6 flex items-center justify-center rounded text-gray-4 hover:bg-gray-100 hover:text-gray-2 flex-shrink-0"
              aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-6 flex-shrink-0" aria-hidden="true" />
          )}

          <span className="flex-shrink-0">
            {PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS]}
          </span>

          <span className="text-sm text-gray-1 font-medium truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex-1 min-w-0">
            {task.title}
          </span>

          {hasSubs && (
            <span className="text-[10px] font-mono text-gray-3 bg-bg-hover rounded px-1.5 py-0.5 flex-shrink-0 border border-line">
              {doneSubs}/{subs.length}
            </span>
          )}

          {/* Mobile: assignee inline */}
          {task.assignee && (
            <Avatar className="sm:hidden h-6 w-6 flex-shrink-0">
              <AvatarImage src={task.assignee.image ?? undefined} />
              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400">
                {getInitials(task.assignee.name || task.assignee.email || 'U')}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Status / Priority badges */}
        <div className="flex items-center gap-2 sm:contents flex-wrap pl-8 sm:pl-0">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', STATUS_BG[task.status])}>
            {STATUS_LABELS[task.status]}
          </span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full w-fit', PRIORITY_BG[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>

        {/* Desktop due date */}
        <span className={cn('hidden sm:inline text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-gray-3')}>
          {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
        </span>

        {/* Assignee (desktop) */}
        {task.assignee && (
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={task.assignee.image ?? undefined} />
              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400">
                {getInitials(task.assignee.name || task.assignee.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-3 truncate">{task.assignee.name || task.assignee.email}</span>
          </div>
        )}
      </div>

      {/* Expanded subtasks */}
      {hasSubs && isExpanded && (
        <div className="mt-1 ml-8 pl-3 space-y-0.5">
          {subs.map(sub => {
            const subDone = sub.status === 'DONE'
            return (
              <div
                key={sub.id}
                onClick={() => onTaskClick(sub.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 group/sub"
              >
                <button
                  onClick={e => { e.stopPropagation(); onToggleSubtask(sub) }}
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
                  subDone ? 'line-through text-gray-4' : 'text-gray-2 group-hover/sub:text-indigo-600'
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
}
