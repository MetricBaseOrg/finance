import { NextResponse } from 'next/server'
import { getFieldContext } from '@/server/field'
import { buildTemplate } from '@/lib/field/io'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ fmt: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fmt } = await params
  if (fmt !== 'csv' && fmt !== 'xlsx') {
    return NextResponse.json({ error: 'fmt must be csv or xlsx' }, { status: 400 })
  }

  const { buffer, mime, filename } = await buildTemplate(fmt)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
