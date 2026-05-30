'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PROJECT_COLORS, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Workspace {
  id: string
  name: string
  description?: string | null
  color: string
  myRole?: string | null
}

/**
 * Edit a workspace's name / description / color, and (for OWNER) delete it.
 * Delete requires typing the workspace name to confirm — mirrored server-side.
 */
export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspace,
  onUpdated,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace
  onUpdated: (patch: Partial<Workspace>) => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description ?? '')
  const [color, setColor] = useState(workspace.color)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Reset local state whenever the dialog opens for a (possibly different) workspace
  useEffect(() => {
    if (open) {
      setName(workspace.name)
      setDescription(workspace.description ?? '')
      setColor(workspace.color)
      setConfirmDelete(false)
      setConfirmText('')
    }
  }, [open, workspace.id, workspace.name, workspace.description, workspace.color])

  const isOwner = workspace.myRole === 'OWNER'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name cannot be empty'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description, color }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to save'); return }
      onUpdated({ name: data.name, description: data.description, color: data.color })
      toast.success('Workspace updated')
      onOpenChange(false)
    } catch {
      toast.error('Failed to save workspace')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Failed to delete'); return }
      toast.success('Workspace deleted')
      onOpenChange(false)
      onDeleted()
      router.push('/projects/dashboard')
    } catch {
      toast.error('Failed to delete workspace')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What's this workspace for?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-lg transition-transform hover:scale-110',
                    color === c && 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-slate-900',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>

        {/* Danger zone — owner only */}
        {isOwner && (
          <div className="mt-2 pt-4 border-t border-red-100 dark:border-red-900/40">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                <Trash2 className="h-4 w-4" />
                Delete this workspace
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    This permanently deletes <strong>{workspace.name}</strong> and every project,
                    task, milestone, and template in it. This cannot be undone.
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2 mb-1">
                  Type <strong>{workspace.name}</strong> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={workspace.name}
                  className="h-8 text-sm"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setConfirmDelete(false); setConfirmText('') }}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting || confirmText.trim() !== workspace.name}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Delete forever
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
