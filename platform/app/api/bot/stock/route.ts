import { NextRequest, NextResponse } from 'next/server'
import { authorizeBot } from '@/server/bot'
import { fieldEngine } from '@/server/field-engine'

export const dynamic = 'force-dynamic'

// Current stock / tank balance. Viewers and up.
export async function POST(req: NextRequest) {
  const a = await authorizeBot(req, 'field.read')
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  const res = await fieldEngine.analytics(a.actor.organizationId, 'stock-balance')
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status ?? 503 })
  return NextResponse.json({ workspace: a.actor.organizationName, data: res.data })
}
