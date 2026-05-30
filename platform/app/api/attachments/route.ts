import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  createAnonymousLink,
  MAX_ATTACHMENT_BYTES,
  uploadFile,
} from '@/lib/onedrive'
import { logActivity } from '@/lib/activity'
import { can, getRole, getWorkspaceForTask } from '@/lib/permissions'

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
 * POST /api/attachments — multipart/form-data with fields:
 *   taskId: string
 *   file:   File (must be < 4 MB)
 *
 * Uploads to the current user's OneDrive, creates an anonymous share link,
 * writes the TaskAttachment row.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })

  const taskId = form.get('taskId')
  const file = form.get('file')
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

  // Has the user connected OneDrive yet?
  const acct = await prisma.microsoftAccount.findUnique({ where: { userId: session.user.id } })
  if (!acct) {
    return NextResponse.json(
      { error: 'OneDrive not connected. Connect from the sidebar before uploading.', code: 'onedrive_not_connected' },
      { status: 412 },
    )
  }

  // Buffer the file (<= 4 MB is small enough for Node memory)
  const buf = Buffer.from(await file.arrayBuffer())

  let item
  try {
    item = await uploadFile({
      userId: session.user.id,
      taskId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      body: buf,
    })
  } catch (err) {
    console.error('OneDrive upload failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 502 })
  }

  let shareUrl: string
  try {
    shareUrl = await createAnonymousLink(session.user.id, item.id)
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
