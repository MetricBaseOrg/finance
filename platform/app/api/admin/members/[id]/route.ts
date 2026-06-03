import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiSuperAdmin } from '@/lib/superadmin'
import { isRole, type Role } from '@/lib/permissions'
import { isAppId } from '@/lib/apps'

/**
 * PATCH /api/admin/members/:id   body: { role?, appAccess? }
 * Super-admin scope: set a membership's role and/or per-app allow-list. Bypasses
 * org-role checks but still enforces the last-OWNER invariant.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiSuperAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const body = await req.json().catch(() => ({} as { role?: string; appAccess?: unknown }))

  const target = await prisma.membership.findUnique({
    where: { id },
    select: { id: true, role: true, organizationId: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: { role?: Role; appAccess?: string[] } = {}

  if (typeof body.role === 'string') {
    if (!isRole(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    // Last-OWNER guard: don't demote the only owner of the org.
    if (target.role === 'OWNER' && body.role !== 'OWNER') {
      const ownerCount = await prisma.membership.count({
        where: { organizationId: target.organizationId, role: 'OWNER' },
      })
      if (ownerCount <= 1) {
        return NextResponse.json({ error: 'An organization must have at least one Owner.' }, { status: 400 })
      }
    }
    data.role = body.role
  }

  if (body.appAccess !== undefined) {
    if (!Array.isArray(body.appAccess)) {
      return NextResponse.json({ error: 'Invalid appAccess' }, { status: 400 })
    }
    // Keep only valid, de-duplicated app ids. Empty array = all apps.
    const valid = (body.appAccess as unknown[]).filter((a): a is string => isAppId(a))
    data.appAccess = [...new Set(valid)]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.membership.update({
    where: { id },
    data,
    select: {
      id: true,
      role: true,
      appAccess: true,
      trialEndsAt: true,
      user: { select: { id: true, name: true, email: true, image: true, status: true } },
    },
  })
  return NextResponse.json(updated)
}

/**
 * DELETE /api/admin/members/:id — remove a membership. Enforces last-OWNER.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiSuperAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const target = await prisma.membership.findUnique({
    where: { id },
    select: { id: true, role: true, organizationId: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (target.role === 'OWNER') {
    const ownerCount = await prisma.membership.count({
      where: { organizationId: target.organizationId, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      return NextResponse.json({ error: 'An organization must have at least one Owner.' }, { status: 400 })
    }
  }

  await prisma.membership.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
