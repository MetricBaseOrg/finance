import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

const MODES = ['auto', 'daily', 'cumulative']

// Saved formulas are per-user (the bracket-reference DSL library).
export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const formulas = await prisma.userFormula.findMany({
    where: { userId: ctx.userId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(formulas)
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  const expr = String(body.expr ?? '').trim()
  if (!name || !expr) return NextResponse.json({ error: 'name and expr are required' }, { status: 400 })
  const refSeriesMode = MODES.includes(body.refSeriesMode) ? body.refSeriesMode : 'auto'

  try {
    const formula = await prisma.userFormula.create({
      data: {
        userId: ctx.userId,
        name,
        expr,
        description: body.description ? String(body.description) : null,
        refSeriesMode,
      },
    })
    return NextResponse.json(formula, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'A formula with that name already exists' }, { status: 409 })
  }
}
