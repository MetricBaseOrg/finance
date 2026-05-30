'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { TaskCard } from './task-card'
import toast from 'react-hot-toast'

const COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const

const COLUMN_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-200 border-gray-300 dark:bg-gray-950 dark:border-gray-800',
  TODO: 'bg-blue-100 border-blue-200 dark:bg-blue-900/40 dark:border-blue-800',
  IN_PROGRESS: 'bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800',
  IN_REVIEW: 'bg-purple-100 border-purple-200 dark:bg-purple-900/40 dark:border-purple-800',
  DONE: 'bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-800',
}

const COLUMN_HEADER_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-500 dark:bg-gray-600',
  TODO: 'bg-blue-500 dark:bg-blue-600',
  IN_PROGRESS: 'bg-yellow-500 dark:bg-yellow-600',
  IN_REVIEW: 'bg-purple-500 dark:bg-purple-600',
  DONE: 'bg-green-500 dark:bg-green-600',
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  order: number
  parentId?: string | null
  assignee?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
  labels?: { id: string; name: string; color: string }[]
  _count?: { comments: number; subTasks: number }
}

interface KanbanBoardProps {
  tasks: Task[]
  expandedTaskIds?: Set<string>
  onToggleExpand?: (taskId: string) => void
  onTaskClick: (taskId: string) => void
  onNewTask: (status: string) => void
  onTasksChanged: (tasks: Task[]) => void
}

// ── Inline subtask row used inside expanded parent cards ──────────────────────
function SubtaskRow({
  sub,
  onToggle,
  onClick,
}: {
  sub: { id: string; title: string; status: string }
  onToggle: (sub: { id: string; status: string }) => void
  onClick: (id: string) => void
}) {
  const isDone = sub.status === 'DONE'
  return (
    <div
      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-bg-hover"
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={() => onToggle(sub)}
        className={cn(
          'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          isDone
            ? 'bg-indigo-500 border-indigo-500 text-white'
            : 'border-gray-3 hover:border-indigo-500'
        )}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <button
        onClick={() => onClick(sub.id)}
        className={cn(
          'flex-1 min-w-0 text-left text-xs truncate',
          isDone
            ? 'line-through text-gray-4'
            : 'text-gray-2 hover:text-indigo-600 dark:hover:text-indigo-400'
        )}
      >
        {sub.title}
      </button>
    </div>
  )
}

// ── Droppable column wrapper ──────────────────────────────────────────────────
function KanbanColumn({
  status,
  tasks,
  allTasks,
  expandedTaskIds,
  onToggleExpand,
  onSubtaskToggle,
  onTaskClick,
  onNewTask,
  isOver,
}: {
  status: string
  tasks: Task[]
  allTasks: Task[]
  expandedTaskIds: Set<string>
  onToggleExpand: (id: string) => void
  onSubtaskToggle: (sub: { id: string; status: string }) => void
  onTaskClick: (id: string) => void
  onNewTask: (status: string) => void
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div className={cn('flex flex-col rounded-xl border w-72 flex-shrink-0 transition-colors', COLUMN_COLORS[status])}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-line">
        <div className="flex items-center gap-2">
          <div className={cn('w-2.5 h-2.5 rounded-full', COLUMN_HEADER_COLORS[status])} />
          <span className="text-sm font-semibold text-gray-1">{STATUS_LABELS[status]}</span>
          <span className="text-xs bg-bg-card/80 text-gray-3 rounded-full px-2 py-0.5 font-medium border border-line">
            {tasks.length}
          </span>
        </div>
        <button onClick={() => onNewTask(status)} className="text-gray-4 hover:text-gray-2 transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Task list — the droppable node wraps this area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] rounded-b-xl transition-colors',
          isOver && 'bg-bg-hover ring-2 ring-inset ring-indigo-400 dark:ring-indigo-500'
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => {
            const subs = allTasks.filter(t => t.parentId === task.id)
            const isExpanded = expandedTaskIds.has(task.id)
            const hasSubs = subs.length > 0
            return (
              <div key={task.id} className="space-y-1">
                <div className="relative">
                  <TaskCard task={task} onClick={() => onTaskClick(task.id)} />
                  {hasSubs && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id) }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-md bg-bg-card/80 backdrop-blur-sm text-gray-3 hover:bg-bg-hover hover:text-gray-2 z-10"
                      aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
                {isExpanded && hasSubs && (
                  <div className="ml-3 pl-2 border-l-2 border-line space-y-0.5">
                    {subs.map(s => (
                      <SubtaskRow
                        key={s.id}
                        sub={{ id: s.id, title: s.title, status: s.status }}
                        onToggle={onSubtaskToggle}
                        onClick={onTaskClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </SortableContext>
        {tasks.length === 0 && (
          <div
            onClick={() => onNewTask(status)}
            className="h-24 border-2 border-dashed border-line rounded-xl flex items-center justify-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
          >
            <span className="text-xs text-gray-2 dark:text-gray-4">{isOver ? 'Release to drop' : 'Drop here'}</span>
          </div>
        )}
      </div>

      {/* Add task */}
      <div className="p-3 pt-0">
        <button
          onClick={() => onNewTask(status)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-3 hover:text-gray-2 hover:bg-bg-hover rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add task</span>
        </button>
      </div>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────
export function KanbanBoard({
  tasks,
  expandedTaskIds,
  onToggleExpand,
  onTaskClick,
  onNewTask,
  onTasksChanged,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const expanded = expandedTaskIds ?? new Set<string>()
  const handleToggleExpand = onToggleExpand ?? (() => {})

  // Only parent tasks render as cards in columns; subtasks appear inline when expanded.
  const parentTasks = tasks.filter(t => !t.parentId)

  const getTasksByStatus = (status: string) =>
    parentTasks.filter(t => t.status === status).sort((a, b) => a.order - b.order)

  const handleSubtaskToggle = useCallback(async (sub: { id: string; status: string }) => {
    const nextStatus = sub.status === 'DONE' ? 'TODO' : 'DONE'
    // Optimistic update on the flat tasks array
    onTasksChanged(tasks.map(t => t.id === sub.id ? { ...t, status: nextStatus } : t))
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
        onTasksChanged(tasks.map(t =>
          t.id === data.parentStatusChanged.id
            ? { ...t, status: newStatus }
            : t.id === sub.id ? { ...t, status: nextStatus } : t
        ))
      }
    } catch {
      onTasksChanged(tasks.map(t => t.id === sub.id ? { ...t, status: sub.status } : t))
      toast.error('Failed to update subtask')
    }
  }, [tasks, onTasksChanged])

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === active.id) ?? null)
  }

  // Optimistically move the card as it crosses column boundaries
  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) { setOverId(null); return }
    setOverId(String(over.id))

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    const overStatus = COLUMNS.find(c => c === over.id)          // dropped on column
      ?? tasks.find(t => t.id === over.id)?.status               // dropped on a task

    if (overStatus && overStatus !== activeTask.status) {
      onTasksChanged(tasks.map(t =>
        t.id === activeTask.id ? { ...t, status: overStatus } : t
      ))
    }
  }, [tasks, onTasksChanged])

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    setOverId(null)
    if (!over || active.id === over.id) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    const overStatus = COLUMNS.find(c => c === over.id)
      ?? tasks.find(t => t.id === over.id)?.status
      ?? activeTask.status

    const colTasks = getTasksByStatus(overStatus)
    const overIndex = colTasks.findIndex(t => t.id === over.id)
    const activeIndex = colTasks.findIndex(t => t.id === active.id)

    let ordered: Task[]
    if (overIndex === -1) {
      // Dropped on the column itself (no specific task) → append
      ordered = colTasks.filter(t => t.id !== activeTask.id).concat({ ...activeTask, status: overStatus })
    } else {
      const reordered = activeIndex === -1
        ? [...colTasks.slice(0, overIndex), { ...activeTask, status: overStatus }, ...colTasks.slice(overIndex)]
        : arrayMove(colTasks, activeIndex, overIndex)
      ordered = reordered
    }

    // Assign clean order values
    const withOrder = ordered.map((t, i) => ({ ...t, order: (i + 1) * 1000 }))
    const updatedAll = tasks.map(t => withOrder.find(w => w.id === t.id) ?? t)
    onTasksChanged(updatedAll)

    // Persist the moved task (others can be lazily reordered on next save)
    const moved = withOrder.find(t => t.id === activeTask.id)!
    try {
      await fetch(`/api/tasks/${activeTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: moved.status, order: moved.order }),
      })
    } catch {
      toast.error('Failed to save task position')
    }
  }, [tasks, onTasksChanged])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLUMNS.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getTasksByStatus(status)}
            allTasks={tasks}
            expandedTaskIds={expanded}
            onToggleExpand={handleToggleExpand}
            onSubtaskToggle={handleSubtaskToggle}
            onTaskClick={onTaskClick}
            onNewTask={onNewTask}
            isOver={overId === status}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
