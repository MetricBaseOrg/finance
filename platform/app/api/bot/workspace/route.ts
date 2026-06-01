import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeBot } from '@/server/bot'

export const dynamic = 'force-dynamic'

// List the user's workspaces, or switch the bot's active workspace.
// Body: { telegram_user_id, set?: <orgId | 1-based index> }
export async function POST(req: NextRequest) {
  const a = await authorizeBot(req)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const orgs = a.actor.orgs
  const set = a.body.set

  if (set != null && String(set).trim() !== '') {
    const key = String(set).trim()
    // Accept either an org id or a 1-based index from the listed order.
    const byIndex = /^\d+$/.test(key) ? orgs[Number(key) - 1] : undefined
    const target = orgs.find((o) => o.id === key) ?? byIndex
    if (!target) return NextResponse.json({ error: 'Unknown workspace' }, { status: 400 })

    await prisma.user.update({ where: { id: a.actor.user.id }, data: { telegramActiveOrgId: target.id } })
    return NextResponse.json({
      ok: true,
      active: { id: target.id, name: target.name, role: target.role },
      workspaces: orgs.map((o) => ({ id: o.id, name: o.name, role: o.role })),
    })
  }

  return NextResponse.json({
    active: { id: a.actor.organizationId, name: a.actor.organizationName, role: a.actor.role },
    workspaces: orgs.map((o) => ({ id: o.id, name: o.name, role: o.role })),
  })
}
