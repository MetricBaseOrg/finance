import { NextRequest, NextResponse } from 'next/server'
import { getFieldContext } from '@/server/field'
import { fieldEngine } from '@/server/field-engine'

export const dynamic = 'force-dynamic'

// Evaluate a formula-DSL expression via the Python engine (scoped to active org
// and current user, so saved-formula references resolve).
export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  const result = await fieldEngine.evalFormula(ctx.organizationId, { ...body, user_id: ctx.userId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  return NextResponse.json(result.data)
}
