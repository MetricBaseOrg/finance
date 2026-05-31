'use client'

import { useState, useEffect } from 'react'
import { Sparkles, LayoutTemplate } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils'
import { localInputToIso } from '@/lib/tasks/when'
import toast from 'react-hot-toast'

interface Member {
  id: string
  user: { id: string; name?: string | null; email?: string | null }
}

interface TaskTemplate {
  id: string
  name: string
  content: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  organizationId?: string
  defaultStatus?: string
  members?: Member[]
  userRole?: string | null
  currentUserId?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (task: any) => void
}

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const
const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NO_PRIORITY'] as const

export function NewTaskDialog({ open, onOpenChange, projectId, organizationId, defaultStatus = 'TODO', members = [], userRole, currentUserId, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [applyingTemplate, setApplyingTemplate] = useState(false)

  // Load TASK templates for this workspace when the dialog opens
  useEffect(() => {
    if (!open || !organizationId) return
    fetch(`/api/templates?organizationId=${organizationId}&kind=TASK`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [open, organizationId])

  const applyTemplate = async (templateId: string) => {
    setApplyingTemplate(true)
    try {
      const res = await fetch(`/api/templates/${templateId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to apply template'); return }
      onOpenChange(false)
      onCreated(data.task)
      toast.success('Task created from template')
    } catch {
      toast.error('Failed to apply template')
    } finally {
      setApplyingTemplate(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          status,
          priority,
          dueDate: localInputToIso(dueDate) || undefined,
          startDate: localInputToIso(startDate) || undefined,
          assigneeId: assigneeId || undefined,
          projectId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const task = await res.json()
      setTitle('')
      setDescription('')
      setStatus('TODO')
      setPriority('MEDIUM')
      setDueDate('')
      setStartDate('')
      setAssigneeId('')
      onOpenChange(false)
      onCreated(task)
    } catch {
      toast.error('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        {/* Start from template */}
        {templates.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2">
            <LayoutTemplate className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            <span className="text-xs text-gray-2 flex-shrink-0">From template:</span>
            <Select
              value=""
              onValueChange={v => v && applyTemplate(v)}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder={applyingTemplate ? 'Applying…' : 'Pick a template'} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Task title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="text-base font-medium"
            />
          </div>
          <div>
            <Textarea
              placeholder="Add description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-3 mb-1">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-3 mb-1">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-3 mb-1">Start</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-line bg-bg-card px-3 py-1 text-sm text-gray-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-3 mb-1">Due</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-line bg-bg-card px-3 py-1 text-sm text-gray-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
          </div>
          {members.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-3 mb-1">Assignee</label>
              <Select
                value={assigneeId || 'none'}
                onValueChange={v => setAssigneeId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map(m => {
                    // Members can only assign to themselves
                    const isDisabled = userRole === 'MEMBER' && m.user.id !== currentUserId
                    return (
                      <SelectItem key={m.user.id} value={m.user.id} disabled={isDisabled}>
                        {m.user.name || m.user.email}{isDisabled ? ' (restricted)' : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
