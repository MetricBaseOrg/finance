'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutTemplate, FolderPlus, ListPlus, Trash2, X, Loader2, Sparkles, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

interface Template {
  id: string
  kind: 'TASK' | 'PROJECT'
  name: string
  description?: string | null
  content: string
  createdById: string
  createdAt: string
}

/**
 * Workspace templates manager. Lists PROJECT and TASK templates, lets the user
 * apply a PROJECT template (creates a new project) or delete a template.
 * TASK templates are applied from the New Task flow, but can be deleted here.
 */
export function TemplatesDialog({
  open,
  onClose,
  organizationId,
  onProjectCreated,
}: {
  open: boolean
  onClose: () => void
  organizationId: string | null
  onProjectCreated?: () => void
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [nameOverride, setNameOverride] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/templates?organizationId=${organizationId}`, { cache: 'no-store' })
      if (res.ok) setTemplates(await res.json())
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => { if (open) refresh() }, [open, refresh])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = o }
  }, [open])

  if (!open) return null

  const projectTemplates = templates.filter(t => t.kind === 'PROJECT')
  const taskTemplates = templates.filter(t => t.kind === 'TASK')

  const applyProject = async (tpl: Template) => {
    setApplyingId(tpl.id)
    try {
      const res = await fetch(`/api/templates/${tpl.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameOverride: nameOverride[tpl.id] || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to apply'); return }
      toast.success(`Created project "${data.project.name}"`)
      onProjectCreated?.()
      onClose()
      router.push(`/projects/${data.project.id}`)
    } catch {
      toast.error('Failed to apply template')
    } finally {
      setApplyingId(null)
    }
  }

  const remove = async (tpl: Template) => {
    if (!confirm(`Delete template "${tpl.name}"? This can't be undone.`)) return
    const prev = templates
    setTemplates(t => t.filter(x => x.id !== tpl.id))
    try {
      const res = await fetch(`/api/templates/${tpl.id}`, { method: 'DELETE' })
      if (!res.ok) { setTemplates(prev); toast.error('Failed to delete') }
    } catch {
      setTemplates(prev)
      toast.error('Failed to delete')
    }
  }

  const summarize = (tpl: Template): string => {
    try {
      const c = JSON.parse(tpl.content)
      if (tpl.kind === 'PROJECT') {
        const tasks = c.tasks?.length ?? 0
        const ms = c.milestones?.length ?? 0
        return `${tasks} task${tasks === 1 ? '' : 's'}${ms ? ` · ${ms} milestone${ms === 1 ? '' : 's'}` : ''}`
      }
      const subs = c.subtasks?.length ?? 0
      return subs ? `${subs} subtask${subs === 1 ? '' : 's'}` : 'no subtasks'
    } catch { return '' }
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[88dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Templates</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-slate-200" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {loading && templates.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />Loading…
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="py-8 text-center">
              <LayoutTemplate className="h-10 w-10 text-gray-200 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-slate-400">No templates yet.</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Save a project or task as a template from its menu, then reuse it here.
              </p>
            </div>
          )}

          {/* Project templates */}
          {projectTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-500 mb-2">
                <FolderPlus className="h-3.5 w-3.5" /> Project templates
              </div>
              <div className="space-y-2">
                {projectTemplates.map(tpl => (
                  <div key={tpl.id} className="rounded-lg border border-gray-100 dark:border-slate-700 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{tpl.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{summarize(tpl)}</p>
                      </div>
                      <button
                        onClick={() => remove(tpl)}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500 rounded flex-shrink-0"
                        aria-label="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={nameOverride[tpl.id] ?? ''}
                        onChange={e => setNameOverride(s => ({ ...s, [tpl.id]: e.target.value }))}
                        placeholder={tpl.name}
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => applyProject(tpl)}
                        disabled={applyingId === tpl.id}
                      >
                        {applyingId === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Create
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task templates */}
          {taskTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-500 mb-2">
                <ListPlus className="h-3.5 w-3.5" /> Task templates
              </div>
              <div className="space-y-2">
                {taskTemplates.map(tpl => (
                  <div key={tpl.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-slate-700 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{tpl.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{summarize(tpl)}</p>
                    </div>
                    <button
                      onClick={() => remove(tpl)}
                      className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500 rounded flex-shrink-0"
                      aria-label="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Apply a task template from a project&apos;s <strong>New Task</strong> menu.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
