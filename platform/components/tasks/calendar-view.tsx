'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
}

interface CalendarViewProps {
  tasks: Task[]
  onTaskClick: (taskId: string) => void
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT:      'bg-red-500',
  HIGH:        'bg-orange-400',
  MEDIUM:      'bg-yellow-400',
  LOW:         'bg-blue-400',
  NO_PRIORITY: 'bg-gray-300',
}

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart    = startOfMonth(currentDate)
  const monthEnd      = endOfMonth(currentDate)
  const days          = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart)

  const tasksWithDue  = tasks.filter(t => t.dueDate)
  const getTasksForDay = (day: Date) =>
    tasksWithDue.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day))

  return (
    <div className="bg-bg-card rounded-xl border border-line overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        <h2 className="text-lg font-semibold text-gray-1">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-3" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs font-medium text-gray-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-3" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-line">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-3 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {/* Leading empty cells */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/50"
          />
        ))}

        {days.map(day => {
          const dayTasks    = getTasksForDay(day)
          const isCurrentDay = isToday(day)
          const outsideMonth = !isSameMonth(day, currentDate)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[100px] border-b border-r border-gray-50 dark:border-slate-800 p-2',
                outsideMonth && 'bg-gray-50/50',
              )}
            >
              {/* Day number */}
              <div className={cn(
                'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1',
                isCurrentDay
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-2',
              )}>
                {format(day, 'd')}
              </div>

              {/* Task chips */}
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className="w-full text-left flex items-center gap-1 group"
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority])} />
                    <span className="text-xs text-gray-2 truncate group-hover:text-indigo-600 transition-colors">
                      {task.title}
                    </span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-xs text-gray-4">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
