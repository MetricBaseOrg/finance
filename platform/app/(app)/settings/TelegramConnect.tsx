'use client'

import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { generateTelegramLink, disconnectTelegram, type TelegramLinkState } from '@/server/actions/telegram'

export function TelegramConnect({
  initial,
}: {
  initial: { linked: boolean; username: string | null; linkedAt: string | null }
}) {
  const [linked, setLinked] = useState(initial.linked)
  const [link, setLink] = useState<TelegramLinkState | null>(null)
  const [pending, start] = useTransition()

  function onConnect() {
    start(async () => {
      const res = await generateTelegramLink()
      if (res.error) { toast.error(res.error); return }
      setLink(res)
    })
  }

  function onDisconnect() {
    start(async () => {
      await disconnectTelegram()
      setLinked(false)
      setLink(null)
      toast.success('Telegram disconnected')
    })
  }

  return (
    <div className="ws-card" style={{ marginBottom: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {linked ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>
                Connected{initial.username ? ` · @${initial.username}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--mb-ink-muted)', marginTop: 2 }}>
                {initial.linkedAt ? `Linked ${initial.linkedAt}` : 'Telegram account linked'} — the bot acts with your workspace role.
              </div>
            </div>
            <button onClick={onDisconnect} disabled={pending} className="ws-btn"
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', color: 'var(--mb-down, #e5484d)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: pending ? 0.6 : 1 }}>
              Disconnect
            </button>
          </div>
        </>
      ) : link?.deepLink ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--mb-ink)' }}>
            Open the bot and send <code style={codeStyle}>/start {link.code}</code> to finish linking. Code expires in 15 minutes.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={link.deepLink} target="_blank" rel="noreferrer"
              style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--mb-brand)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Open Telegram →
            </a>
            <button onClick={() => { navigator.clipboard?.writeText(link.code ?? ''); toast.success('Code copied') }} className="ws-btn"
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--mb-border)', background: 'var(--mb-surface)', color: 'var(--mb-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Copy code
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mb-ink)' }}>Not connected</div>
              <div style={{ fontSize: 11.5, color: 'var(--mb-ink-muted)', marginTop: 2 }}>
                Link your Telegram to get reports, recaps & lifting status — and log records — from the bot.
              </div>
            </div>
            <button onClick={onConnect} disabled={pending} className="ws-btn"
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--mb-brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {pending ? 'Generating…' : 'Connect Telegram'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--mb-mono, monospace)', background: 'var(--mb-surface)', border: '1px solid var(--mb-border)',
  borderRadius: 5, padding: '1px 6px', fontSize: 12,
}
