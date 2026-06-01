'use client'

import { useState } from 'react'
import './workspace.css'
import {
  AppId, Tone, Icon, AppMark, AppTile, Pill, Dot, Spark, SectionHead, Btn,
} from './ui'

export type HomeData = {
  userName: string
  orgName: string
  apps: { id: AppId; name: string; sub: string; tagline: string; href: string; status: Tone; statusLabel: string; metrics: [string, string, Tone][] }[]
  kpis: { app: AppId; label: string; value: string; unit: string; delta: string; tone: Tone; spark: number[] }[]
  activity: { app: AppId; who: string; action: string; target: string; time: string; tone: Tone; href: string }[]
  tasks: { app: AppId; title: string; due: string; tone: Tone; href: string }[]
  pinned: { app: AppId; label: string; kind: string; href: string }[]
  attention: number
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomeView({ data }: { data: HomeData }) {
  const [favs, setFavs] = useState<Record<string, boolean>>({ metricbase: true, fieldflow: true })
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
        <div className="ws-page ws-fade">
          {/* greeting */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <div className="ws-eyebrow" style={{ marginBottom: 7 }}>Workspace · {data.orgName}</div>
              <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--mb-ink)', margin: 0 }}>
                {greeting()}, {data.userName.split(' ')[0]}.
              </h1>
              <div style={{ fontSize: 12.5, color: 'var(--mb-ink-muted)', marginTop: 4 }}>
                {today}{data.attention > 0 ? ` · ${data.attention} item${data.attention === 1 ? '' : 's'} need your attention` : ' · all clear'}
              </div>
            </div>
          </div>

          {/* aggregated KPIs */}
          <div style={{ marginBottom: 24 }}>
            <SectionHead eyebrow="Across all apps" title="Today at a glance" sub="Live metrics aggregated from every connected app" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ws-gap)' }}>
              {data.kpis.map((k, i) => (
                <div key={i} className="ws-card" style={{ padding: 'var(--ws-card-pad)', display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `var(--c-${k.app})` }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AppMark app={k.app} size={13} />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--mb-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span className="mb-num" style={{ fontSize: 23, fontWeight: 700, lineHeight: 1 }}>{k.value}</span>
                    <span style={{ fontSize: 11, color: 'var(--mb-ink-muted)', fontWeight: 500 }}>{k.unit}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
                    <Pill tone={k.tone} dot={false}>
                      <Icon name={k.tone === 'bad' ? 'arrowdn' : k.tone === 'warn' ? 'dot' : 'arrowup'} size={9} />{k.delta}
                    </Pill>
                    <Spark data={k.spark} color={`var(--c-${k.app})`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* two-column */}
          <div className="ws-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* left: apps + activity */}
            <div>
              <SectionHead eyebrow="Launch" title="Your apps" sub="Open any app — your session and access carry across" />
              <div className="ws-apps-grid">
                {data.apps.map((a) => (
                  <a key={a.id} href={a.href} className="ws-card ws-click ws-lift"
                    style={{ padding: 'var(--ws-card-pad)', display: 'flex', flexDirection: 'column', gap: 13, borderTop: `2px solid var(--c-${a.id})`, minWidth: 0, textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <AppTile app={a.id} size={44} radius={12} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--mb-ink)' }}>{a.name}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mb-ink-soft)', padding: '2px 6px', border: '1px solid var(--mb-border)', borderRadius: 5 }}>{a.sub}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mb-ink-muted)', marginTop: 4, lineHeight: 1.4 }}>{a.tagline}</div>
                      </div>
                      <button className="ws-btn" onClick={(e) => { e.preventDefault(); setFavs((f) => ({ ...f, [a.id]: !f[a.id] })) }} title="Pin"
                        style={{ border: 'none', background: 'transparent', padding: 4, color: favs[a.id] ? 'var(--mb-warn)' : 'var(--mb-ink-soft)' }}>
                        <Icon name="star" size={16} color={favs[a.id] ? 'var(--mb-warn)' : 'var(--mb-ink-soft)'} style={favs[a.id] ? { fill: 'var(--mb-warn)' } : undefined} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--mb-divider)', border: '1px solid var(--mb-divider)', borderRadius: 8, overflow: 'hidden' }}>
                      {a.metrics.map(([label, val, tone], i) => (
                        <div key={i} style={{ background: 'var(--mb-surface)', padding: '9px 11px' }}>
                          <div style={{ fontSize: 9.5, color: 'var(--mb-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                          <div className="mb-num" style={{ fontSize: 13.5, fontWeight: 700, marginTop: 3, color: tone === 'ok' ? 'var(--mb-ok-ink)' : tone === 'warn' ? 'var(--mb-warn-ink)' : 'var(--mb-ink)' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Pill tone={a.status}>{a.statusLabel}</Pill>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: `var(--c-${a.id})` }}>Open <Icon name="arrowr" size={13} color={`var(--c-${a.id})`} /></span>
                    </div>
                  </a>
                ))}
              </div>

              <div style={{ marginTop: 26 }}>
                <SectionHead eyebrow="Stream" title="Recent activity" sub="What changed across the workspace" />
                <div className="ws-card" style={{ padding: '6px 0' }}>
                  {data.activity.length === 0 && (
                    <div style={{ padding: '16px', fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>No recent activity yet.</div>
                  )}
                  {data.activity.map((e, i) => (
                    <a key={i} href={e.href} className="ws-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px', textDecoration: 'none', borderBottom: i < data.activity.length - 1 ? '1px solid var(--mb-divider)' : 'none' }}>
                      <div style={{ marginTop: 1 }}><AppTile app={e.app} size={28} radius={8} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--mb-ink-2)', lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 700, color: 'var(--mb-ink)' }}>{e.who}</span> {e.action} <span style={{ fontWeight: 600, color: 'var(--mb-ink)' }}>{e.target}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{e.app}</span>
                          <Dot tone={e.tone} size={5} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', whiteSpace: 'nowrap' }}>{e.time}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* right rail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <SectionHead eyebrow="Assigned to me" title="Tasks & alerts"
                  right={data.tasks.length > 0 ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mb-bad-ink)', background: 'var(--mb-bad-soft)', borderRadius: 999, padding: '2px 9px' }}>{data.tasks.length}</span> : undefined} />
                <div className="ws-card" style={{ padding: '5px 0' }}>
                  {data.tasks.length === 0 && <div style={{ padding: '14px 15px', fontSize: 12.5, color: 'var(--mb-ink-muted)' }}>Nothing assigned to you.</div>}
                  {data.tasks.map((t, i) => (
                    <a key={i} href={t.href} className="ws-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 15px', textDecoration: 'none', borderBottom: i < data.tasks.length - 1 ? '1px solid var(--mb-divider)' : 'none' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 5, border: '1.6px solid var(--mb-border-strong)', marginTop: 1, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--mb-ink)', lineHeight: 1.4 }}>{t.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AppMark app={t.app} size={11} /><span style={{ fontSize: 10, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase' }}>{t.app}</span></span>
                          <Pill tone={t.tone} dot={false} style={{ fontSize: 9.5, padding: '1px 7px' }}>{t.due}</Pill>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <SectionHead eyebrow="Pinned" title="Quick access" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.pinned.map((p, i) => (
                    <a key={i} href={p.href} className="ws-card ws-click ws-lift" style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
                      <AppTile app={p.app} size={32} radius={9} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mb-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--mb-ink-soft)', fontFamily: 'var(--mb-font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{p.app} · {p.kind}</div>
                      </div>
                      <Icon name="arrowr" size={14} color="var(--mb-ink-soft)" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
  )
}
