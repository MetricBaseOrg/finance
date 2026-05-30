'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link2, X, Plus, Search, AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import toast from 'react-hot-toast'

interface DepTask {
  id: string
  title: string
  status: string
  priority: string
}

interface Dependency {
  id: string
  blocker?: DepTask
  blocked?: DepTask
}

interface SearchHit {
  id: string
  title: string
  status: string
  priority: string
  parentId?: string | null
}

/**
 * Renders both sides of a task's dependency graph and lets the user add /
 * remove links. Lives inside the task detail panel.
 */
export function DependenciesSection({
  taskId,
  projectId,
  initial,
  onChanged,
}: {
  taskId: string
  projectId: string
  /** initial state from the parent's task fetch (avoids an extra GET) */
  initial?: { blockedBy?: Dependency[]; blocking?: Dependency[] }
  onChanged?: () => void
}) {
  const [blockedBy, setBlockedBy] = useState<Dependency[]>(initial?.blockedBy || [])
  const [blocking, setBlocking] = useState<Dependency[]>(initial?.blocking || [])
  const [picker, setPicker] = useState<null | 'blockedBy' | 'blocking'>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Re-sync if the parent reloads with new initial data
  useEffect(() => {
    if (initial?.blockedBy !== undefined) setBlockedBy(initial.blockedBy)
    if (initial?.blocking !== undefined) setBlocking(initial.blocking)
  }, [initial?.blockedBy, initial?.blocking])

  // Debounced search in the picker
  useEffect(() => {
    if (!picker) return
    setSearching(true)
    const handle = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const url = new URL(`/api/projects/${projectId}/task-search`, window.location.origin)
        if (pickerQuery) url.searchParams.set('q', pickerQuery)
        url.searchParams.set('exclude', taskId)
        const res = await fetch(url.pathname + url.search, { signal: ctrl.signal })
        if (!res.ok) throw new Error('search failed')
        const data: SearchHit[] = await res.json()
        // Hide tasks already in the relevant relation
        const existing = new Set(
          (picker === 'blockedBy' ? blockedBy : blocking)
            .map(d => (picker === 'blockedBy' ? d.blocker?.id : d.blocked?.id))
            .filter(Boolean) as string[]
        )
        setHits(data.filter(h => !existing.has(h.id)))
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setHits([])
        }
      } finally {
        setSearching(false)
      }
    }, 150)
    return () => clearTimeout(handle)
  }, [picker, pickerQuery, projectId, taskId, blockedBy, blocking])

  const addDep = useCallback(async (hit: SearchHit) => {
    if (!picker) return
    setAdding(true)
    try {
      const body = picker === 'blockedBy'
        ? { blockerId: hit.id }
        : { blockedId: hit.id }
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || `Failed (${res.status})`)
        return
      }
      const dep = await res.json() as Dependency & { blocker?: DepTask; blocked?: DepTask }
      if (picker === 'blockedBy') {
        setBlockedBy(prev => [...prev, { id: dep.id, blocker: dep.blocker }])
      } else {
        setBlocking(prev => [...prev, { id: dep.id, blocked: dep.blocked }])
      }
      setPicker(null)
      setPickerQuery('')
      onChanged?.()
    } finally {
      setAdding(false)
    }
  }, [picker, taskId, onChanged])

  const removeDep = useCallback(async (depId: string, side: 'blockedBy' | 'blocking') => {
    // Optimistic
    const setter = side === 'blockedBy' ? setBlockedBy : setBlocking
    const prev = side === 'blockedBy' ? blockedBy : blocking
    setter(prev.filter(d => d.id !== depId))
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies/${depId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      onChanged?.()
    } catch {
      setter(prev)
      toast.error('Failed to remove dependency')
    }
  }, [taskId, blockedBy, blocking, onChanged])

  const hasAny = blockedBy.length > 0 || blocking.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-3">
          <Link2 className="h-3.5 w-3.5" />
          Dependencies
          {hasAny && (
            <span className="text-gray-4">
              · {blockedBy.length + blocking.length}
            </span>
          )}
        </label>
      </div>

      {/* Blocked by */}
      <DepList
        label="Blocked by"
        accent="rose"
        deps={blockedBy}
        getTask={d => d.blocker}
        onRemove={depId => removeDep(depId, 'blockedBy')}
        onAdd={() => { setPicker('blockedBy'); setPickerQuery('') }}
      />

      {/* Blocking */}
      <DepList
        label="Blocking"
        accent="amber"
        deps={blocking}
        getTask={d => d.blocked}
        onRemove={depId => removeDep(depId, 'blocking')}
        onAdd={() => { setPicker('blocking'); setPickerQuery('') }}
      />

      {/* Picker */}
      {picker && (
        <div
          className="fixed inset-0 z-[55] flex items-start justify-center p-4 sm:pt-[15vh]"
          onClick={e => { if (e.target === e.currentTarget) setPicker(null) }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPicker(null)} />
          <div className="relative w-full max-w-md bg-bg-card rounded-xl shadow-2xl border border-line overflow-hidden flex flex-col max-h-[70dvh]">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <Search className="h-4 w-4 text-gray-4" />
              <input
                autoFocus
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder={picker === 'blockedBy'
                  ? 'Find a task that blocks this one…'
                  : 'Find a task this one blocks…'}
                className="flex-1 bg-transparent outline-none text-sm text-gray-1 placeholder:text-gray-4"
              />
              <button
                onClick={() => setPicker(null)}
                className="h-7 w-7 flex items-center justify-center rounded text-gray-4 hover:text-gray-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {searching && hits.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-4">
                  <Loader2 className="h-4 w-4 mx-auto mb-1 animate-spin" />
                  Searching…
                </div>
              )}
              {!searching && hits.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-4">
                  {pickerQuery ? 'No matching tasks.' : 'Type to search tasks in this project.'}
                </div>
              )}
              {hits.map(h => (
                <button
                  key={h.id}
                  onClick={() => addDep(h)}
                  disabled={adding}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800/60 disabled:opacity-50"
                >
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[h.status])} />
                  <span className="flex-1 min-w-0 text-sm text-gray-1 truncate">{h.title}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-2 flex-shrink-0">
                    {STATUS_LABELS[h.status]}
                  </span>
                  <Plus className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DepList({
  label,
  accent,
  deps,
  getTask,
  onRemove,
  onAdd,
}: {
  label: string
  accent: 'rose' | 'amber'
  deps: Dependency[]
  getTask: (d: Dependency) => DepTask | undefined
  onRemove: (depId: string) => void
  onAdd: () => void
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-gray-2">{label}</span>
        <button
          onClick={onAdd}
          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
        >
          <Plus className="h-3 w-3" /> add
        </button>
      </div>
      {deps.length === 0 ? (
        <div className="text-[11px] text-gray-3 italic px-2 py-1">
          None yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {deps.map(d => {
            const t = getTask(d)
            if (!t) return null
            const isOpen = t.status !== 'DONE' && t.status !== 'CANCELLED'
            return (
              <li
                key={d.id}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm',
                  isOpen && accent === 'rose' && 'bg-rose-50 dark:bg-rose-950/30',
                  isOpen && accent === 'amber' && 'bg-amber-50 dark:bg-amber-950/30',
                  !isOpen && 'bg-gray-50 text-gray-3'
                )}
              >
                {isOpen
                  ? <AlertCircle className={cn(
                      'h-3.5 w-3.5 flex-shrink-0',
                      accent === 'rose' ? 'text-rose-500' : 'text-amber-500'
                    )} />
                  : <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                <span className={cn('flex-1 min-w-0 truncate', !isOpen && 'line-through')}>
                  {t.title}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-gray-2 flex-shrink-0">
                  {STATUS_LABELS[t.status]}
                </span>
                <button
                  onClick={() => onRemove(d.id)}
                  className="h-6 w-6 flex items-center justify-center text-gray-4 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded"
                  aria-label="Remove dependency"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
