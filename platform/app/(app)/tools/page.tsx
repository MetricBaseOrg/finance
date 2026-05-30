'use client'

import { useState } from 'react'
import { Panel, SectionHead, Icon, Btn } from '@/app/home/ui'

const TOOLS: [string, string, string, string, boolean][] = [
  ['mud', 'Mud weight ↔ SG', 'calc', 'Convert mud density across ppg, SG, lb/ft³ and gradient.', true],
  ['hydro', 'Hydrostatic pressure', 'drop', 'Bottom-hole pressure from mud weight and TVD.', true],
  ['api', 'API gravity', 'chart', 'API ↔ specific gravity at 60°F, with classification.', true],
  ['conv', 'Volume converter', 'tank', 'Barrels, m³, gallons and litres — instant.', true],
  ['gas', 'Gas FVF (Bg)', 'bolt', 'Gas formation volume factor from P, T and z.', false],
  ['prod', 'Production decline', 'arrowdn', 'Arps decline — qi, Di and rate forecast.', false],
  ['kill', 'Kill sheet', 'shield', 'Kill mud weight and circulating pressures.', false],
  ['torque', 'Torque & drag', 'settings', 'String tension and torque modelling.', false],
]

const num = (v: number, d = 2) =>
  isFinite(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—'

function NumInput({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mb-ink-2)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--mb-border)', borderRadius: 9, background: 'var(--mb-surface-2)', overflow: 'hidden' }}>
        <input type="number" value={value} step="any" onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="mb-num"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: '10px 12px', fontFamily: 'var(--mb-font-mono)', fontSize: 14, color: 'var(--mb-ink)' }} />
        <span style={{ padding: '0 12px', fontSize: 11, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', borderLeft: '1px solid var(--mb-border)', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>{unit}</span>
      </div>
    </label>
  )
}

function ResultBig({ rows }: { rows: [string, string, string][] }) {
  return (
    <div style={{ background: 'var(--mb-brand-soft)', border: '1px solid color-mix(in oklch, var(--mb-brand) 25%, transparent)', borderRadius: 11, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(([label, val, unit], i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, borderTop: i ? '1px solid color-mix(in oklch, var(--mb-brand) 18%, transparent)' : 'none', paddingTop: i ? 12 : 0 }}>
          <span style={{ fontSize: 12, color: 'var(--mb-brand-ink)', fontWeight: 600 }}>{label}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span className="mb-num" style={{ fontSize: i === 0 ? 28 : 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--mb-brand-ink)' }}>{val}</span>
            <span style={{ fontSize: 11, color: 'var(--mb-brand-ink)', opacity: 0.7 }}>{unit}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', marginTop: 12 }}>{children}</div>
}

function CalcHydro() {
  const [mw, setMw] = useState(9.6)
  const [tvd, setTvd] = useState(8200)
  const psi = 0.052 * mw * tvd
  return (
    <Panel pad={18}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <NumInput label="Mud weight" unit="ppg" value={mw} onChange={setMw} />
        <NumInput label="True vertical depth" unit="ft" value={tvd} onChange={setTvd} />
      </div>
      <ResultBig rows={[['Hydrostatic pressure', num(psi, 0), 'psi'], ['Pressure gradient', num(0.052 * mw, 3), 'psi/ft'], ['Equivalent MW', num(mw, 2), 'ppg']]} />
      <Formula>P = 0.052 × MW × TVD</Formula>
    </Panel>
  )
}
function CalcMud() {
  const [ppg, setPpg] = useState(10.0)
  return (
    <Panel pad={18}>
      <div style={{ marginBottom: 16 }}><NumInput label="Mud weight" unit="ppg" value={ppg} onChange={setPpg} /></div>
      <ResultBig rows={[['Specific gravity', num(ppg / 8.345, 3), 'SG'], ['Density', num(ppg * 7.48, 1), 'lb/ft³'], ['Pressure gradient', num(ppg * 0.052, 3), 'psi/ft']]} />
      <Formula>SG = ppg / 8.345 · grad = ppg × 0.052</Formula>
    </Panel>
  )
}
function CalcApi() {
  const [api, setApi] = useState(35)
  const sg = 141.5 / (131.5 + api)
  const cls = api < 22.3 ? 'Heavy' : api < 31.1 ? 'Medium' : api < 45 ? 'Light' : 'Condensate'
  return (
    <Panel pad={18}>
      <div style={{ marginBottom: 16 }}><NumInput label="API gravity" unit="°API" value={api} onChange={setApi} /></div>
      <ResultBig rows={[['Specific gravity (60°F)', num(sg, 4), 'SG'], ['Density', num(sg * 8.345, 2), 'ppg'], ['Classification', cls, '']]} />
      <Formula>SG = 141.5 / (131.5 + °API)</Formula>
    </Panel>
  )
}
function CalcConv() {
  const [bbl, setBbl] = useState(1000)
  return (
    <Panel pad={18}>
      <div style={{ marginBottom: 16 }}><NumInput label="Volume" unit="bbl" value={bbl} onChange={setBbl} /></div>
      <ResultBig rows={[['Cubic metres', num(bbl * 0.158987, 2), 'm³'], ['US gallons', num(bbl * 42, 0), 'gal'], ['Litres', num(bbl * 158.987, 0), 'L']]} />
      <Formula>1 bbl = 0.158987 m³ = 42 gal</Formula>
    </Panel>
  )
}

export default function ToolsPage() {
  const [tool, setTool] = useState('hydro')
  const active = TOOLS.find((t) => t[0] === tool)!

  return (
    <div className="ws-page">
      <div className="tools-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 'var(--ws-gap)', alignItems: 'start' }}>
        {/* tool grid */}
        <div>
          <SectionHead eyebrow="8 tools" title="Calculators"
            right={<Btn kind="quiet" icon="ext" href="/og-tools/index.html" style={{ color: 'var(--mb-ink-muted)' }}>Full app</Btn>} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {TOOLS.map(([id, name, icon, desc, live]) => {
              const sel = tool === id
              return (
                <button key={id} className="ws-btn" disabled={!live} onClick={() => live && setTool(id)}
                  style={{ textAlign: 'left', border: sel ? '1.5px solid var(--mb-brand)' : '1px solid var(--mb-border)', background: sel ? 'var(--mb-brand-soft)' : 'var(--mb-surface)', borderRadius: 11, padding: 13, display: 'flex', flexDirection: 'column', gap: 8, opacity: live ? 1 : 0.5, cursor: live ? 'pointer' : 'not-allowed', boxShadow: 'var(--mb-shadow-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: sel ? 'var(--mb-brand)' : 'var(--mb-surface-3)', display: 'grid', placeItems: 'center' }}>
                      <Icon name={icon} size={16} color={sel ? '#fff' : 'var(--mb-ink-muted)'} />
                    </span>
                    {!live && <span style={{ fontSize: 9, fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-soft)' }}>Soon</span>}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mb-ink)' }}>{name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--mb-ink-muted)', lineHeight: 1.4 }}>{desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* active calculator */}
        <div>
          <SectionHead eyebrow="Calculator" title={active[1]} />
          {tool === 'hydro' && <CalcHydro />}
          {tool === 'mud' && <CalcMud />}
          {tool === 'api' && <CalcApi />}
          {tool === 'conv' && <CalcConv />}
        </div>
      </div>
    </div>
  )
}
