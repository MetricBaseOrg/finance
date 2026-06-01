import { NextRequest, NextResponse } from 'next/server'
import { authorizeBot } from '@/server/bot'
import { fieldEngine } from '@/server/field-engine'

export const dynamic = 'force-dynamic'

// Monthly recap. Body may include { year, month }; defaults to current month.
export async function POST(req: NextRequest) {
  const a = await authorizeBot(req, 'field.read')
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const now = new Date()
  const year = String(a.body.year ?? now.getUTCFullYear())
  const month = String(a.body.month ?? now.getUTCMonth() + 1)

  const res = await fieldEngine.analytics(a.actor.organizationId, 'monthly-summary', { year, month })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status ?? 503 })
  return NextResponse.json({ workspace: a.actor.organizationName, year, month, data: res.data })
}
