import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

async function ownedChannel(id: string, organizationId: string) {
  const channel = await prisma.channel.findUnique({ where: { id }, select: { id: true, organizationId: true } })
  return channel?.organizationId === organizationId ? channel : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { activeOrg } = await getOrgContext()
  if (!can(activeOrg.role, 'chat.channel.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  if (!(await ownedChannel(id, activeOrg.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name } = await req.json().catch(() => ({}))
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const channel = await prisma.channel.update({
    where: { id },
    data: { name: String(name).slice(0, 60) },
    select: { id: true, name: true, slug: true },
  })
  return NextResponse.json(channel)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { activeOrg } = await getOrgContext()
  if (!can(activeOrg.role, 'chat.channel.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  if (!(await ownedChannel(id, activeOrg.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.channel.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
