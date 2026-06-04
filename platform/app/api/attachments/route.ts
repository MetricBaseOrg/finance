import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import * as onedrive from '@/lib/onedrive'
import * as googledrive from '@/lib/googledrive'
import { describeLinkAttachment } from '@/lib/attachment-url'
import { logActivity } from '@/lib/activity'
import { can, getRole, getWorkspaceForTask } from '@/lib/permissions'

const MAX_ATTACHMENT_BYTES = onedrive.MAX_ATTACHMENT_BYTES

// Cloud providers that host an uploaded file (vs. "link" which references a URL).
const CLOUD = { onedrive, googledrive } as const
type CloudProvider = keyof typeof CLOUD

/**
 * GET /api/attachments?taskId=...
 * Returns every attachment on a task. Caller must be a workspace member.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })

  // Verify membership in the task's workspace
  const access = await assertMember(taskId, session.user.id)
  if (!access.ok) return access.res

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    include: { uploader: { select: { id: true, name: true, email: true, image: true } } },
  })
  return NextResponse.json(attachments)
}

/**
 * POST /api/attachments — two modes:
 *
 *   1. multipart/form-data { taskId, file }  → uploads to the user's OneDrive,
 *      creates an anonymous share link, writes the row.
 *   2. application/json   { taskId, url, name? } → "link attachment": references
 *      a pasted Google Drive / OneDrive / arbitrary share URL without hosting
 *      anything. Needs no OneDrive connection.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Link attachment (pasted URL) — no file upload / OneDrive required.
  if ((req.headers.get('content-type') || '').includes('application/json')) {
    return postLink(req, session.user.id)
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })

  const taskId = form.get('taskId')
  const file = form.get('file')
  const providerRaw = form.get('provider')
  const provider: CloudProvider = providerRaw === 'googledrive' ? 'googledrive' : 'onedrive'
  if (typeof taskId !== 'string') return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'empty file' }, { status: 400 })
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The current limit is 4 MB.` },
      { status: 413 },
    )
  }

  const access = await assertMember(taskId, session.user.id)
  if (!access.ok) return access.res

  const organizationId = await getWorkspaceForTask(taskId)
  const role = organizationId ? await getRole(session.user.id, organizationId) : null
  if (!role || !can(role, 'attachment.upload')) {
    return NextResponse.json({ error: 'Your role does not permit uploading attachments.' }, { status: 403 })
  }

  // Has the user connected the chosen provider yet?
  const connected = provider === 'googledrive'
    ? await prisma.googleAccount.findUnique({ where: { userId: session.user.id } })
    : await prisma.microsoftAccount.findUnique({ where: { userId: session.user.id } })
  if (!connected) {
    const label = provider === 'googledrive' ? 'Google Drive' : 'OneDrive'
    return NextResponse.json(
      { error: `${label} not connected. Connect it before uploading.`, code: `${provider}_not_connected` },
      { status: 412 },
    )
  }

  // Buffer the file (<= 4 MB is small enough for Node memory)
  const buf = Buffer.from(await file.arrayBuffer())
  const cloud = CLOUD[provider]

  let item
  try {
    item = await cloud.uploadFile({
      userId: session.user.id,
      taskId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      body: buf,
    })
  } catch (err) {
    console.error(`${provider} upload failed`, err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 502 })
  }

  let shareUrl: string
  try {
    shareUrl = await cloud.createAnonymousLink(session.user.id, item.id)
  } catch (err) {
    console.error('createLink failed', err)
    return NextResponse.json({ error: 'Could not create share link' }, { status: 502 })
  }

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId,
      uploaderId: session.user.id,
      name: file.name,
      size: file.size,
      mimeType: file.type || null,
      provider,
      msItemId: item.id,
      shareUrl,
      thumbnailUrl: item.thumbnailUrl || null,
    },
    include: { uploader: { select: { id: true, name: true, email: true, image: true } } },
  })

  void logActivity({
    taskId,
    userId: session.user.id,
    kind: 'comment.added', // reuse a kind; we'll add a real 'attachment.added' kind in a follow-up
    metadata: { preview: `attached ${file.name}`, attachmentId: attachment.id },
  })

  return NextResponse.json(attachment)
}

/**
 * Handle a link attachment: JSON { taskId, url, name? }. Validates the URL,
 * checks membership + permission, and writes a row with msItemId = null.
 */
async function postLink(req: Request, userId: string) {
  const body = await req.json().catch(() => null) as { taskId?: unknown; url?: unknown; name?: unknown } | null
  if (!body || typeof body.taskId !== 'string') {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  }
  if (typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }
  const link = describeLinkAttachment(body.url, typeof body.name === 'string' ? body.name : null)
  if (!link) {
    return NextResponse.json({ error: 'Enter a valid http(s) link.' }, { status: 400 })
  }

  const access = await assertMember(body.taskId, userId)
  if (!access.ok) return access.res

  const organizationId = await getWorkspaceForTask(body.taskId)
  const role = organizationId ? await getRole(userId, organizationId) : null
  if (!role || !can(role, 'attachment.upload')) {
    return NextResponse.json({ error: 'Your role does not permit adding attachments.' }, { status: 403 })
  }

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: body.taskId,
      uploaderId: userId,
      name: link.name,
      size: 0,
      mimeType: null,
      provider: 'link',
      msItemId: null,
      shareUrl: link.url,
      thumbnailUrl: null,
    },
    include: { uploader: { select: { id: true, name: true, email: true, image: true } } },
  })

  void logActivity({
    taskId: body.taskId,
    userId,
    kind: 'comment.added',
    metadata: { preview: `attached a link: ${link.name}`, attachmentId: attachment.id },
  })

  return NextResponse.json(attachment)
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function assertMember(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      project: {
        select: {
          workspace: { select: { members: { where: { userId }, select: { id: true } } } },
        },
      },
    },
  })
  if (!task) return { ok: false as const, res: NextResponse.json({ error: 'Task not found' }, { status: 404 }) }
  if (task.project.workspace.members.length === 0) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true as const }
}
