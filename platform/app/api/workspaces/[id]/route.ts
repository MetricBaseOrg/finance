import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { can, getRole } from '@/lib/permissions'

/**
 * PATCH /api/workspaces/:id   body: { name?, description?, color? }
 * Update workspace details. Requires OWNER or ADMIN.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const role = await getRole(session.user.id, id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!can(role, 'workspace.update')) {
    return NextResponse.json({ error: 'Only an Owner or Admin can edit the workspace.' }, { status: 403 })
  }

  const data = await req.json().catch(() => ({}))
  const name = typeof data.name === 'string' ? data.name.trim() : undefined
  if (name !== undefined && name.length === 0) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  }

  const workspace = await prisma.organization.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(typeof data.color === 'string' && data.color && { color: data.color }),
    },
    select: { id: true, name: true, description: true, color: true, slug: true },
  })

  return NextResponse.json(workspace)
}

/**
 * DELETE /api/workspaces/:id — permanently delete a workspace and everything
 * in it (projects, tasks, members, templates). Requires OWNER. Body must echo
 * the workspace name as a typed confirmation, mirroring the UI guard.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const role = await getRole(session.user.id, id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!can(role, 'workspace.delete')) {
    return NextResponse.json({ error: 'Only the Owner can delete a workspace.' }, { status: 403 })
  }

  // Typed-confirmation guard (defense-in-depth alongside the UI prompt)
  const body = await req.json().catch(() => ({}))
  const ws = await prisma.organization.findUnique({ where: { id }, select: { name: true } })
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (typeof body.confirm !== 'string' || body.confirm.trim() !== ws.name) {
    return NextResponse.json(
      { error: 'Confirmation text does not match the workspace name.' },
      { status: 400 },
    )
  }

  await prisma.organization.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
