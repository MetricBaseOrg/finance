import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeBot, logBotAudit } from '@/server/bot'
import { createFlow } from '@/server/field'

export const dynamic = 'force-dynamic'

// Add a flow record from the bot. Members and up (field.write).
// Body: { telegram_user_id, node_code | nodeId, flowType, volume, date?, memo? }
export async function POST(req: NextRequest) {
  const a = await authorizeBot(req, 'field.write')
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const body = a.body
  let nodeId = body.nodeId ? String(body.nodeId) : ''

  // Bot users reference nodes by their human code (e.g. "TANK1"), not the cuid.
  const nodeCode = body.node_code ?? body.nodeCode
  if (!nodeId && nodeCode) {
    const node = await prisma.node.findFirst({
      where: { organizationId: a.actor.organizationId, code: String(nodeCode) },
      select: { id: true },
    })
    if (!node) return NextResponse.json({ error: `No node with code "${nodeCode}"` }, { status: 400 })
    nodeId = node.id
  }

  const date = body.date ? String(body.date) : new Date().toISOString().slice(0, 10)

  const result = await createFlow(
    { organizationId: a.actor.organizationId, userId: a.actor.user.id },
    { ...body, nodeId, date, reportedBy: a.actor.user.name ?? a.actor.user.email },
  )
  if (!result.ok) {
    await logBotAudit({ botUserId: BigInt(String(body.telegram_user_id ?? body.telegramUserId)), eventType: 'command', command: '/addflow', status: 'error', error: result.error })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBotAudit({ botUserId: BigInt(String(body.telegram_user_id ?? body.telegramUserId)), eventType: 'command', command: '/addflow', status: 'ok', payload: result.flow.id })
  return NextResponse.json({ ok: true, flow: { id: result.flow.id, flowType: result.flow.flowType, volume: result.flow.volume, date: result.flow.date } }, { status: 201 })
}
