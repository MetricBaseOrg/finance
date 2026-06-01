import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeBot } from '@/server/bot'

export const dynamic = 'force-dynamic'

// Lifting status — active & tentative shipments. Viewers and up.
export async function POST(req: NextRequest) {
  const a = await authorizeBot(req, 'field.read')
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const liftings = await prisma.lifting.findMany({
    where: { organizationId: a.actor.organizationId, status: { in: ['active', 'tentative'] } },
    include: {
      fromNode: { select: { code: true, name: true } },
      buyerNode: { select: { code: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })

  return NextResponse.json({
    workspace: a.actor.organizationName,
    liftings: liftings.map((l) => ({
      tanker: l.tankerName,
      status: l.status,
      from: l.fromNode?.name ?? l.fromNode?.code ?? null,
      buyer: l.buyerNode?.name ?? l.buyerNode?.code ?? null,
      nominated: l.nominated,
      blVolume: l.blVolume,
      eta: l.eta,
      laycan: l.laycanStart && l.laycanEnd ? `${l.laycanStart} → ${l.laycanEnd}` : (l.laycanStart ?? null),
    })),
  })
}
