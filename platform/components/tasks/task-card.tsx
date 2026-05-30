'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { Calendar, MessageSquare, Paperclip, AlertCircle, ArrowUp, ArrowDown, Minus, Flag, Link2, Repeat } from 'lucide-react'
import { cn, PRIORITY_BG, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  assignee?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null
  labels?: { id: string; name: string; color: string }[]
  blockedBy?: { id: string; blocker: { id: string; status: string; title?: string } }[]
  recurrence?: string | null
  _count?: { comments: number; subTasks: number }
}

interface TaskCardProps {
  task: Task
  onClick?: () => void
  isDragging?: boolean
}

const PRIORITY_ICONS = {
  URGENT: <AlertCircle className="h-3 w-3 text-red-500 dark:text-red-400" />,
  HIGH: <ArrowUp className="h-3 w-3 text-orange-500 dark:text-orange-400" />,
  MEDIUM: <Minus className="h-3 w-3 text-yellow-500 dark:text-yellow-400" />,
  LOW: <ArrowDown className="h-3 w-3 text-blue-500 dark:text-blue-400" />,
  NO_PRIORITY: <Flag className="h-3 w-3 text-gray-4" />,
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
  const openBlockers = (task.blockedBy || []).filter(
    d => d.blocker.status !== 'DONE' && d.blocker.status !== 'CANCELLED',
  )
  const blockerTitles = openBlockers
    .map(d => d.blocker.title)
    .filter(Boolean)
    .join('\n• ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-bg-card rounded-xl border border-line p-3.5 cursor-pointer select-none',
        'hover:shadow-md hover:border-border-str transition-all duration-150',
        isDragging && 'shadow-xl rotate-2 border-indigo-300 dark:border-indigo-700',
      )}
    >
      {/* Priority + labels */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS]}
        {task.labels?.map(label => (
          <span
            key={label.id}
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: label.color + '20', color: label.color }}
          >
            {label.name}
          </span>
        ))}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-1 leading-snug mb-2.5 line-clamp-2">{task.title}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500 dark:text-red-400' : 'text-gray-3')}>
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(task.dueDate), 'MMM d')}</span>
            </div>
          )}
          {(task._count?.comments ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-4">
              <MessageSquare className="h-3 w-3" />
              <span>{task._count?.comments}</span>
            </div>
          )}
          {(task._count?.subTasks ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-gray-3 bg-bg-hover rounded px-1.5 py-0.5 border border-line">
              <Paperclip className="h-3 w-3" />
              <span>{task._count?.subTasks}</span>
            </div>
          )}
          {openBlockers.length > 0 && (
            <div
              className="flex items-center gap-1 text-xs text-rose-500 dark:text-rose-400"
              title={blockerTitles ? `Blocked by:\n• ${blockerTitles}` : 'Blocked by open dependencies'}
            >
              <Link2 className="h-3 w-3" />
              <span>{openBlockers.length}</span>
            </div>
          )}
          {task.recurrence && (
            <div
              className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400"
              title={`Repeats ${task.recurrence.toLowerCase()}`}
            >
              <Repeat className="h-3 w-3" />
            </div>
          )}
        </div>
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.image ?? undefined} />
            <AvatarFallback className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
              {getInitials(task.assignee.name || task.assignee.email || 'U')}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}

export function TaskCardPlaceholder() {
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/30 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 h-[88px]" />
  )
}
