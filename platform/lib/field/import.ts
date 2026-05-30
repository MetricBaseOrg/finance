import 'server-only'
import { prisma } from '@/lib/prisma'
import { normDate, type ParsedRows } from '@/lib/field/io'

/**
 * Apply parsed import rows to the DB, scoped to an organization. Mirrors the
 * old FieldFlow import: flows are upserted on (node, date, flow_type); transfers
 * and liftings are inserted. Per-row failures are collected, not fatal.
 */

const FLOW_TYPES = new Set(['inflow', 'outflow', 'stock'])
const LIFTING_STATUS = new Set(['tentative', 'active', 'completed', 'cancelled'])

function num(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

export async function importFieldData(organizationId: string, parsed: ParsedRows) {
  const nodes = await prisma.node.findMany({ where: { organizationId }, select: { id: true, code: true } })
  const nodeMap = new Map(nodes.map((n) => [n.code.toUpperCase(), n.id]))
  const errors: string[] = []
  let flowsImported = 0
  let transfersImported = 0
  let liftingsImported = 0

  // ── Flows ──
  for (let i = 0; i < parsed.flows.length; i++) {
    const r = parsed.flows[i]
    try {
      const code = (r.node_code || '').trim().toUpperCase()
      const date = normDate(r.date)
      const ftype = (r.flow_type || '').trim().toLowerCase()
      const vol = num(r.volume)
      if (!code || !date || !ftype || vol == null) throw new Error('node_code, date, flow_type, volume are required')
      if (Number.isNaN(vol)) throw new Error('volume must be a number')
      const nodeId = nodeMap.get(code)
      if (!nodeId) throw new Error(`node '${code}' not found`)
      if (!FLOW_TYPES.has(ftype)) throw new Error('flow_type must be inflow, outflow, or stock')
      const sw = num(r.sw_pct)
      if (sw !== null && Number.isNaN(sw)) throw new Error('sw_pct must be a number')
      const data = {
        volume: vol,
        swPct: sw,
        category: (r.category || '').trim() || null,
        memo: (r.memo || '').trim() || null,
      }
      const existing = await prisma.flow.findFirst({
        where: { organizationId, nodeId, date, flowType: ftype },
        select: { id: true },
      })
      if (existing) await prisma.flow.update({ where: { id: existing.id }, data })
      else await prisma.flow.create({ data: { organizationId, nodeId, date, flowType: ftype, status: 'actual', ...data } })
      flowsImported++
    } catch (e) {
      errors.push(`flows row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Transfers ──
  for (let i = 0; i < parsed.transfers.length; i++) {
    const r = parsed.transfers[i]
    try {
      const from = (r.from_node || '').trim().toUpperCase()
      const to = (r.to_node || '').trim().toUpperCase()
      const date = normDate(r.date)
      const vol = num(r.volume)
      if (!from || !to || !date || vol == null) throw new Error('from_node, to_node, date, volume are required')
      if (Number.isNaN(vol)) throw new Error('volume must be a number')
      const fromId = nodeMap.get(from)
      const toId = nodeMap.get(to)
      if (!fromId) throw new Error(`node '${from}' not found`)
      if (!toId) throw new Error(`node '${to}' not found`)
      const receipt = num(r.receipt_volume)
      if (receipt !== null && Number.isNaN(receipt)) throw new Error('receipt_volume must be a number')
      await prisma.transfer.create({
        data: { organizationId, fromNodeId: fromId, toNodeId: toId, date, volume: vol, receiptVolume: receipt, memo: (r.memo || '').trim() || null },
      })
      transfersImported++
    } catch (e) {
      errors.push(`transfers row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Liftings ──
  for (let i = 0; i < parsed.liftings.length; i++) {
    const r = parsed.liftings[i]
    try {
      const tanker = (r.tanker_name || '').trim()
      if (!tanker) throw new Error('tanker_name is required')
      const data: Record<string, unknown> = { organizationId, tankerName: tanker }
      const from = (r.from_node || '').trim().toUpperCase()
      if (from) {
        const id = nodeMap.get(from)
        if (!id) throw new Error(`node '${from}' not found`)
        data.fromNodeId = id
      }
      const buyer = (r.buyer_node || '').trim().toUpperCase()
      if (buyer) {
        const id = nodeMap.get(buyer)
        if (!id) throw new Error(`node '${buyer}' not found`)
        data.buyerNodeId = id
      }
      if (r.date_start) data.startLoad = normDate(r.date_start)
      if (r.date_stop) data.stopLoad = normDate(r.date_stop)
      for (const [src, dst] of [['nominated', 'nominated'], ['bl_volume', 'blVolume'], ['cqd_volume', 'cqdVolume']] as const) {
        const n = num(r[src])
        if (n !== null) { if (Number.isNaN(n)) throw new Error(`${src} must be a number`); data[dst] = n }
      }
      const status = (r.status || '').trim().toLowerCase() || 'completed'
      if (!LIFTING_STATUS.has(status)) throw new Error(`status must be one of: ${[...LIFTING_STATUS].join(', ')}`)
      data.status = status
      const notes = (r.notes || '').trim()
      if (notes) data.notes = notes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.lifting.create({ data: data as any })
      liftingsImported++
    } catch (e) {
      errors.push(`liftings row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { flowsImported, transfersImported, liftingsImported, errors }
}
