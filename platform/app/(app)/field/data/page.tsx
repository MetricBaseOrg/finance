'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Panel, Btn, wsField, WsLabel } from '@/app/home/ui'

type ImportResult = { flowsImported: number; transfersImported: number; liftingsImported: number; errors: string[] }

export default function FieldDataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Choose a .csv or .xlsx file first'); return }
    setUploading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/field/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Import failed'); return }
      setResult(data)
      const total = data.flowsImported + data.transfersImported + data.liftingsImported
      toast.success(`Imported ${total} row${total === 1 ? '' : 's'}${data.errors.length ? ` · ${data.errors.length} skipped` : ''}`)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      toast.error('Import failed')
    } finally {
      setUploading(false)
    }
  }

  const exportQs = () => {
    const q = new URLSearchParams()
    if (from) q.set('date_from', from)
    if (to) q.set('date_to', to)
    const s = q.toString()
    return s ? `?${s}` : ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Import" sub="Upload flows, transfers and liftings from a filled template. Re-importing flows updates matching node/date/type rows.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--mb-ink-muted)', alignSelf: 'center' }}>Blank templates:</span>
          <Btn kind="soft" href="/api/field/import/template/xlsx">Template .xlsx</Btn>
          <Btn kind="soft" href="/api/field/import/template/csv">Template .csv</Btn>
        </div>
        <form onSubmit={upload} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <WsLabel>File (.csv or .xlsx)</WsLabel>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ ...wsField, padding: 8 }} />
          </label>
          <Btn kind="primary" icon="upload">{uploading ? 'Importing…' : 'Import'}</Btn>
        </form>

        {result && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--mb-divider)', paddingTop: 14 }}>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--mb-ink)' }}>
              <span><strong>{result.flowsImported}</strong> flows</span>
              <span><strong>{result.transfersImported}</strong> transfers</span>
              <span><strong>{result.liftingsImported}</strong> liftings</span>
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mb-bad-ink, #e5484d)', marginBottom: 6 }}>
                  {result.errors.length} row{result.errors.length === 1 ? '' : 's'} skipped
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflowY: 'auto' }}>
                  {result.errors.map((er, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--mb-ink-muted)', fontFamily: 'var(--mb-font-mono)' }}>{er}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Export" sub="Download all field data (flows, transfers, liftings). Optional date range filters flows and transfers.">
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>From</WsLabel><input type="date" style={wsField} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label style={{ display: 'grid', gap: 5 }}><WsLabel>To</WsLabel><input type="date" style={wsField} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <Btn kind="primary" href={`/api/field/export/xlsx${exportQs()}`} icon="download">Export .xlsx</Btn>
          <Btn kind="soft" href={`/api/field/export/csv${exportQs()}`}>Export .csv</Btn>
        </div>
      </Panel>
    </div>
  )
}
