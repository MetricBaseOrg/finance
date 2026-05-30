import { NextResponse } from 'next/server'
import { getFieldContext } from '@/server/field'
import { parseUpload } from '@/lib/field/io'
import { importFieldData } from '@/lib/field/import'
import { logFieldAudit } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.role === 'VIEWER') return NextResponse.json({ error: 'Your role does not permit importing.' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let parsed
  try {
    parsed = await parseUpload(file.name, buffer)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not parse file' }, { status: 400 })
  }

  const result = await importFieldData(ctx.organizationId, parsed)

  await logFieldAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'IMPORT',
    entityType: 'IMPORT',
    entityId: '-',
    summary: `Imported ${result.flowsImported} flows, ${result.transfersImported} transfers, ${result.liftingsImported} liftings`,
    metadata: { errors: result.errors.length },
  })

  return NextResponse.json(result)
}
