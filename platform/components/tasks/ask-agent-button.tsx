'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

type Agent = { id: string; name: string }

/**
 * "Ask agent" control in the comments header. Lists the workspace's enabled
 * agents; picking one runs it synchronously against this task (POST
 * /api/agents/[id]/run). The agent posts its reply as a comment, so we ask the
 * parent to refresh on completion.
 */
export function AskAgentButton({ taskId, onRan }: { taskId: string; onRan?: () => void }) {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [open, setOpen] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/agents?taskId=${taskId}`)
      .then(r => (r.ok ? r.json() : { agents: [] }))
      .then(d => { if (!cancelled) setAgents(d.agents || []) })
      .catch(() => { if (!cancelled) setAgents([]) })
    return () => { cancelled = true }
  }, [taskId])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // No agents configured → render nothing (keep the header clean).
  if (!agents || agents.length === 0) return null

  const run = async (agent: Agent) => {
    setRunningId(agent.id)
    setOpen(false)
    try {
      const res = await fetch(`/api/agents/${agent.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const data = await res.json()
      if (!res.ok || data.status === 'error') {
        toast.error(data.error || `${agent.name} couldn't finish`)
        return
      }
      toast.success(`${agent.name} replied`)
      onRan?.()
    } catch {
      toast.error('Agent run failed')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={runningId !== null}
        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
        title="Ask an AI agent to weigh in on this task"
      >
        {runningId
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Bot className="h-3 w-3" />}
        <span>Ask agent</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-line bg-bg-card shadow-lg py-1">
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => run(a)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-2 hover:bg-bg-hover flex items-center gap-2"
            >
              <Bot className="h-3 w-3 text-indigo-500" />
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
