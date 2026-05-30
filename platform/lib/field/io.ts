import 'server-only'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'

/**
 * Field data import/export — column specs and CSV/XLSX (de)serialization.
 * Ported from the old FieldFlow `api/imports.py`. The three datasets (flows,
 * transfers, liftings) round-trip: export → edit → re-import.
 */

export const FLOWS_COLS = ['node_code', 'date', 'flow_type', 'volume', 'sw_pct', 'category', 'memo'] as const
export const TRANSFERS_COLS = ['from_node', 'to_node', 'date', 'volume', 'receipt_volume', 'memo'] as const
export const LIFTINGS_COLS = ['tanker_name', 'from_node', 'buyer_node', 'date_start', 'date_stop', 'nominated', 'bl_volume', 'cqd_volume', 'status', 'notes'] as const

const FLOWS_EXAMPLE = [
  ['TANK1', '2026-01-01', 'inflow', 1000, '', '', ''],
  ['TANK1', '2026-01-01', 'stock', 16500, '', '', ''],
  ['TANK1', '2026-01-01', 'outflow', 500, 0.3, 'lifting', 'MT Mawar'],
]
const TRANSFERS_EXAMPLE = [['TANK1', 'TERM1', '2026-01-01', 5000, 4950, 'destination measured 50 bbl short']]
const LIFTINGS_EXAMPLE = [['MT MAWAR', 'TERM1', 'BYR_A', '2026-01-10', '2026-01-11', 80000, 79850, 79800, 'completed', '']]

export type Dataset = 'flows' | 'transfers' | 'liftings'
export type ParsedRows = Record<Dataset, Record<string, string>[]>

const SHEETS: { key: Dataset; cols: readonly string[]; example: (string | number)[][] }[] = [
  { key: 'flows', cols: FLOWS_COLS, example: FLOWS_EXAMPLE },
  { key: 'transfers', cols: TRANSFERS_COLS, example: TRANSFERS_EXAMPLE },
  { key: 'liftings', cols: LIFTINGS_COLS, example: LIFTINGS_EXAMPLE },
]

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function normDate(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v).trim().slice(0, 10)
}

// ── Template / export builders ───────────────────────────────────────────────

async function buildXlsx(
  data: { key: Dataset; cols: readonly string[]; rows: (string | number | null)[][] }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  for (const sheet of data) {
    const ws = wb.addWorksheet(sheet.key)
    ws.addRow(sheet.cols as string[])
    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } } })
    for (const r of sheet.rows) ws.addRow(r.map((v) => (v == null ? '' : v)))
    ws.columns.forEach((c) => { c.width = 16 })
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function buildCsv(
  data: { key: Dataset; cols: readonly string[]; rows: (string | number | null)[][] }[],
): Buffer {
  const lines: (string | number | null)[][] = []
  for (const sheet of data) {
    lines.push([`# Sheet: ${sheet.key}`])
    lines.push([...sheet.cols])
    for (const r of sheet.rows) lines.push(r)
    lines.push([])
  }
  return Buffer.from(Papa.unparse(lines, { newline: '\n' }))
}

/** Blank template with example rows, in the requested format. */
export async function buildTemplate(fmt: 'csv' | 'xlsx'): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  const data = SHEETS.map((s) => ({ key: s.key, cols: s.cols, rows: s.example }))
  if (fmt === 'xlsx') return { buffer: await buildXlsx(data), mime: XLSX_MIME, filename: 'fieldflow_template.xlsx' }
  return { buffer: buildCsv(data), mime: 'text/csv', filename: 'fieldflow_template.csv' }
}

/** Export real rows (already shaped to the column order). */
export async function buildExport(
  fmt: 'csv' | 'xlsx',
  rows: Record<Dataset, (string | number | null)[][]>,
  slug: string,
): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  const data = SHEETS.map((s) => ({ key: s.key, cols: s.cols, rows: rows[s.key] ?? [] }))
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (fmt === 'xlsx') return { buffer: await buildXlsx(data), mime: XLSX_MIME, filename: `${slug}_${stamp}.xlsx` }
  return { buffer: buildCsv(data), mime: 'text/csv', filename: `${slug}_${stamp}.csv` }
}

// ── Parsers ──────────────────────────────────────────────────────────────────

function emptyParsed(): ParsedRows {
  return { flows: [], transfers: [], liftings: [] }
}

export async function parseUpload(filename: string, buffer: Buffer): Promise<ParsedRows> {
  const name = filename.toLowerCase()
  if (name.endsWith('.xlsx')) return parseXlsx(buffer)
  if (name.endsWith('.csv')) return parseCsv(buffer)
  throw new Error('Unsupported file type. Use .csv or .xlsx')
}

async function parseXlsx(buffer: Buffer): Promise<ParsedRows> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const result = emptyParsed()
  for (const { key } of SHEETS) {
    const ws = wb.getWorksheet(key)
    if (!ws) continue
    const headerRow = ws.getRow(1)
    const headers: string[] = []
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => { headers[col - 1] = String(cell.value ?? '').trim().toLowerCase() })
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const obj: Record<string, string> = {}
      let any = false
      headers.forEach((h, i) => {
        if (!h) return
        const v = row.getCell(i + 1).value
        const s = v == null ? '' : (typeof v === 'object' && 'text' in v ? String((v as { text: unknown }).text) : String(v)).trim()
        if (s) any = true
        obj[h] = s
      })
      if (any) result[key].push(obj)
    }
  }
  return result
}

function parseCsv(buffer: Buffer): ParsedRows {
  const text = buffer.toString('utf-8').replace(/^﻿/, '')
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
  const result = emptyParsed()
  let key: Dataset | null = null
  let headers: string[] = []
  for (const row of data) {
    if (!row || (row.length === 1 && !String(row[0]).trim())) continue
    const first = String(row[0] ?? '')
    if (first.startsWith('#')) {
      const label = first.toLowerCase()
      key = label.includes('lifting') ? 'liftings' : label.includes('transfer') ? 'transfers' : 'flows'
      headers = []
      continue
    }
    if (!headers.length) { headers = row.map((c) => String(c).trim().toLowerCase()); continue }
    if (key) {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = String(row[i] ?? '').trim() })
      result[key].push(obj)
    }
  }
  return result
}

export { normDate }
