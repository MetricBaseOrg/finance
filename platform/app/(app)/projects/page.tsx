'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FolderKanban, Plus, ArrowRight, LayoutTemplate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewProjectDialog } from '@/components/projects/new-project-dialog'
import { TemplatesDialog } from '@/components/templates/templates-dialog'
import toast from 'react-hot-toast'

interface Project {
  id: string
  name: string
  description?: string | null
  color: string
  status: string
  _count?: { tasks: number; milestones?: number }
}

interface Workspace {
  id: string
  name: string
  color: string
  projects: Project[]
  _count?: { projects: number; members: number }
}

export default function ProjectsIndexPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newProjectWsId, setNewProjectWsId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to load workspaces', res.status, err)
        toast.error(err?.error || 'Failed to load projects')
        setWorkspaces([])
        return
      }
      const data = await res.json()
      setWorkspaces(data)
    } catch (err) {
      console.error('Workspaces fetch error', err)
      toast.error('Failed to load projects')
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWorkspaces() }, [])

  const allProjects = workspaces.flatMap(w => (w.projects || []).map(p => ({ project: p, workspace: w })))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-1 flex items-center gap-2">
            <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
            Projects
          </h1>
          <p className="text-sm text-gray-3 mt-1">
            {allProjects.length} project{allProjects.length !== 1 ? 's' : ''} across {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </p>
        </div>
        {workspaces.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTemplates(true)}
              size="sm"
            >
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
            <Button
              onClick={() => { setNewProjectWsId(workspaces[0].id); setShowNew(true) }}
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </Button>
          </div>
        )}
      </div>

      {/* Empty */}
      {allProjects.length === 0 && (
        <div className="bg-bg-card rounded-xl border border-line p-8 sm:p-12 text-center">
          <FolderKanban className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-gray-1 mb-1">No projects yet</h2>
          <p className="text-sm text-gray-3 mb-4">
            Create your first project to start tracking tasks
          </p>
          {workspaces.length > 0 && (
            <Button onClick={() => { setNewProjectWsId(workspaces[0].id); setShowNew(true) }}>
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          )}
        </div>
      )}

      {/* Grouped by workspace */}
      <div className="space-y-6 sm:space-y-8">
        {workspaces.map(ws => {
          const projects = ws.projects || []
          if (projects.length === 0) return null
          return (
            <section key={ws.id}>
              {/* Workspace header */}
              <div className="flex items-center justify-between mb-2 sm:mb-3 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ backgroundColor: ws.color }}
                  >
                    {ws.name[0].toUpperCase()}
                  </div>
                  <h2 className="text-sm font-semibold text-gray-2 truncate">{ws.name}</h2>
                  <span className="text-xs text-gray-4 flex-shrink-0">
                    {projects.length}
                  </span>
                </div>
                <button
                  onClick={() => { setNewProjectWsId(ws.id); setShowNew(true) }}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-4 hover:text-gray-700 hover:bg-bg-hover"
                  aria-label={`New project in ${ws.name}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Project cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.map(p => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="group bg-bg-card rounded-xl border border-line p-4 hover:border-border-str hover:shadow-sm transition-all active:bg-bg-hover"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-1 truncate group-hover:text-indigo-600">
                            {p.name}
                          </h3>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-4 group-hover:text-indigo-600 transition-colors flex-shrink-0 -ml-1 opacity-0 group-hover:opacity-100" />
                        </div>
                        {p.description && (
                          <p className="text-xs text-gray-3 mt-0.5 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-3">
                          <span>{p._count?.tasks ?? 0} tasks</span>
                          {p.status && p.status !== 'ACTIVE' && (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] uppercase tracking-wide">
                              {p.status.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* New project dialog */}
      {newProjectWsId && (
        <NewProjectDialog
          open={showNew}
          onOpenChange={setShowNew}
          organizationId={newProjectWsId}
          onCreated={() => { fetchWorkspaces(); toast.success('Project created!') }}
        />
      )}

      {/* Templates manager */}
      <TemplatesDialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        organizationId={workspaces[0]?.id ?? null}
        onProjectCreated={fetchWorkspaces}
      />
    </div>
  )
}
