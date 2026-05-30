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
  const approverMemberships = await prisma.membership.findMany({
    where: { organizationId: opts.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  })
  if (approverMemberships.length === 0) return

  const url = `${APP_URL}/finance/${opts.slug}/transactions`

  // Create in-app notifications
  await prisma.notification.createMany({
    data: approverMemberships.map((m) => ({
      organizationId: opts.organizationId,
      userId: m.userId,
      actorId: opts.actorId,
      module: 'finance',
      title: `${opts.actorName} submitted a transaction for approval`,
      body: opts.detail,
      taskId: opts.txType ?? null,
      commentId: opts.memo ?? null,
      href: url,
    })),
  })

  // Send emails
  const approverIds = approverMemberships.map((m) => m.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: approverIds }, email: { not: null } },
    select: { email: true },
  })
  const emails = users.map((u) => u.email).filter(Boolean) as string[]
  if (emails.length === 0) return

  const subject = `Approval needed: ${opts.actorName} submitted a transaction`
  const html = `<p><strong>${escapeHtml(opts.actorName)}</strong> submitted ${escapeHtml(opts.detail)} for approval.</p>
<p><a href="${url}">Review pending transactions →</a></p>`
  const text = `${opts.actorName} submitted ${opts.detail} for approval.\nReview: ${url}`

  await Promise.all(emails.map((to) => sendEmail({ to, subject, html, text }).catch(() => false)))
}
