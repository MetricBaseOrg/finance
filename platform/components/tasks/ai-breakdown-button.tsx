'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

/**
 * Inline button that asks the AI to suggest subtasks for the given task.
 * Shows a modal with checkboxes for each suggestion; the user picks which to
 * keep and clicks "Add" to write them as actual subtasks via /api/tasks.
 */
export function AIBreakdownButton({
  taskId,
  projectId,
  onCreated,
}: {
  taskId: string
  projectId: string
  // Called once per accepted subtask creation, with the created Task payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (task: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/ai/breakdown`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `AI call failed (${res.status})`)
        return
      }
      if (!data.subtasks?.length) {
        toast('No suggestions returned.', { icon: '🤔' })
        return
      }
      setSuggestions(data.subtasks as string[])
      // Pre-select everything; user can untick what they don't want
      setPicked(new Set(data.subtasks.map((_: string, i: number) => i)))
      setOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('AI call failed')
    } finally {
      setLoading(false)
    }
  }

  const togglePick = (i: number) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const addPicked = async () => {
    if (picked.size === 0) {
      setOpen(false)
      return
    }
    setAdding(true)
    let created = 0
    let failed = 0
    // Create sequentially so they end up in the order the AI suggested
    for (let i = 0; i < suggestions.length; i++) {
      if (!picked.has(i)) continue
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: suggestions[i],
            projectId,
            parentId: taskId,
            status: 'TODO',
            priority: 'MEDIUM',
          }),
        })
        if (!res.ok) { failed++; continue }
        const t = await res.json()
        onCreated(t)
        created++
      } catch {
        failed++
      }
    }
    setAdding(false)
    setOpen(false)
    if (failed > 0) {
      toast.error(`Added ${created}, ${failed} failed`)
    } else {
      toast.success(`Added ${created} subtask${created === 1 ? '' : 's'}`)
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
        title="Ask AI to suggest subtasks"
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Sparkles className="h-3 w-3" />}
        <span>AI breakdown</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget && !adding) setOpen(false) }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !adding && setOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-bg-card rounded-t-2xl sm:rounded-xl shadow-2xl border border-line overflow-hidden flex flex-col max-h-[85dvh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-1">Suggested subtasks</span>
              </div>
              <button
                onClick={() => !adding && setOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded text-gray-4 hover:text-gray-2"
                aria-label="Close"
                disabled={adding}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {suggestions.map((s, i) => {
                const isPicked = picked.has(i)
                return (
                  <button
                    key={i}
                    onClick={() => togglePick(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      isPicked
                        ? 'bg-indigo-50 dark:bg-indigo-950/40'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <span className={cn(
                      'h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      isPicked
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'border-gray-300 dark:border-slate-500'
                    )}>
                      {isPicked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="text-sm text-gray-1 flex-1">{s}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-line">
              <span className="text-xs text-gray-3">
                {picked.size} of {suggestions.length} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={adding}
                  className="px-3 py-1.5 text-xs text-gray-2 hover:text-gray-1 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addPicked}
                  disabled={adding || picked.size === 0}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Add {picked.size > 0 ? picked.size : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
