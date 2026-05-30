'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, ChevronDown, ChevronRight, MessageSquare, AlertCircle, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Summary {
  tldr: string[]
  openQuestions: string[]
  decisions: string[]
}

/**
 * Inline button that sits in the Comments section header. Click → calls the
 * AI to summarize the thread, then renders a collapsible panel showing
 * tldr / open questions / decisions.
 */
export function AISummarizeComments({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [open, setOpen] = useState(true)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/ai/summarize-comments`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `AI call failed (${res.status})`)
        return
      }
      if (data.note) {
        toast(data.note, { icon: '🤔' })
        return
      }
      setSummary({
        tldr: data.tldr || [],
        openQuestions: data.openQuestions || [],
        decisions: data.decisions || [],
      })
      setOpen(true)
    } catch {
      toast.error('AI call failed')
    } finally {
      setLoading(false)
    }
  }

  if (!summary) {
    return (
      <button
        onClick={run}
        disabled={loading}
        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
        title="Summarize the comment thread"
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Sparkles className="h-3 w-3" />}
        <span>Summarize</span>
      </button>
    )
  }

  const isEmpty = summary.tldr.length + summary.openQuestions.length + summary.decisions.length === 0

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
      >
        <Sparkles className="h-3 w-3" />
        <span>{open ? 'Hide summary' : 'Show summary'}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-indigo-200 dark:border-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              AI summary
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={run}
                disabled={loading}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                title="Re-summarize"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'refresh'}
              </button>
              <button
                onClick={() => setSummary(null)}
                className="h-5 w-5 flex items-center justify-center text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-200"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="p-3 space-y-3 text-sm">
            {isEmpty && (
              <p className="text-xs text-gray-3 italic">
                The AI returned no items. Not much actionable content yet.
              </p>
            )}
            <SummaryList
              icon={MessageSquare}
              label="TL;DR"
              items={summary.tldr}
            />
            <SummaryList
              icon={AlertCircle}
              label="Open questions"
              items={summary.openQuestions}
              accent="rose"
            />
            <SummaryList
              icon={Check}
              label="Decisions"
              items={summary.decisions}
              accent="emerald"
            />
          </div>
        </div>
      )}
    </>
  )
}

function SummaryList({
  icon: Icon, label, items, accent,
}: {
  icon: React.ElementType
  label: string
  items: string[]
  accent?: 'rose' | 'emerald'
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className={cn(
        'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1',
        accent === 'rose'    ? 'text-rose-600 dark:text-rose-400' :
        accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
        'text-gray-2'
      )}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <ul className="space-y-1 ml-1">
        {items.map((s, i) => (
          <li key={i} className="text-xs text-gray-2 flex gap-1.5">
            <span className="text-gray-4 flex-shrink-0">•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
