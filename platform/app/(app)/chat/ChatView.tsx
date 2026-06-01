'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Hash, Plus, Send, Bot, UserPlus, Loader2, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/user-avatar'
import toast from 'react-hot-toast'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Channel = { id: string; name: string; slug: string; kind: string; isPrivate: boolean; memberCount: number }
type ChatUser = { id: string; name: string | null; email: string; image: string | null; kind: string }
type Message = { id: string; content: string; createdAt: string; user: ChatUser }

const POLL_MS = 3000

export function ChatView({
  meId, orgName, canSend, canManage,
}: {
  meId: string; orgName: string; canSend: boolean; canManage: boolean
}) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [showMembers, setShowMembers] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | null>(null)

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/channels')
      const data = await res.json()
      setChannels(data.channels || [])
      setActiveId(prev => prev ?? data.channels?.[0]?.id ?? null)
    } catch {
      toast.error('Failed to load channels')
    } finally {
      setLoadingChannels(false)
    }
  }, [])

  useEffect(() => { loadChannels() }, [loadChannels])

  // Load full history when the active channel changes.
  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    lastIdRef.current = null
    setMessages([])
    fetch(`/api/chat/channels/${activeId}/messages`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const msgs: Message[] = d.messages || []
        setMessages(msgs)
        lastIdRef.current = msgs.length ? msgs[msgs.length - 1].id : null
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeId])

  // Poll for new messages.
  useEffect(() => {
    if (!activeId) return
    const tick = async () => {
      const after = lastIdRef.current
      try {
        const res = await fetch(`/api/chat/channels/${activeId}/messages${after ? `?after=${after}` : ''}`)
        const d = await res.json()
        const incoming: Message[] = d.messages || []
        if (incoming.length) {
          if (after) {
            setMessages(prev => [...prev, ...incoming.filter(m => !prev.some(p => p.id === m.id))])
          } else {
            setMessages(incoming)
          }
          lastIdRef.current = incoming[incoming.length - 1].id
        }
      } catch {
        /* transient */
      }
    }
    const handle = setInterval(tick, POLL_MS)
    return () => clearInterval(handle)
  }, [activeId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = async () => {
    const content = draft.trim()
    if (!content || !activeId) return
    setSending(true)
    setDraft('')
    try {
      const res = await fetch(`/api/chat/channels/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const msg = await res.json()
      if (!res.ok) { toast.error(msg.error || 'Failed to send'); return }
      setMessages(prev => prev.some(p => p.id === msg.id) ? prev : [...prev, msg])
      lastIdRef.current = msg.id
    } catch {
      toast.error('Failed to send')
    } finally {
      setSending(false)
    }
  }

  const createChannel = async () => {
    const name = prompt('New channel name')?.trim()
    if (!name) return
    const res = await fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Failed to create channel'); return }
    await loadChannels()
    setActiveId(data.id)
  }

  const active = channels.find(c => c.id === activeId) ?? null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Mobile header */}
      <div className="sm:hidden flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--mb-border)', background: 'var(--mb-surface)' }}>
        <button
          onClick={() => setShowSidebar(s => !s)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mb-ink)', padding: 4 }}
        >
          {showSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mb-ink)' }}>
          {active ? `# ${active.name}` : 'Chat'}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Channel sidebar — hidden on mobile unless toggled */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-20 w-[240px] transition-transform duration-200 sm:relative sm:translate-x-0',
            showSidebar ? 'translate-x-0' : '-translate-x-full'
          )}
          style={{
            borderRight: '1px solid var(--mb-border)', display: 'flex', flexDirection: 'column',
            background: 'var(--mb-surface)',
          }}
        >
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--mb-border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName} · Chat</span>
          {canManage && (
            <button onClick={createChannel} title="New channel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mb-ink-soft)' }}>
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loadingChannels && <div style={{ padding: 12, color: 'var(--mb-ink-soft)', fontSize: 13 }}>Loading…</div>}
          {!loadingChannels && channels.length === 0 && (
            <div style={{ padding: 12, color: 'var(--mb-ink-soft)', fontSize: 13 }}>
              No channels yet.{canManage ? ' Create one with +.' : ''}
            </div>
          )}
          {channels.map(c => (
            <button
              key={c.id}
              onClick={() => { setActiveId(c.id); setShowMembers(false); setShowSidebar(false) }}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: c.id === activeId ? 'var(--mb-brand-weak, rgba(99,102,241,0.12))' : 'transparent',
                color: c.id === activeId ? 'var(--mb-ink)' : 'var(--mb-ink-soft)',
                fontSize: 13.5, fontWeight: c.id === activeId ? 600 : 500,
              }}
            >
              <Hash className="h-3.5 w-3.5" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/40 z-10 sm:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Message pane */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {active ? (
          <>
            <header style={{ padding: '12px 18px', borderBottom: '1px solid var(--mb-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: 'var(--mb-ink)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Hash className="h-4 w-4" /> {active.name}
              </span>
              {canManage && (
                <button
                  onClick={() => setShowMembers(s => !s)}
                  title="Members & agents"
                  style={{ background: 'none', border: '1px solid var(--mb-border)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'var(--mb-ink-soft)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Members
                </button>
              )}
            </header>

            {showMembers && active && (
              <MembersPanel channelId={active.id} onChanged={loadChannels} />
            )}

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              {messages.map(m => (
                <MessageRow key={m.id} message={m} mine={m.user.id === meId} />
              ))}
              {messages.length === 0 && (
                <div style={{ color: 'var(--mb-ink-soft)', fontSize: 13, margin: 'auto' }}>
                  No messages yet. Say hi — or @mention an agent.
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--mb-border)', padding: 12, display: 'flex', gap: 8, flexShrink: 0 }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={canSend ? 'Message (try @agent)' : 'Read-only access'}
                disabled={!canSend || sending}
                className="min-w-0"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', color: 'var(--mb-ink)', fontSize: 14 }}
              />
              <button
                onClick={send}
                disabled={!canSend || sending || !draft.trim()}
                style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--mb-brand)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', opacity: !canSend || !draft.trim() ? 0.5 : 1 }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--mb-ink-soft)' }}>
            {loadingChannels ? 'Loading…' : 'Select or create a channel to start chatting.'}
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

function MessageRow({ message, mine }: { message: Message; mine: boolean }) {
  const isAgent = message.user.kind === 'AGENT'
  const name = message.user.name ?? message.user.email
  return (
    <div style={{ display: 'flex', gap: 10, flexDirection: mine ? 'row-reverse' : 'row' }}>
      {isAgent ? (
        <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: 'var(--mb-brand)', border: '1px solid var(--mb-border)', display: 'grid', placeItems: 'center', color: '#fff' }}>
          <Bot className="h-4 w-4" />
        </div>
      ) : (
        <UserAvatar user={message.user} className="h-[30px] w-[30px]" />
      )}
      <div style={{ maxWidth: '70%', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
          <Link href={`/u/${message.user.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mb-ink)', textDecoration: 'none' }}>{name}</Link>
          {isAgent && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--mb-brand)', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>Agent</span>}
          <span style={{ fontSize: 11, color: 'var(--mb-ink-soft)' }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="chat-md" style={{ padding: '8px 12px', borderRadius: 10, background: mine ? 'var(--mb-brand)' : 'var(--mb-surface)', color: mine ? '#fff' : 'var(--mb-ink)', border: mine ? 'none' : '1px solid var(--mb-border)', fontSize: 14, wordBreak: 'break-word' }}>
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        </div>
      </div>
    </div>
  )
}

function MembersPanel({ channelId, onChanged }: { channelId: string; onChanged: () => void }) {
  const [members, setMembers] = useState<ChatUser[]>([])
  const [candidates, setCandidates] = useState<ChatUser[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/chat/channels/${channelId}/members`)
      .then(r => r.json())
      .then(d => { setMembers(d.members || []); setCandidates(d.candidates || []) })
      .catch(() => {})
  }, [channelId])
  useEffect(() => { load() }, [load])

  const add = async (userId: string) => {
    setBusy(userId)
    try {
      const res = await fetch(`/api/chat/channels/${channelId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) { toast.error('Failed to add'); return }
      load(); onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--mb-border)', background: 'var(--mb-surface)', padding: '12px 18px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-soft)', marginBottom: 6 }}>In this channel</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {members.map(m => (
            <span key={m.id} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--mb-border)', color: 'var(--mb-ink)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {m.kind === 'AGENT' && <Bot className="h-3 w-3" />}{m.name ?? m.email}
            </span>
          ))}
        </div>
      </div>
      {candidates.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-soft)', marginBottom: 6 }}>Add (people & agents)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {candidates.map(c => (
              <button
                key={c.id}
                disabled={busy === c.id}
                onClick={() => add(c.id)}
                style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--mb-border)', background: 'transparent', cursor: 'pointer', color: 'var(--mb-ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Plus className="h-3 w-3" />{c.kind === 'AGENT' && <Bot className="h-3 w-3" />}{c.name ?? c.email}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
