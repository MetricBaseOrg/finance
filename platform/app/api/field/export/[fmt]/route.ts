import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'
import { buildExport, type Dataset } from '@/lib/field/io'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ fmt: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fmt } = await params
  if (fmt !== 'csv' && fmt !== 'xlsx') {
    return NextResponse.json({ error: 'fmt must be csv or xlsx' }, { status: 400 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('date_from') || undefined
  const to = url.searchParams.get('date_to') || undefined
  const dateWhere = from || to ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}

  const [flows, transfers, liftings, org] = await Promise.all([
    prisma.flow.findMany({
      where: { organizationId: ctx.organizationId, ...dateWhere },
      include: { node: { select: { code: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.transfer.findMany({
      where: { organizationId: ctx.organizationId, ...dateWhere },
      include: { fromNode: { select: { code: true } }, toNode: { select: { code: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.lifting.findMany({
      where: { organizationId: ctx.organizationId },
      include: { fromNode: { select: { code: true } }, buyerNode: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { slug: true } }),
  ])

  const rows: Record<Dataset, (string | number | null)[][]> = {
    flows: flows.map((f) => [f.node.code, f.date, f.flowType, f.volume, f.swPct ?? '', f.category ?? '', f.memo ?? '']),
    transfers: transfers.map((t) => [t.fromNode.code, t.toNode.code, t.date, t.volume, t.receiptVolume ?? '', t.memo ?? '']),
    liftings: liftings.map((l) => [
      l.tankerName, l.fromNode?.code ?? '', l.buyerNode?.code ?? '',
      l.startLoad ?? '', l.stopLoad ?? '', l.nominated ?? '', l.blVolume ?? '', l.cqdVolume ?? '', l.status, l.notes ?? '',
    ]),
  }

  const { buffer, mime, filename } = await buildExport(fmt, rows, org?.slug || 'fieldflow')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
