'use client'

import React from 'react'

// Workspace-home primitives, ported from the design bundle's primitives.jsx.

export type AppId = 'metricbase' | 'probase' | 'fieldflow' | 'ogtools'
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'

const ICONS: Record<string, string> = {
  arrowr: 'M5 12h14M13 6l6 6-6 6',
  arrowup: 'M12 19V5M6 11l6-6 6 6',
  arrowdn: 'M12 5v14M6 13l6 6 6-6',
  dot: 'M12 13a1 1 0 100-2 1 1 0 000 2z',
  star: 'M12 3l2.7 5.8 6.3.8-4.7 4.3 1.3 6.3L12 17.8 6.1 20.5l1.3-6.3L2.7 9.6l6.3-.8z',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M21 12a9 9 0 10-2.6 6.4M21 21v-5h-5',
  ext: 'M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5',
  bell: 'M18 16v-5a6 6 0 00-12 0v5l-2 2h16zM10 21a2 2 0 004 0',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.3-4.3',
  calc: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 19h2',
  drop: 'M12 3s6 7 6 12a6 6 0 11-12 0c0-5 6-12 6-12z',
  chart: 'M3 21V3M3 21h18M7 17V11M12 17V7M17 17v-4',
  tank: 'M5 5h14v14H5zM5 12h14M9 5v14M15 5v14',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 12c0-.5-.1-1-.2-1.5l1.7-1.3-1.7-3-2 .8a6.6 6.6 0 00-2.6-1.5L14.3 3H9.7l-.3 2a6.6 6.6 0 00-2.6 1.5l-2-.8-1.7 3L4.8 10c-.1.5-.2 1-.2 1.5s.1 1 .2 1.5l-1.7 1.3 1.7 3 2-.8a6.6 6.6 0 002.6 1.5l.3 2h4.6l.3-2a6.6 6.6 0 002.6-1.5l2 .8 1.7-3-1.7-1.3c.1-.5.2-1 .2-1.5z',
}

export const Icon = ({ name, size = 16, color = 'currentColor', sw = 1.7, style }: {
  name: string; size?: number; color?: string; sw?: number; style?: React.CSSProperties
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <path d={ICONS[name] || ICONS.dot} fill={name === 'starf' ? color : 'none'} />
  </svg>
)

export const AppMark = ({ app, size = 22, c }: { app: AppId; size?: number; c?: string }) => {
  const color = c || `var(--c-${app})`
  const s = size
  if (app === 'metricbase')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <rect x="3" y="14" width="3.6" height="7" rx="0.6" fill={color} opacity="0.45" />
        <rect x="8.4" y="10" width="3.6" height="11" rx="0.6" fill={color} opacity="0.7" />
        <rect x="13.8" y="6" width="3.6" height="15" rx="0.6" fill={color} />
        <path d="M3 12.5L9 8.5 14 11 21 4.5" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="4.5" r="1.6" fill={color} />
      </svg>
    )
  if (app === 'probase')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path d="M12 2l10 6-10 6L2 8l10-6z" fill={color} opacity="0.9" />
        <path d="M2 14l10 6 10-6" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      </svg>
    )
  if (app === 'fieldflow')
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path d="M12 3s6.5 7 6.5 12.2A6.5 6.5 0 1 1 5.5 15.2C5.5 10 12 3 12 3Z" fill={color} opacity="0.9" />
        <path d="M7.6 15.6q2.2-2 4.4 0t4.4 0" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.92" />
      </svg>
    )
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill={color} opacity="0.16" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.5 14.5a4.5 4.5 0 1 1 9 0" stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <line x1="12" y1="14.5" x2="15" y2="10.6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="1.3" fill={color} />
    </svg>
  )
}

export const AppTile = ({ app, size = 40, radius = 11, soft = true }: {
  app: AppId; size?: number; radius?: number; soft?: boolean
}) => (
  <div style={{
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    display: 'grid', placeItems: 'center',
    background: soft ? `color-mix(in oklch, var(--c-${app}) 14%, var(--mb-surface))` : `var(--c-${app})`,
    border: `1px solid color-mix(in oklch, var(--c-${app}) 30%, transparent)`,
  }}>
    <AppMark app={app} size={size * 0.52} c={soft ? `var(--c-${app})` : '#fff'} />
  </div>
)

const TONES: Record<Tone, [string, string, string]> = {
  ok: ['var(--mb-ok-soft)', 'var(--mb-ok-ink)', 'var(--mb-ok)'],
  warn: ['var(--mb-warn-soft)', 'var(--mb-warn-ink)', 'var(--mb-warn)'],
  bad: ['var(--mb-bad-soft)', 'var(--mb-bad-ink)', 'var(--mb-bad)'],
  info: ['var(--mb-info-soft)', 'oklch(0.40 0.10 250)', 'var(--mb-info)'],
  neutral: ['var(--mb-surface-3)', 'var(--mb-ink-2)', 'var(--mb-ink-soft)'],
}

export const Pill = ({ tone = 'neutral', children, dot = true, style }: {
  tone?: Tone; children: React.ReactNode; dot?: boolean; style?: React.CSSProperties
}) => {
  const [bg, fg, dc] = TONES[tone] || TONES.neutral
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, background: bg, color: fg, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', ...style }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: dc }} />}
      {children}
    </span>
  )
}

export const Dot = ({ tone = 'neutral', size = 7 }: { tone?: Tone; size?: number }) => {
  const [, , dc] = TONES[tone] || TONES.neutral
  return <span style={{ width: size, height: size, borderRadius: '50%', background: dc, flexShrink: 0, display: 'inline-block' }} />
}

export const Spark = ({ data, w = 64, h = 22, color = 'var(--mb-brand)' }: {
  data: number[]; w?: number; h?: number; color?: string
}) => {
  if (!data.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const pad = (max - min) * 0.12 || 1
  const lo = min - pad, hi = max + pad
  const xs = data.map((_, i) => (i / (data.length - 1)) * w)
  const ys = data.map((v) => h - ((v - lo) / (hi - lo)) * h)
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity="0.12" />
      <path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2" fill={color} />
    </svg>
  )
}

export const SectionHead = ({ eyebrow, title, sub, right }: {
  eyebrow?: string; title: string; sub?: string; right?: React.ReactNode
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
    <div style={{ minWidth: 0 }}>
      {eyebrow && <div className="ws-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--mb-ink)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--mb-ink-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
    {right}
  </div>
)

export const Btn = ({ kind = 'ghost', icon, children, onClick, href, style }: {
  kind?: 'primary' | 'ghost' | 'soft' | 'quiet'; icon?: string; children?: React.ReactNode
  onClick?: () => void; href?: string; style?: React.CSSProperties
}) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 12.5,
    fontWeight: 600, borderRadius: 8, cursor: 'pointer', padding: children ? '8px 13px' : '8px',
    lineHeight: 1, whiteSpace: 'nowrap', textDecoration: 'none',
  }
  const kinds: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--mb-brand)', border: '1px solid var(--mb-brand)', color: '#fff' },
    ghost: { background: 'var(--mb-surface)', border: '1px solid var(--mb-border)', color: 'var(--mb-ink-2)' },
    soft: { background: 'var(--mb-brand-soft)', border: '1px solid transparent', color: 'var(--mb-brand-ink)' },
    quiet: { background: 'transparent', border: '1px solid transparent', color: 'var(--mb-ink-2)' },
  }
  const content = <>{icon && <Icon name={icon} size={14} />}{children}</>
  const sx = { ...base, ...kinds[kind], ...style }
  if (href) return <a className="ws-btn" href={href} style={sx}>{content}</a>
  return <button className="ws-btn" onClick={onClick} style={sx}>{content}</button>
}

// ─── In-app chrome (secondary header, panels, KPI tiles, form atoms) ──────────

export const AppHeader = ({ app, title, breadcrumb, tabs, active, right, hideTitle }: {
  app: AppId; title: string; breadcrumb?: string
  tabs?: { id: string; label: string; href: string }[]; active?: string; right?: React.ReactNode
  hideTitle?: boolean
}) => {
  // Nothing to show: title suppressed and no tabs → render no header bar.
  if (hideTitle && (!tabs || tabs.length === 0)) return null
  return (
  <div style={{ borderBottom: '1px solid var(--mb-border)', background: 'var(--mb-surface)' }}>
    <div style={{ maxWidth: 'var(--ws-maxw)', margin: '0 auto', padding: '0 var(--ws-gutter)' }}>
      {!hideTitle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 0 12px' }}>
          <AppTile app={app} size={34} radius={9} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {breadcrumb && <div style={{ fontSize: 10.5, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{breadcrumb}</div>}
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--mb-ink)' }}>{title}</div>
          </div>
          {right}
        </div>
      )}
      {tabs && (
        <div className="ws-tabs" style={{ display: 'flex', gap: 2, marginBottom: -1, paddingTop: hideTitle ? 10 : 0, overflowX: 'auto' }}>
          {tabs.map((t) => (
            <a key={t.id} href={t.href}
              style={{ textDecoration: 'none', padding: '9px 13px', fontSize: 12.5, fontWeight: active === t.id ? 700 : 500, color: active === t.id ? 'var(--mb-brand-ink)' : 'var(--mb-ink-muted)', borderBottom: active === t.id ? '2px solid var(--mb-brand)' : '2px solid transparent', whiteSpace: 'nowrap' }}>
              {t.label}
            </a>
          ))}
        </div>
      )}
    </div>
  </div>
  )
}

export const Panel = ({ title, sub, right, children, pad = 16, style }: {
  title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; pad?: number; style?: React.CSSProperties
}) => (
  <div className="ws-card" style={{ display: 'flex', flexDirection: 'column', ...style }}>
    {(title || right) && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--mb-divider)' }}>
        <div style={{ minWidth: 0 }}>
          {title && <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mb-ink)', letterSpacing: '-0.01em' }}>{title}</div>}
          {sub && <div style={{ fontSize: 11, color: 'var(--mb-ink-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
    )}
    <div style={{ padding: pad, flex: 1, minWidth: 0 }}>{children}</div>
  </div>
)

export const KTile = ({ label, value, unit, delta, tone = 'neutral', spark, accent }: {
  label: string; value: React.ReactNode; unit?: string; delta?: string; tone?: Tone; spark?: number[]; accent?: string
}) => (
  <div className="ws-card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
    <div style={{ fontSize: 10.5, color: 'var(--mb-ink-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
      <span className="mb-num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)' }}>{unit}</span>}
    </div>
    {(delta || spark) && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
        {delta ? <Pill tone={tone} dot={false}>{delta}</Pill> : <span />}
        {spark && <Spark data={spark} color={accent || 'var(--mb-brand)'} />}
      </div>
    )}
  </div>
)

// Form atoms styled on the new tokens.
export const wsField: React.CSSProperties = {
  width: '100%', background: 'var(--mb-surface)', border: '1px solid var(--mb-border)',
  borderRadius: 'var(--mb-radius-sm)', color: 'var(--mb-ink)', fontFamily: 'inherit',
  fontSize: 12.5, padding: '8px 10px', outline: 'none',
}
export const WsLabel = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mb-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</span>
)
