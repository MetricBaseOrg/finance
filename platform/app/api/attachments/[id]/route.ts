import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import * as onedrive from '@/lib/onedrive'
import * as googledrive from '@/lib/googledrive'

/**
 * DELETE /api/attachments/:id
 *
 * Only the original uploader (or a workspace owner) can delete. Removes the
 * file from OneDrive on a best-effort basis, then deletes the row.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const att = await prisma.taskAttachment.findUnique({
    where: { id },
    include: {
      task: {
        select: {
          project: {
            select: {
              workspace: {
                select: {
                  members: { where: { userId: session.user.id }, select: { role: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = att.task.project.workspace.members[0]?.role
  const isUploader = att.uploaderId === session.user.id
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN'
  if (!isUploader && !isOwnerOrAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Best-effort delete from the hosting cloud — even if this fails we remove the
  // row so the UI is clean. Orphan items get garbage-collected manually. Link
  // attachments (msItemId === null) reference an external URL we don't host, so
  // there's nothing to delete.
  if (att.msItemId) {
    if (att.provider === 'googledrive') await googledrive.deleteItem(att.uploaderId, att.msItemId)
    else await onedrive.deleteItem(att.uploaderId, att.msItemId)
  }
  await prisma.taskAttachment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
