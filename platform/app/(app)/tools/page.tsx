'use client'

import { useState } from 'react'
import { Panel, SectionHead, Icon, Btn } from '@/app/home/ui'

const TOOLS: [string, string, string, string, boolean][] = [
  ['mud',    'Mud weight ↔ SG',      'calc',    'Convert mud density across ppg, SG, lb/ft³ and gradient.', true],
  ['hydro',  'Hydrostatic pressure',  'drop',    'Bottom-hole pressure from mud weight and TVD.',            true],
  ['api',    'API gravity',           'chart',   'API ↔ specific gravity at 60°F, with classification.',    true],
  ['conv',   'Volume converter',      'tank',    'Barrels, m³, gallons and litres — pick your input unit.', true],
  ['gas',    'Gas FVF (Bg)',          'bolt',    'Gas formation volume factor from P, T and z.',             true],
  ['prod',   'Production decline',    'arrowdn', 'Arps exponential decline — qi, Di and rate forecast.',    true],
  ['kill',   'Kill sheet',            'shield',  'Kill mud weight and circulating pressures.',               true],
  ['torque', 'Torque & drag',         'settings','String tension, hook loads and rotary torque.',           true],
]

const num = (v: number, d = 2) =>
  isFinite(v) && !isNaN(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—'

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

// ─── Calculators ────────────────────────────────────────────────────────────

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

// Volume conversion factors to bbl
const VOL_UNITS = ['bbl', 'm³', 'gal', 'L'] as const
type VolUnit = typeof VOL_UNITS[number]
const TO_BBL: Record<VolUnit, number> = { bbl: 1, 'm³': 6.28981, gal: 1 / 42, L: 1 / 158.987 }
const UNIT_LABELS: Record<VolUnit, string> = { bbl: 'Barrels', 'm³': 'Cubic metres', gal: 'US gallons', L: 'Litres' }

function CalcConv() {
  const [fromUnit, setFromUnit] = useState<VolUnit>('bbl')
  const [value, setValue] = useState(1000)

  const inBbl = value * TO_BBL[fromUnit]
  const others = VOL_UNITS.filter((u) => u !== fromUnit)

  return (
    <Panel pad={18}>
      {/* Unit picker */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mb-ink-2)', marginBottom: 8 }}>Input unit</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {VOL_UNITS.map((u) => (
            <button key={u} onClick={() => setFromUnit(u)} className="ws-btn"
              style={{ padding: '6px 14px', borderRadius: 20, border: u === fromUnit ? '1.5px solid var(--mb-brand)' : '1px solid var(--mb-border)', background: u === fromUnit ? 'var(--mb-brand-soft)' : 'var(--mb-surface-2)', color: u === fromUnit ? 'var(--mb-brand-ink)' : 'var(--mb-ink-soft)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--mb-font-mono)', cursor: 'pointer' }}>
              {u}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <NumInput label={UNIT_LABELS[fromUnit]} unit={fromUnit} value={value} onChange={setValue} />
      </div>

      <ResultBig rows={others.map((u, i) => [UNIT_LABELS[u], num(inBbl / TO_BBL[u], u === 'gal' || u === 'L' ? 0 : 2), u] as [string, string, string])} />
      <Formula>via bbl: 1 bbl = 0.158987 m³ = 42 gal = 158.987 L</Formula>
    </Panel>
  )
}

function CalcGas() {
  const [p, setP] = useState(3000)
  const [t, setT] = useState(200)
  const [z, setZ] = useState(0.85)
  const tR = t + 459.67
  const bgMscf = 5.04 * z * tR / p          // res bbl/Mscf
  const bgFt3  = 0.02829 * z * tR / p       // res ft³/scf
  const bgM3   = bgFt3 * 0.028317            // res m³/sm³
  return (
    <Panel pad={18}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <NumInput label="Reservoir pressure" unit="psia" value={p} onChange={setP} />
        <NumInput label="Reservoir temperature" unit="°F" value={t} onChange={setT} />
        <NumInput label="z-factor (gas compressibility)" unit="—" value={z} onChange={setZ} />
      </div>
      <ResultBig rows={[
        ['Bg', num(bgMscf, 4), 'res bbl/Mscf'],
        ['Bg', num(bgFt3, 6), 'res ft³/scf'],
        ['Bg', num(bgM3, 6), 'res m³/sm³'],
      ]} />
      <Formula>Bg = 5.04 × z × T(°R) / P   |   T(°R) = {num(tR, 1)} °R</Formula>
    </Panel>
  )
}

function CalcProd() {
  const [qi, setQi] = useState(500)
  const [di, setDi] = useState(15)
  const [t, setT]   = useState(12)
  const diFrac = di / 100 / 12       // monthly nominal
  const qt  = qi * Math.exp(-diFrac * t)
  const np  = (qi / diFrac) * (1 - Math.exp(-diFrac * t))
  const ratio = qt / qi * 100
  return (
    <Panel pad={18}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <NumInput label="Initial rate (qi)" unit="BOPD" value={qi} onChange={setQi} />
        <NumInput label="Nominal decline (Di)" unit="%/yr" value={di} onChange={setDi} />
        <NumInput label="Forecast time (t)" unit="months" value={t} onChange={setT} />
      </div>
      <ResultBig rows={[
        [`Rate at ${num(t, 0)} months`, num(qt, 0), 'BOPD'],
        ['Cumulative Np', num(np, 0), 'bbl'],
        ['Decline ratio (q/qi)', num(ratio, 1), '%'],
      ]} />
      <Formula>q(t) = qi × e^(−Di_mo × t)   |   Di_mo = {num(diFrac * 100, 4)}%/mo</Formula>
    </Panel>
  )
}

function CalcKill() {
  const [omw, setOmw] = useState(9.6)
  const [sidpp, setSidpp] = useState(400)
  const [tvd, setTvd]   = useState(8000)
  const [spr, setSpr]   = useState(600)
  const kmw = omw + sidpp / (0.052 * tvd)
  const icp = sidpp + spr
  const fcp = (kmw / omw) * spr
  return (
    <Panel pad={18}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <NumInput label="Original mud weight (OMW)" unit="ppg"  value={omw}   onChange={setOmw}   />
        <NumInput label="SIDPP (shut-in drill pipe pressure)"   unit="psi"  value={sidpp} onChange={setSidpp} />
        <NumInput label="True vertical depth (TVD)"             unit="ft"   value={tvd}   onChange={setTvd}   />
        <NumInput label="Slow pump rate pressure (SPR)"         unit="psi"  value={spr}   onChange={setSpr}   />
      </div>
      <ResultBig rows={[
        ['Kill mud weight', num(kmw, 2), 'ppg'],
        ['Initial circ. pressure (ICP)', num(icp, 0), 'psi'],
        ['Final circ. pressure (FCP)', num(fcp, 0), 'psi'],
      ]} />
      <Formula>KMW = OMW + SIDPP / (0.052 × TVD)   |   ICP = SIDPP + SPR</Formula>
    </Panel>
  )
}

function CalcTorque() {
  const [ws,  setWs]  = useState(120)
  const [mw,  setMw]  = useState(10)
  const [inc, setInc] = useState(30)
  const [mu,  setMu]  = useState(0.25)
  const [od,  setOd]  = useState(5)
  const θ   = (inc * Math.PI) / 180
  const bf  = 1 - mw / 65.5
  const wBuoy = ws * bf                         // klbs
  const wn    = wBuoy * Math.sin(θ)             // klbs
  const drag  = mu * wn                         // klbs
  const hlRih = wBuoy * Math.cos(θ) - drag      // klbs
  const hlPooh = wBuoy * Math.cos(θ) + drag     // klbs
  const torque = mu * wn * (od / 2 / 12) * 1000 // ft·lbf
  return (
    <Panel pad={18}>
      <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
        <NumInput label="String weight in air" unit="klbs" value={ws}  onChange={setWs}  />
        <NumInput label="Mud weight"           unit="ppg"  value={mw}  onChange={setMw}  />
        <NumInput label="Inclination"          unit="°"    value={inc} onChange={setInc} />
        <NumInput label="Friction factor (µ)"  unit="—"    value={mu}  onChange={setMu}  />
        <NumInput label="Pipe OD"              unit="in"   value={od}  onChange={setOd}  />
      </div>
      <ResultBig rows={[
        ['Buoyancy factor', num(bf, 4), ''],
        ['Hook load (RIH)',  num(hlRih, 1),  'klbs'],
        ['Hook load (POOH)', num(hlPooh, 1), 'klbs'],
        ['Rotary torque',   num(torque, 0),  'ft·lbf'],
      ]} />
      <Formula>BF = 1 − MW/65.5 = {num(bf, 4)}   |   T = µ × Wn × r</Formula>
    </Panel>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

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
          {tool === 'hydro'  && <CalcHydro />}
          {tool === 'mud'    && <CalcMud />}
          {tool === 'api'    && <CalcApi />}
          {tool === 'conv'   && <CalcConv />}
          {tool === 'gas'    && <CalcGas />}
          {tool === 'prod'   && <CalcProd />}
          {tool === 'kill'   && <CalcKill />}
          {tool === 'torque' && <CalcTorque />}
        </div>
      </div>
    </div>
  )
}
