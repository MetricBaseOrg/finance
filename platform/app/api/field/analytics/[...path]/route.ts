import { NextRequest, NextResponse } from 'next/server'
import { getFieldContext } from '@/server/field'
import { fieldEngine } from '@/server/field-engine'

export const dynamic = 'force-dynamic'

// Proxy analytics requests to the Python field-engine, scoped to the active org.
// e.g. GET /api/field/analytics/summary  → engine /compute/analytics/summary
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await params
  const query: Record<string, string> = {}
  new URL(req.url).searchParams.forEach((v, k) => (query[k] = v))

  const result = await fieldEngine.analytics(ctx.organizationId, (path ?? []).join('/'), query)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  return NextResponse.json(result.data)
}
