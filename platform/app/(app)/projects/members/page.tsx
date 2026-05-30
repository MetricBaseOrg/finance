'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Users, UserPlus, Crown, Shield, Eye, Trash2, X, Settings } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WorkspaceSettingsDialog } from '@/components/workspaces/workspace-settings-dialog'
import toast from 'react-hot-toast'

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

interface Member {
  id: string
  role: string
  user: { id: string; name?: string | null; email?: string | null; image?: string | null }
}

interface Workspace {
  id: string
  name: string
  description?: string | null
  color: string
  members: Member[]
  myRole?: string | null
}

const ROLE_ICONS = {
  OWNER:  <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  ADMIN:  <Shield className="h-3.5 w-3.5 text-blue-500" />,
  MEMBER: <Users className="h-3.5 w-3.5 text-gray-500" />,
  VIEWER: <Eye className="h-3.5 w-3.5 text-gray-4" />,
}

const ROLE_COLORS: Record<string, string> = {
  OWNER:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  ADMIN:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  MEMBER: 'bg-gray-100 text-gray-600',
  VIEWER: 'bg-gray-50 text-gray-500',
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER:  'Full control, including deleting the workspace.',
  ADMIN:  'Manage members + everything except deleting the workspace.',
  MEMBER: 'Create / edit projects + tasks, comment, attach files.',
  VIEWER: 'Read-only access to everything.',
}

export default function MembersPage() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(data)
        if (data.length > 0) setSelectedWorkspaceId(data[0].id)
        setLoading(false)
      })
  }, [])

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || null
  const myRole = (selectedWorkspace?.myRole ?? null) as Role | null
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN'

  const updateLocalMember = (id: string, patch: Partial<Member> | null) => {
    setWorkspaces(prev => prev.map(w => w.id !== selectedWorkspaceId ? w : {
      ...w,
      members: patch === null
        ? w.members.filter(m => m.id !== id)
        : w.members.map(m => m.id === id ? { ...m, ...patch } : m),
    }))
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspace) return
    setInviting(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, organizationId: selectedWorkspace.id, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to invite'); return }
      setWorkspaces(prev => prev.map(w => w.id !== selectedWorkspace.id ? w : { ...w, members: [...w.members, data] }))
      setInviteEmail('')
      setShowInvite(false)
      toast.success('Member invited!')
    } catch {
      toast.error('Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (member: Member, newRole: Role) => {
    if (member.role === newRole) return
    const prev = member.role
    updateLocalMember(member.id, { role: newRole })
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        updateLocalMember(member.id, { role: prev })
        toast.error(data.error || 'Failed to change role')
        return
      }
      toast.success(`Updated to ${newRole.toLowerCase()}`)
    } catch {
      updateLocalMember(member.id, { role: prev })
      toast.error('Failed to change role')
    }
  }

  const handleRemove = async (member: Member) => {
    const isSelf = member.user.id === currentUserId
    const prompt = isSelf
      ? `Leave "${selectedWorkspace?.name}"? You'll lose access until invited back.`
      : `Remove ${member.user.name || member.user.email} from "${selectedWorkspace?.name}"?`
    if (!confirm(prompt)) return

    const snapshot = workspaces
    updateLocalMember(member.id, null)
    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setWorkspaces(snapshot)
        toast.error(data.error || 'Failed to remove member')
        return
      }
      toast.success(isSelf ? 'Left the workspace' : 'Member removed')
    } catch {
      setWorkspaces(snapshot)
      toast.error('Failed to remove member')
    }
  }

  // Decide whether the actor can change a particular member's role
  const canChangeRoleOf = (target: Member): boolean => {
    if (!canManage) return false
    if (target.user.id === currentUserId) return false // can't change own role
    if (myRole === 'ADMIN' && target.role === 'OWNER') return false
    return true
  }
  const canRemove = (target: Member): boolean => {
    const isSelf = target.user.id === currentUserId
    if (isSelf) return true // anyone can leave (server enforces last-owner)
    if (!canManage) return false
    if (myRole === 'ADMIN' && target.role === 'OWNER') return false
    return true
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-1 flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
            Members
          </h1>
          {selectedWorkspace && (
            <p className="text-sm text-gray-3 mt-1">
              {selectedWorkspace.members.length} member{selectedWorkspace.members.length !== 1 ? 's' : ''} in {selectedWorkspace.name}
              {myRole && (
                <span className="ml-2 text-[11px] uppercase tracking-wider font-semibold text-gray-4">
                  · your role: {myRole}
                </span>
              )}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-bg-hover hover:text-gray-700"
              title="Workspace settings"
              aria-label="Workspace settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <Button onClick={() => setShowInvite(true)} size="sm">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Invite Member</span>
            </Button>
          </div>
        )}
      </div>

      {!selectedWorkspace ? (
        <div className="text-center py-16 text-gray-4">No workspace found</div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-line overflow-hidden divide-y divide-line">
          {selectedWorkspace.members.map(member => {
            const isSelf = member.user.id === currentUserId
            return (
              <div key={member.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-bg-hover transition-colors">
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                  <AvatarImage src={member.user.image ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                    {getInitials(member.user.name || member.user.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-1 truncate">
                    {member.user.name || 'Unknown'}
                    {isSelf && <span className="ml-1.5 text-[10px] uppercase tracking-wider font-medium text-gray-4">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-3 truncate">{member.user.email}</p>
                </div>

                {/* Role: editable dropdown for managers, static pill otherwise */}
                {canChangeRoleOf(member) ? (
                  <Select
                    value={member.role}
                    onValueChange={v => handleRoleChange(member, v as Role)}
                  >
                    <SelectTrigger className="w-[110px] sm:w-[130px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {myRole === 'OWNER' && <SelectItem value="OWNER">Owner</SelectItem>}
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${ROLE_COLORS[member.role]}`}>
                    {ROLE_ICONS[member.role as keyof typeof ROLE_ICONS]}
                    <span className="hidden sm:inline">{member.role.charAt(0) + member.role.slice(1).toLowerCase()}</span>
                  </div>
                )}

                {canRemove(member) && (
                  <button
                    onClick={() => handleRemove(member)}
                    className="h-8 w-8 flex items-center justify-center text-gray-4 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                    title={isSelf ? 'Leave workspace' : 'Remove from workspace'}
                    aria-label={isSelf ? 'Leave workspace' : 'Remove member'}
                  >
                    {isSelf ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-2 mb-1">Email address</label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-gray-3 mt-1">The user must already have an account</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-2 mb-1">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {myRole === 'OWNER' && <SelectItem value="OWNER">Owner</SelectItem>}
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-3 mt-1.5">
                {ROLE_DESCRIPTIONS[inviteRole]}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Inviting...' : 'Send Invite'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Workspace settings */}
      {selectedWorkspace && (
        <WorkspaceSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          workspace={selectedWorkspace}
          onUpdated={patch => {
            setWorkspaces(prev => prev.map(w => w.id === selectedWorkspace.id ? { ...w, ...patch } : w))
          }}
          onDeleted={() => {
            setWorkspaces(prev => prev.filter(w => w.id !== selectedWorkspace.id))
            const remaining = workspaces.filter(w => w.id !== selectedWorkspace.id)
            setSelectedWorkspaceId(remaining[0]?.id ?? null)
          }}
        />
      )}
    </div>
  )
}
