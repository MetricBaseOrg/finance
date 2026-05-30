'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, ArrowRight, FolderKanban, CheckSquare, Layers,
  Hash, AlertCircle, ArrowUp, ArrowDown, Minus, Flag,
} from 'lucide-react'
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

interface SearchResult {
  tasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    project: { id: string; name: string; color: string }
  }>
  projects: Array<{
    id: string
    name: string
    description?: string | null
    color: string
    _count: { tasks: number }
  }>
  workspaces: Array<{ id: string; name: string; color: string; slug: string }>
}

const PRIORITY_ICONS = {
  URGENT:      <AlertCircle className="h-3 w-3 text-red-500" />,
  HIGH:        <ArrowUp className="h-3 w-3 text-orange-500" />,
  MEDIUM:      <Minus className="h-3 w-3 text-yellow-500" />,
  LOW:         <ArrowDown className="h-3 w-3 text-blue-500" />,
  NO_PRIORITY: <Flag className="h-3 w-3 text-gray-400" />,
}

type FlatItem =
  | { kind: 'task'; id: string; href: string; item: SearchResult['tasks'][number] }
  | { kind: 'project'; id: string; href: string; item: SearchResult['projects'][number] }
  | { kind: 'workspace'; id: string; href: string; item: SearchResult['workspaces'][number] }

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ tasks: [], projects: [], workspaces: [] })
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults({ tasks: [], projects: [], workspaces: [] })
      setActiveIndex(0)
      // Focus after the modal animates in
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return
    if (query.trim().length === 0) {
      setResults({ tasks: [], projects: [], workspaces: [] })
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('failed')
        const data: SearchResult = await res.json()
        setResults(data)
        setActiveIndex(0)
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') {
          setResults({ tasks: [], projects: [], workspaces: [] })
        }
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => clearTimeout(handle)
  }, [query, open])

  // Flatten results for keyboard navigation
  const flatItems: FlatItem[] = useMemo(() => {
    const list: FlatItem[] = []
    for (const t of results.tasks) {
      list.push({ kind: 'task', id: t.id, href: `/projects/${t.project.id}`, item: t })
    }
    for (const p of results.projects) {
      list.push({ kind: 'project', id: p.id, href: `/projects/${p.id}`, item: p })
    }
    for (const w of results.workspaces) {
      // Workspaces have no dedicated page yet — fall back to dashboard
      list.push({ kind: 'workspace', id: w.id, href: '/projects/dashboard', item: w })
    }
    return list
  }, [results])

  const navigate = useCallback((href: string) => {
    onClose()
    router.push(href)
  }, [onClose, router])

  // Keyboard handling
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(flatItems.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        const active = flatItems[activeIndex]
        if (active) { e.preventDefault(); navigate(active.href) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flatItems, activeIndex, onClose, navigate])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-search-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  let runningIdx = -1

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:pt-[12vh]"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80dvh]"
        style={{
          background: 'var(--mb-surface)',
          border: '1px solid var(--mb-border)',
          color: 'var(--mb-ink)',
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--mb-border)' }}>
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--mb-ink-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, projects, workspaces…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--mb-ink-muted)]"
            style={{ color: 'var(--mb-ink)' }}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono border rounded px-1.5 py-0.5" style={{ borderColor: 'var(--mb-border)', color: 'var(--mb-ink-muted)' }}>
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="sm:hidden h-7 w-7 flex items-center justify-center rounded"
            style={{ color: 'var(--mb-ink-muted)' }}
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {query.trim().length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--mb-ink-muted)' }}>
              Search tasks, projects, and workspaces.
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <span>Navigate with</span>
                <kbd className="font-mono border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5">↑</kbd>
                <kbd className="font-mono border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5">↓</kbd>
                <span>· open with</span>
                <kbd className="font-mono border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5">↵</kbd>
              </div>
            </div>
          )}

          {loading && query.trim().length > 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--mb-ink-muted)' }}>
              Searching…
            </div>
          )}

          {!loading && query.trim().length > 0 && flatItems.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--mb-ink-muted)' }}>
              No results for &ldquo;{query}&rdquo;.
            </div>
          )}

          {/* Tasks group */}
          {results.tasks.length > 0 && (
            <div className="mb-1">
              <GroupHeader icon={CheckSquare} label="Tasks" count={results.tasks.length} />
              {results.tasks.map(t => {
                runningIdx++
                const idx = runningIdx
                const isActive = idx === activeIndex
                return (
                  <button
                    key={`task-${t.id}`}
                    data-search-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(`/projects/${t.project.id}`)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left',
                      isActive
                        ? ''
                        : 'hover:bg-[var(--mb-surface-2)]'
                    )}
                    style={isActive ? { background: 'var(--mb-brand-soft)' } : undefined}
                  >
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS[t.status])} />
                    {PRIORITY_ICONS[t.priority as keyof typeof PRIORITY_ICONS]}
                    <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-slate-200 truncate">
                      <Highlight text={t.title} query={query} />
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: t.project.color }} />
                      <span className="hidden sm:inline truncate max-w-[120px]">{t.project.name}</span>
                    </span>
                    {isActive && <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--mb-brand)' }} />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Projects group */}
          {results.projects.length > 0 && (
            <div className="mb-1">
              <GroupHeader icon={FolderKanban} label="Projects" count={results.projects.length} />
              {results.projects.map(p => {
                runningIdx++
                const idx = runningIdx
                const isActive = idx === activeIndex
                return (
                  <button
                    key={`project-${p.id}`}
                    data-search-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left',
                      isActive
                        ? ''
                        : 'hover:bg-[var(--mb-surface-2)]'
                    )}
                    style={isActive ? { background: 'var(--mb-brand-soft)' } : undefined}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-slate-200 truncate">
                        <Highlight text={p.name} query={query} />
                      </p>
                      {p.description && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{p.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                      {p._count.tasks} task{p._count.tasks !== 1 ? 's' : ''}
                    </span>
                    {isActive && <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--mb-brand)' }} />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Workspaces group */}
          {results.workspaces.length > 0 && (
            <div className="mb-1">
              <GroupHeader icon={Layers} label="Workspaces" count={results.workspaces.length} />
              {results.workspaces.map(w => {
                runningIdx++
                const idx = runningIdx
                const isActive = idx === activeIndex
                return (
                  <button
                    key={`ws-${w.id}`}
                    data-search-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate('/projects/dashboard')}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left',
                      isActive
                        ? ''
                        : 'hover:bg-[var(--mb-surface-2)]'
                    )}
                    style={isActive ? { background: 'var(--mb-brand-soft)' } : undefined}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: w.color }}
                    >
                      {w.name[0].toUpperCase()}
                    </div>
                    <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-slate-200 truncate">
                      <Highlight text={w.name} query={query} />
                    </span>
                    {isActive && <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--mb-brand)' }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer with shortcut hints (desktop only) */}
        <div className="hidden sm:flex items-center justify-between gap-2 px-4 py-2 border-t text-[11px]" style={{ borderColor: 'var(--mb-border)', color: 'var(--mb-ink-muted)' }}>
          <div className="flex items-center gap-2">
            <Hash className="h-3 w-3" />
            <span>{flatItems.length} result{flatItems.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5">↵</kbd> open
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--mb-ink-muted)' }}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <span style={{ color: 'var(--mb-ink-soft)' }}>· {count}</span>
    </div>
  )
}

/** Bolds the matched portion of `text` against the user's query. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const lc = text.toLowerCase()
  const lq = q.toLowerCase()
  const idx = lc.indexOf(lq)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: 'var(--mb-brand-soft)', color: 'var(--mb-brand-ink)' }} className="rounded px-0.5 font-semibold">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  )
}
