import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiSuperAdmin } from '@/lib/superadmin'

/**
 * PATCH /api/admin/users/:id   body: { status?, isSuperAdmin? }
 * Suspend/enable an account and toggle the platform super-admin flag.
 *
 * Guards: a super-admin can't suspend or demote themselves, and the last
 * remaining super-admin can't be demoted (mirrors the last-OWNER invariant).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiSuperAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const body = await req.json().catch(() => ({} as { status?: string; isSuperAdmin?: boolean }))

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true, isSuperAdmin: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: { status?: string; isSuperAdmin?: boolean } = {}

  if (typeof body.status === 'string') {
    if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (target.id === guard.id && body.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 })
    }
    data.status = body.status
  }

  if (typeof body.isSuperAdmin === 'boolean') {
    if (!body.isSuperAdmin) {
      if (target.id === guard.id) {
        return NextResponse.json({ error: 'You cannot remove your own super-admin access.' }, { status: 400 })
      }
      if (target.isSuperAdmin) {
        const count = await prisma.user.count({ where: { isSuperAdmin: true } })
        if (count <= 1) {
          return NextResponse.json({ error: 'At least one super-admin is required.' }, { status: 400 })
        }
      }
    }
    data.isSuperAdmin = body.isSuperAdmin
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, status: true, isSuperAdmin: true },
  })
  return NextResponse.json(updated)
}
