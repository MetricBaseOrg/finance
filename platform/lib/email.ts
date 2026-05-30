import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

/**
 * Thin Resend wrapper. The whole module is a no-op when RESEND_API_KEY is
 * missing — this keeps local dev working without any credentials and lets us
 * ship the feature behind an env-var "feature flag".
 */

let _client: Resend | null = null
function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY)
  return _client
}

const FROM = process.env.EMAIL_FROM || 'ProBase <noreply@example.com>'
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')

interface SendArgs {
  to: string
  subject: string
  html: string
  text?: string
}

/** Send one email. Returns false (and logs) when disabled or on error. */
export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<boolean> {
  const c = client()
  if (!c) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email:disabled] would send "${subject}" to ${to}`)
    }
    return false
  }
  try {
    const { error } = await c.emails.send({ from: FROM, to, subject, html, text })
    if (error) {
      console.error('Resend send error', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Resend exception', err)
    return false
  }
}

// ── Instant: @mention or assignment ──────────────────────────────────────────

interface InstantOpts {
  recipientUserId: string
  actorId: string
  taskId: string
  kind: 'mention' | 'task.assigned' | 'comment.added'
  preview?: string
}

/**
 * Send an instant email for high-priority events (mentions, assignments).
 * We don't await this from API routes — fire-and-forget so the user never
 * waits on SMTP latency.
 */
export async function sendInstantEmail(opts: InstantOpts) {
  try {
    const [recipient, actor, task] = await Promise.all([
      prisma.user.findUnique({
        where: { id: opts.recipientUserId },
        select: { email: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: opts.actorId },
        select: { name: true, email: true },
      }),
      prisma.task.findUnique({
        where: { id: opts.taskId },
        select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
      }),
    ])
    if (!recipient?.email || !task) return
    const actorName = actor?.name || actor?.email || 'Someone'
    const subject = subjectFor(opts.kind, actorName, task.title)
    const url = `${APP_URL}/projects/${task.projectId}`
    const html = renderInstantEmail({
      recipientName: recipient.name || recipient.email,
      actorName,
      kind: opts.kind,
      taskTitle: task.title,
      projectName: task.project.name,
      preview: opts.preview,
      url,
    })
    await sendEmail({
      to: recipient.email,
      subject,
      html,
      text: `${actorName} ${verbFor(opts.kind)} "${task.title}".\n\nOpen: ${url}`,
    })
  } catch (err) {
    console.error('sendInstantEmail failed', err)
  }
}

function subjectFor(kind: InstantOpts['kind'], actor: string, taskTitle: string): string {
  switch (kind) {
    case 'mention':       return `${actor} mentioned you on "${taskTitle}"`
    case 'task.assigned': return `${actor} assigned you "${taskTitle}"`
    case 'comment.added': return `${actor} commented on "${taskTitle}"`
  }
}

function verbFor(kind: InstantOpts['kind']): string {
  switch (kind) {
    case 'mention':       return 'mentioned you in a comment on'
    case 'task.assigned': return 'assigned you to'
    case 'comment.added': return 'commented on'
  }
}

// ── Daily digest ─────────────────────────────────────────────────────────────

/**
 * Send a digest email to every user with unread notifications older than
 * `instantWindowMinutes` (so we don't double up with an instant email that
 * already covered the same event). Returns the number of digests sent.
 */
export async function sendDigests(opts: { instantWindowMinutes?: number } = {}): Promise<number> {
  const windowMin = opts.instantWindowMinutes ?? 60
  const cutoff = new Date(Date.now() - windowMin * 60 * 1000)

  // Group unread notifications by user
  const unread = await prisma.taskNotification.findMany({
    where: { read: false, createdAt: { lte: cutoff } },
    orderBy: { createdAt: 'desc' },
  })
  if (unread.length === 0) return 0

  const byUser = new Map<string, typeof unread>()
  for (const n of unread) {
    const list = byUser.get(n.userId) || []
    list.push(n)
    byUser.set(n.userId, list)
  }

  // Resolve actor + task once
  const allTaskIds = [...new Set(unread.map(n => n.taskId).filter(Boolean) as string[])]
  const allActorIds = [...new Set(unread.map(n => n.actorId).filter(Boolean) as string[])]
  const [tasks, actors] = await Promise.all([
    allTaskIds.length
      ? prisma.task.findMany({
          where: { id: { in: allTaskIds } },
          select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
        })
      : Promise.resolve([]),
    allActorIds.length
      ? prisma.user.findMany({
          where: { id: { in: allActorIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ])
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const actorMap = new Map(actors.map(a => [a.id, a]))

  let sent = 0
  for (const [userId, items] of byUser) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!user?.email) continue

    const rows = items.map(n => ({
      id: n.id,
      kind: n.kind,
      createdAt: n.createdAt,
      task: n.taskId ? taskMap.get(n.taskId) : undefined,
      actor: n.actorId ? actorMap.get(n.actorId) : undefined,
      meta: parseMeta(n.metadata),
    }))

    const subject = `${items.length} new update${items.length === 1 ? '' : 's'} in ProBase`
    const html = renderDigestEmail({
      recipientName: user.name || user.email,
      rows,
      url: APP_URL,
    })
    const ok = await sendEmail({
      to: user.email,
      subject,
      html,
      text: rows.map(r => digestLine(r)).join('\n'),
    })
    if (ok) sent++
  }
  return sent
}

function parseMeta(s: string | null): Record<string, unknown> {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}

function digestLine(r: { kind: string; task?: { title: string } | undefined; actor?: { name?: string | null; email?: string | null } | undefined; meta: Record<string, unknown> }): string {
  const who = r.actor?.name || r.actor?.email || 'Someone'
  const what = r.task?.title || ''
  switch (r.kind) {
    case 'mention':       return `${who} mentioned you on "${what}"`
    case 'task.assigned': return `${who} assigned you to "${what}"`
    case 'comment.added': return `${who} commented on "${what}"`
    default:              return `${who} updated "${what}"`
  }
}

// ── HTML templates ───────────────────────────────────────────────────────────

interface InstantTplArgs {
  recipientName: string
  actorName: string
  kind: InstantOpts['kind']
  taskTitle: string
  projectName: string
  preview?: string
  url: string
}

function renderInstantEmail(a: InstantTplArgs): string {
  const verb = verbFor(a.kind)
  return shellHtml(
    `Hi ${esc(a.recipientName.split(' ')[0])},`,
    `
      <p style="font-size:15px;line-height:1.55;color:#374151;margin:0 0 12px">
        <strong>${esc(a.actorName)}</strong> ${esc(verb)}
        <strong>${esc(a.taskTitle)}</strong>
        in <em>${esc(a.projectName)}</em>.
      </p>
      ${a.preview ? `
        <blockquote style="margin:14px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f5f3ff;color:#4b5563;font-size:14px;border-radius:4px">
          ${esc(a.preview)}
        </blockquote>` : ''}
    `,
    'View task',
    a.url,
  )
}

interface DigestTplArgs {
  recipientName: string
  rows: Array<{
    kind: string
    task?: { id: string; title: string; projectId: string; project: { name: string } } | undefined
    actor?: { name?: string | null; email?: string | null } | undefined
    meta: Record<string, unknown>
  }>
  url: string
}

function renderDigestEmail(a: DigestTplArgs): string {
  const items = a.rows.slice(0, 25).map(r => {
    const who = esc(r.actor?.name || r.actor?.email || 'Someone')
    const what = esc(r.task?.title || '')
    const link = r.task ? `${a.url}/projects/${r.task.projectId}` : a.url
    const desc = (() => {
      switch (r.kind) {
        case 'mention':       return `mentioned you on <strong>${what}</strong>`
        case 'task.assigned': return `assigned you <strong>${what}</strong>`
        case 'comment.added': return `commented on <strong>${what}</strong>`
        default:              return `updated <strong>${what}</strong>`
      }
    })()
    const preview = typeof r.meta.preview === 'string' ? r.meta.preview : ''
    return `
      <li style="padding:12px 0;border-bottom:1px solid #e5e7eb;list-style:none">
        <div style="font-size:14px;color:#374151"><strong>${who}</strong> ${desc}</div>
        ${preview ? `<div style="font-size:13px;color:#6b7280;margin-top:4px;font-style:italic">“${esc(preview)}”</div>` : ''}
        <a href="${link}" style="display:inline-block;font-size:12px;color:#6366f1;margin-top:6px;text-decoration:none">Open →</a>
      </li>`
  }).join('')

  return shellHtml(
    `Hi ${esc(a.recipientName.split(' ')[0])},`,
    `
      <p style="font-size:15px;line-height:1.55;color:#374151;margin:0 0 12px">
        Here's what happened in your workspace${a.rows.length === 1 ? '' : 's'} since you last checked in:
      </p>
      <ul style="margin:0;padding:0">${items}</ul>
      ${a.rows.length > 25 ? `<p style="font-size:12px;color:#9ca3af;margin-top:12px">…and ${a.rows.length - 25} more.</p>` : ''}
    `,
    'Open ProBase',
    a.url,
  )
}

function shellHtml(greeting: string, body: string, ctaText: string, ctaHref: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px 28px 16px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:18px;font-weight:700;color:#111827">ProBase</span>
        </td></tr>
        <tr><td style="padding:24px 28px">
          <p style="font-size:15px;color:#111827;margin:0 0 12px">${greeting}</p>
          ${body}
          <div style="margin-top:24px">
            <a href="${ctaHref}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(ctaText)}</a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #f3f4f6">
          <p style="font-size:11px;color:#9ca3af;margin:0">You're receiving this because you're a member of a ProBase workspace.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
