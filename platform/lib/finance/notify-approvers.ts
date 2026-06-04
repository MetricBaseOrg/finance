import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/**
 * Notify the workspace's OWNER/ADMIN approvers when a MEMBER submits a
 * transaction for approval. Creates in-app Notification records and sends
 * emails (fire-and-forget; email is a no-op without RESEND_API_KEY).
 */
export async function notifyApprovers(opts: {
  organizationId: string
  slug: string
  actorId: string
  actorName: string
  detail: string
  txType?: string
  memo?: string
}): Promise<void> {
  // Human OWNER/ADMIN only — agents can't approve in the UI and have unroutable
  // emails, and never notify the submitter themselves.
  const approvers = await prisma.membership.findMany({
    where: { organizationId: opts.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { user: { select: { id: true, email: true, kind: true, emailNotifications: true } } },
  })
  const recipients = approvers
    .map((m) => m.user)
    .filter((u) => u.kind !== 'AGENT' && u.id !== opts.actorId)
  if (recipients.length === 0) return

  const url = `${APP_URL}/finance/${opts.slug}/transactions`
  const body = opts.memo ? `${opts.detail} — ${opts.memo}` : opts.detail

  await prisma.notification.createMany({
    data: recipients.map((u) => ({
      organizationId: opts.organizationId,
      userId: u.id,
      actorId: opts.actorId,
      module: 'finance',
      title: `${opts.actorName} submitted a transaction for approval`,
      body,
      href: url,
    })),
  })

  // In-app records go to everyone; email only to those who haven't muted it.
  const emails = recipients
    .filter((u) => u.emailNotifications)
    .map((u) => u.email)
    .filter(Boolean) as string[]
  if (emails.length === 0) return
  const subject = `Approval needed: ${opts.actorName} submitted a transaction`
  const html = `<p><strong>${escapeHtml(opts.actorName)}</strong> submitted ${escapeHtml(opts.detail)} for approval.</p>
<p><a href="${url}">Review pending transactions →</a></p>`
  const text = `${opts.actorName} submitted ${opts.detail} for approval.\nReview: ${url}`
  await Promise.all(emails.map((to) => sendEmail({ to, subject, html, text }).catch(() => false)))
}

/**
 * Notify the original submitter when an OWNER/ADMIN approves or rejects their
 * transaction. In-app + email (no-op without RESEND_API_KEY / agent recipients).
 */
export async function notifyTransactionDecision(opts: {
  organizationId: string
  slug: string
  recipientUserId: string | null
  approverId: string
  approverName: string
  approved: boolean
  detail: string
}): Promise<void> {
  // Nothing to do if there's no submitter, or the decider is the submitter.
  if (!opts.recipientUserId || opts.recipientUserId === opts.approverId) return

  const user = await prisma.user.findUnique({
    where: { id: opts.recipientUserId },
    select: { email: true, kind: true, emailNotifications: true },
  })
  if (!user || user.kind === 'AGENT') return

  const url = `${APP_URL}/finance/${opts.slug}/transactions`
  const verb = opts.approved ? 'approved' : 'rejected'

  await prisma.notification.create({
    data: {
      organizationId: opts.organizationId,
      userId: opts.recipientUserId,
      actorId: opts.approverId,
      module: 'finance',
      title: `Your transaction was ${verb}`,
      body: opts.detail,
      href: url,
    },
  })

  // In-app record above always fires; email respects the recipient's toggle.
  if (!user.email || !user.emailNotifications) return
  const subject = `Transaction ${verb}`
  const html = `<p>Your transaction <strong>${escapeHtml(opts.detail)}</strong> was ${verb} by ${escapeHtml(opts.approverName)}.</p>
<p><a href="${url}">View transactions →</a></p>`
  const text = `Your transaction ${opts.detail} was ${verb} by ${opts.approverName}.\n${url}`
  await sendEmail({ to: user.email, subject, html, text }).catch(() => false)
}
