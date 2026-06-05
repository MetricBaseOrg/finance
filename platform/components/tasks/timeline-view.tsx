'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import {
  format, differenceInDays, startOfMonth, endOfMonth,
  addMonths, subMonths, eachDayOfInterval, isWeekend, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  parentId?: string | null
  startDate?: string | null
  dueDate?: string | null
  assignee?: { id: string; name?: string | null } | null
  blockedBy?: { id: string; blocker: { id: string; title?: string; status?: string } }[]
}

interface TimelineViewProps {
  tasks: Task[]
  expandedTaskIds?: Set<string>
  onToggleExpand?: (taskId: string) => void
  onTaskClick: (taskId: string) => void
  onTasksChanged?: (tasks: Task[]) => void
}

const STATUS_BAR: Record<string, string> = {
  BACKLOG:     'bg-gray-300',
  TODO:        'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  IN_REVIEW:   'bg-purple-400',
  DONE:        'bg-green-400',
  CANCELLED:   'bg-red-400',
}

const DAY_W    = 40   // px per day column
const NAME_W   = 208  // px for the frozen task-name column
const ROW_H    = 44   // px per task row
const HDR_H    = 56   // px for the two-row day header (month + day)

export function TimelineView({ tasks, expandedTaskIds, onToggleExpand, onTaskClick, onTasksChanged }: TimelineViewProps) {
  const expanded = expandedTaskIds ?? new Set<string>()
  const toggleExpand = onToggleExpand ?? (() => {})

  const handleToggleComplete = async (task: Task) => {
    if (!onTasksChanged) return
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    onTasksChanged(tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      onTasksChanged(tasks.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      toast.error('Failed to update task')
    }
  }
  const [anchorDate, setAnchorDate] = useState(() => startOfMonth(new Date()))
  const timelineRef = useRef<HTMLDivElement>(null)
  const nameColRef  = useRef<HTMLDivElement>(null)
  const syncingRef  = useRef(false)

  // Frozen name column narrows on small screens so the timeline grid keeps usable
  // width (208px would swallow most of a phone viewport).
  const [nameW, setNameW] = useState(NAME_W)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setNameW(mq.matches ? 132 : NAME_W)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // 3-month window: prev + current + next
  const rangeStart = useMemo(() => startOfMonth(subMonths(anchorDate, 1)), [anchorDate])
  const rangeEnd   = useMemo(() => endOfMonth(addMonths(anchorDate, 1)),   [anchorDate])
  const days       = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  )
  const totalW = days.length * DAY_W

  // Month label groups
  const monthGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = []
    days.forEach(day => {
      const label = format(day, 'MMM yyyy')
      const last  = groups[groups.length - 1]
      if (last?.label === label) { last.count++; return }
      groups.push({ label, count: 1 })
    })
    return groups
  }, [days])

  // Scroll timeline to centre on today when anchor changes
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const todayIdx = days.findIndex(d => isToday(d))
    if (todayIdx >= 0) {
      el.scrollLeft = Math.max(0, todayIdx * DAY_W - el.clientWidth / 2 + DAY_W / 2)
    }
  }, [anchorDate])

  // Sync vertical scroll: timeline → name column
  const handleTimelineScroll = () => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (nameColRef.current && timelineRef.current) {
      nameColRef.current.scrollTop = timelineRef.current.scrollTop
    }
    syncingRef.current = false
  }

  // Group subtasks by their parent so we can render them indented when expanded.
  const childrenByParent = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of tasks) {
      if (t.parentId) {
        if (!map[t.parentId]) map[t.parentId] = []
        map[t.parentId].push(t)
      }
    }
    return map
  }, [tasks])

  // Top-level tasks with dates; each may be followed by indented children if expanded.
  const parentTasksWithDates = useMemo(
    () => tasks.filter(t => !t.parentId && (t.startDate || t.dueDate)),
    [tasks],
  )

  // Build a flat ordered list of rows to render: each parent, then (if expanded) its children.
  // The chevron appears whenever a parent has ANY subtasks. Children without dates still
  // show up in the name column when expanded; they just don't get a bar on the timeline.
  const visibleRows = useMemo(() => {
    type Row = { task: Task; depth: 0 | 1; hasChildren: boolean; isExpanded: boolean }
    const rows: Row[] = []
    for (const p of parentTasksWithDates) {
      const allChildren = childrenByParent[p.id] || []
      const isExp = expanded.has(p.id)
      rows.push({ task: p, depth: 0, hasChildren: allChildren.length > 0, isExpanded: isExp })
      if (isExp) {
        for (const c of allChildren) {
          rows.push({ task: c, depth: 1, hasChildren: false, isExpanded: false })
        }
      }
    }
    return rows
  }, [parentTasksWithDates, childrenByParent, expanded])

  // Index of each task in visibleRows for vertical positioning
  const rowIdx = useMemo(() => {
    const map: Record<string, number> = {}
    visibleRows.forEach((r, i) => { map[r.task.id] = i })
    return map
  }, [visibleRows])

  // Build dependency edges: blocker → blocked (end of blocker bar → start of blocked bar)
  const depEdges = useMemo(() => {
    const edges: { fromId: string; toId: string }[] = []
    const visibleIds = new Set(visibleRows.map(r => r.task.id))
    for (const row of visibleRows) {
      const deps = row.task.blockedBy || []
      for (const dep of deps) {
        const blockerId = dep.blocker?.id
        if (blockerId && visibleIds.has(blockerId) && visibleIds.has(row.task.id)) {
          edges.push({ fromId: blockerId, toId: row.task.id })
        }
      }
    }
    return edges
  }, [visibleRows])

  // Pre-compute routed paths for all edges together so each line can avoid both
  // task bars and the vertical segments of previously-assigned lines.
  const depRoutes = useMemo(() => {
    const RGAP = 8

    const computeBar = (task: Task) => {
      if (!task.startDate && !task.dueDate) return null
      const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!)
      const end   = task.dueDate   ? new Date(task.dueDate)   : new Date(task.startDate!)
      const cs    = start < rangeStart ? rangeStart : start
      const ce    = end   > rangeEnd   ? rangeEnd   : end
      if (cs > rangeEnd || ce < rangeStart) return null
      const left  = differenceInDays(cs, rangeStart) * DAY_W
      const width = Math.max(differenceInDays(ce, cs) + 1, 1) * DAY_W
      return { left, width }
    }

    // Tracks vertical segments already assigned: {routeX, rMin, rMax}
    const assigned: { routeX: number; rMin: number; rMax: number }[] = []

    return depEdges.map(({ fromId, toId }) => {
      const fromTask = tasks.find(t => t.id === fromId)
      const toTask   = tasks.find(t => t.id === toId)
      if (!fromTask || !toTask) return null

      const fromBar = computeBar(fromTask)
      const toBar   = computeBar(toTask)
      if (!fromBar || !toBar) return null

      const fromRow = rowIdx[fromId]
      const toRow   = rowIdx[toId]
      if (fromRow === undefined || toRow === undefined) return null

      const x1 = fromBar.left + fromBar.width + 2
      const y1 = HDR_H + fromRow * ROW_H + ROW_H / 2
      const x2 = toBar.left - 2
      const y2 = HDR_H + toRow * ROW_H + ROW_H / 2

      const rMin = Math.min(fromRow, toRow)
      const rMax = Math.max(fromRow, toRow)

      // Compute routeX first for both cases — determines which path style to use
      let routeX = x1 + RGAP
      for (let iter = 0; iter < 40; iter++) {
        let clear = true

        for (let r = rMin + 1; r < rMax; r++) {
          const row = visibleRows[r]
          if (!row) continue
          const bar = computeBar(row.task)
          if (!bar) continue
          if (routeX > bar.left - RGAP && routeX < bar.left + bar.width + RGAP) {
            routeX = bar.left + bar.width + RGAP
            clear = false; break
          }
        }

        for (const seg of assigned) {
          if (seg.rMin <= rMax && seg.rMax >= rMin && Math.abs(routeX - seg.routeX) < RGAP) {
            routeX = seg.routeX + RGAP
            clear = false; break
          }
        }

        if (clear) break
      }

      // Forward only when routeX still clears the target bar's left edge
      const isForward = x2 > routeX

      assigned.push({ routeX, rMin, rMax })
      return {
        key: `${fromId}-${toId}`,
        x1, y1, x2, y2, routeX, isForward,
        isDone: fromTask.status === 'DONE',
      }
    })
  }, [depEdges, tasks, visibleRows, rowIdx, rangeStart, rangeEnd])

  // Backwards-compat name kept for the empty-state copy
  const tasksWithDates = parentTasksWithDates

  const getBar = (task: Task) => {
    const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!)
    const end   = task.dueDate   ? new Date(task.dueDate)   : new Date(task.startDate!)

    const clampedStart = start < rangeStart ? rangeStart : start
    const clampedEnd   = end   > rangeEnd   ? rangeEnd   : end
    if (clampedStart > rangeEnd || clampedEnd < rangeStart) return null

    const startOffset = differenceInDays(clampedStart, rangeStart)
    const duration    = Math.max(differenceInDays(clampedEnd, clampedStart) + 1, 1)
    return { left: startOffset * DAY_W, width: duration * DAY_W }
  }

  const todayIdx = days.findIndex(d => isToday(d))

  return (
    <div className="bg-bg-card rounded-xl border border-line overflow-hidden flex flex-col">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b border-line flex-shrink-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-1 truncate min-w-0">
          <span className="hidden sm:inline">Timeline — </span>{format(anchorDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setAnchorDate(d => subMonths(d, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-3" />
          </button>
          <button
            onClick={() => setAnchorDate(startOfMonth(new Date()))}
            className="px-3 py-1 text-xs font-medium text-gray-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setAnchorDate(d => addMonths(d, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-3" />
          </button>
        </div>
      </div>

      {/* ── Two-panel grid ──────────────────────────────────────────────── */}
      <div className="flex overflow-hidden flex-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>

        {/* ── LEFT: frozen name column ─────────────────────────────────── */}
        <div
          className="flex-shrink-0 border-r border-line flex flex-col z-40"
          style={{ width: nameW }}
        >
          {/* Header placeholder aligned to timeline header height */}
          <div
            className="flex-shrink-0 bg-gray-50 border-b border-line flex items-end px-4 pb-2"
            style={{ height: HDR_H }}
          >
            <span className="text-[11px] font-semibold text-gray-3 uppercase tracking-wide">Task</span>
          </div>

          {/* Name rows — vertically scrollable, scrollbar hidden */}
          <div
            ref={nameColRef}
            className="overflow-y-scroll flex-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {visibleRows.length === 0 && (
              <div className="h-24" />
            )}
            {visibleRows.map(({ task, depth, hasChildren, isExpanded }) => {
              const isDone = task.status === 'DONE'
              return (
                <div
                  key={task.id}
                  style={{ height: ROW_H, paddingLeft: depth === 1 ? 24 : 0 }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 border-b border-gray-50 dark:border-slate-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 group transition-colors',
                    depth === 1 && 'bg-gray-50/30',
                    isDone && 'opacity-60'
                  )}
                  onClick={() => onTaskClick(task.id)}
                >
                  {hasChildren ? (
                    <button
                      onClick={e => { e.stopPropagation(); toggleExpand(task.id) }}
                      className="h-5 w-5 -ml-1 flex items-center justify-center rounded text-gray-4 hover:bg-gray-200 hover:text-gray-2 flex-shrink-0"
                      aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />}
                    </button>
                  ) : (
                    <span className="w-5 -ml-1 flex-shrink-0" />
                  )}
                  {/* Checklist toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleComplete(task) }}
                    className={cn(
                      'rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      depth === 1 ? 'h-3.5 w-3.5' : 'h-4 w-4',
                      isDone
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'border-gray-300 dark:border-slate-500 hover:border-indigo-400 dark:hover:border-indigo-500'
                    )}
                    aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                    aria-pressed={isDone}
                  >
                    {isDone && <Check className={depth === 1 ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={3} />}
                  </button>
                  <span className={cn(
                    'truncate transition-colors',
                    depth === 0
                      ? 'text-xs font-medium'
                      : 'text-[11px]',
                    isDone
                      ? 'line-through text-gray-4'
                      : depth === 0
                        ? 'text-gray-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                        : 'text-gray-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  )}>
                    {task.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: scrollable timeline ───────────────────────────────── */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-auto"
          onScroll={handleTimelineScroll}
        >
            {/* Inner: wide enough to hold all day columns */}
            <div className="relative" style={{ width: totalW, minWidth: totalW }}>

            {/* Sticky header: month + day rows */}
            <div className="sticky top-0 z-40 bg-bg-card border-b border-line" style={{ height: HDR_H }}>
              {/* Month labels */}
              <div className="flex border-b border-line" style={{ height: HDR_H / 2 }}>
                {monthGroups.map(g => (
                  <div
                    key={g.label}
                    className="flex-shrink-0 flex items-center px-2 border-r border-line bg-gray-50 text-[11px] font-semibold text-gray-2"
                    style={{ width: g.count * DAY_W, height: HDR_H / 2 }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              {/* Day labels */}
              <div className="flex" style={{ height: HDR_H / 2 }}>
                {days.map(day => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'flex-shrink-0 flex flex-col items-center justify-center border-r border-line',
                      isWeekend(day) && 'bg-gray-50',
                      isToday(day) && 'bg-indigo-50 dark:bg-indigo-950/40',
                    )}
                    style={{ width: DAY_W, height: HDR_H / 2 }}
                  >
                    <span className="text-[10px] font-medium text-gray-3 leading-none">{format(day, 'EEE')}</span>
                    <span className={cn(
                      'text-[11px] font-medium mt-0.5',
                      isToday(day) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-2',
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty state */}
            {visibleRows.length === 0 && (
              <div className="py-16 text-center text-sm text-gray-4">
                {tasks.length > 0
                  ? 'Add start dates or due dates to tasks to see them here'
                  : 'No tasks yet'}
              </div>
            )}

            {/* Task rows */}
            {visibleRows.map(({ task, depth }) => {
              const bar = getBar(task)
              return (
                <div
                  key={task.id}
                  className={cn(
                    'relative border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/30 dark:hover:bg-slate-800/30',
                    depth === 1 && 'bg-gray-50/30'
                  )}
                  style={{ height: ROW_H, width: totalW }}
                >
                  {/* Weekend / today column shading */}
                  {days.map((day, i) => (isWeekend(day) || isToday(day)) && (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'absolute top-0 bottom-0',
                        isToday(day) ? 'bg-indigo-50/40' : 'bg-gray-50/60',
                      )}
                      style={{ left: i * DAY_W, width: DAY_W }}
                    />
                  ))}

                  {/* Today vertical line */}
                  {todayIdx >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-400/60 pointer-events-none z-10"
                      style={{ left: todayIdx * DAY_W + DAY_W / 2 }}
                    />
                  )}

                  {/* Task bar */}
                  {bar && (
                    <button
                      onClick={() => onTaskClick(task.id)}
                      title={task.title}
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 rounded-full flex items-center px-3',
                        'hover:brightness-95 transition-all z-20 overflow-hidden',
                        STATUS_BAR[task.status],
                        depth === 1 ? 'h-5 opacity-80' : 'h-7'
                      )}
                      style={{ left: bar.left, width: bar.width }}
                    >
                      <span className={cn(
                        'text-white font-medium truncate whitespace-nowrap',
                        depth === 1 ? 'text-[10px]' : 'text-[11px]'
                      )}>
                        {task.title}
                      </span>
                    </button>
                  )}
                </div>
              )
            })}

            {/* Dependency arrows overlay */}
            {depRoutes.some(Boolean) && (
              <svg
                className="absolute top-0 left-0 pointer-events-none z-30"
                style={{ width: totalW, height: HDR_H + visibleRows.length * ROW_H }}
              >
                {depRoutes.map(route => {
                  if (!route) return null
                  const { key, x1, y1, x2, y2, routeX, isForward, isDone } = route
                  // Row boundary between source and target — direction-aware
                  const goingDown = y1 < y2
                  const yDivider = goingDown ? y2 - ROW_H / 2 : y2 + ROW_H / 2
                  const vs = goingDown ? 1 : -1
                  const r = Math.min(
                    6,
                    Math.abs(routeX - x1) / 2,
                    Math.abs(y2 - y1) / 4,
                    Math.abs(x2 - routeX) / 2,
                    Math.abs(yDivider - y1) / 2,
                    Math.abs(y2 - yDivider) / 2,
                    Math.abs(x1 - x2) / 2,
                  )
                  const d = isForward
                    ? `M${x1},${y1} H${routeX - r} Q${routeX},${y1} ${routeX},${y1 + r} V${y2 - r} Q${routeX},${y2} ${routeX + r},${y2} H${x2}`
                    : `M${x1},${y1} H${routeX} V${yDivider - vs*r} Q${routeX},${yDivider} ${routeX - r},${yDivider} H${x2 + r} Q${x2},${yDivider} ${x2},${yDivider + vs*r} V${y2}`
                  return (
                    <g key={key}>
                      <circle cx={x1 - 1} cy={y1} r="3" fill="#6366f1" opacity={0.8} />
                      <path
                        d={d}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        strokeDasharray={isDone ? '4 3' : undefined}
                        opacity={0.65}
                      />
                      {/* Arrowhead always pointing right, independent of path direction */}
                      <polygon
                        points={`${x2},${y2 - 3} ${x2 + 6},${y2} ${x2},${y2 + 3}`}
                        fill="#6366f1"
                        opacity={0.8}
                      />
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
