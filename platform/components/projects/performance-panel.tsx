'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Activity, Timer, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Member {
  id: string
  name: string
  image: string | null
  completionRate: number
  onTimeRate: number
  throughputTotal: number
  throughputSpark: number[]
  cycleTimeDays: number | null
  completed: number
  open: number
}

interface PerfData {
  canSeeAll: boolean
  from: string
  to: string
  viewerId: string
  members: Member[]
}

type SortKey = 'name' | 'completionRate' | 'onTimeRate' | 'throughputTotal' | 'cycleTimeDays'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function cycleStr(d: number | null): string {
  if (d === null) return '—'
  return `${d.toFixed(1)}d`
}

/** Tiny inline sparkline from a series of counts. */
function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  if (!data.length) return <span className="text-gray-4 text-xs">—</span>
  const W = 64, H = 18
  const max = Math.max(...data, 1)
  const step = data.length > 1 ? W / (data.length - 1) : 0
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} className="inline-block align-middle" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
    </svg>
  )
}

// Preset windows
function isoDay(d: Date) { return d.toISOString().slice(0, 10) }
function presetRange(kind: '30d' | '90d' | 'quarter'): { from: string; to: string } {
  const now = new Date()
  const to = isoDay(now)
  if (kind === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    return { from: isoDay(new Date(now.getFullYear(), q * 3, 1)), to }
  }
  const days = kind === '30d' ? 30 : 90
  return { from: isoDay(new Date(now.getTime() - days * 24 * 3600 * 1000)), to }
}

export function PerformancePanel() {
  const [range, setRange] = useState(() => presetRange('90d'))
  const [data, setData] = useState<PerfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'throughputTotal', dir: 'desc' })

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/performance?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then((d: PerfData) => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range.from, range.to])

  const toggleSort = useCallback((key: SortKey) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' })
  }, [])

  const members = data?.members ?? []
  const sorted = [...members].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
    const av = (a[sort.key] ?? -1) as number
    const bv = (b[sort.key] ?? -1) as number
    return (av - bv) * dir
  })

  const self = members.find((m) => m.id === data?.viewerId) ?? members[0]

  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col gap-2.5 mb-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-gray-1">Performance</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Presets — horizontally scrollable on very narrow screens */}
          <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:overflow-visible">
            {(['30d', '90d', 'quarter'] as const).map((p) => {
              const r = presetRange(p)
              const active = range.from === r.from && range.to === r.to
              return (
                <button
                  key={p}
                  onClick={() => setRange(r)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0',
                    active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-line text-gray-3 hover:bg-bg-hover'
                  )}
                >
                  {p === 'quarter' ? 'Quarter' : `Last ${p}`}
                </button>
              )
            })}
          </div>
          {/* Custom range — full-width pair on mobile, inline on desktop */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="flex-1 min-w-0 text-xs px-2 py-1 rounded-lg border border-line bg-bg-card text-gray-2 sm:flex-none"
            />
            <span className="text-xs text-gray-4 flex-shrink-0">→</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="flex-1 min-w-0 text-xs px-2 py-1 rounded-lg border border-line bg-bg-card text-gray-2 sm:flex-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-bg-card rounded-xl border border-line p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || members.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-line p-6 text-center text-sm text-gray-3">
          No completed work in this range.
        </div>
      ) : data.canSeeAll ? (
        <Leaderboard sorted={sorted} sort={sort} toggleSort={toggleSort} viewerId={data.viewerId} />
      ) : (
        <SelfTiles m={self} />
      )}
    </div>
  )
}

function SelfTiles({ m }: { m: Member }) {
  const tiles = [
    { label: 'Completion rate', value: pct(m.completionRate), sub: `${m.completed} done · ${m.open} open`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'On-time delivery', value: pct(m.onTimeRate), sub: 'of tasks with due dates', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' },
    { label: 'Throughput', value: String(m.throughputTotal), sub: 'completed in range', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/40', spark: m.throughputSpark },
    { label: 'Avg cycle time', value: cycleStr(m.cycleTimeDays), sub: 'start → done', icon: Timer, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-bg-card rounded-xl border border-line p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center', t.bg)}>
              <t.icon className={cn('h-4 w-4 sm:h-5 sm:w-5', t.color)} />
            </div>
            {t.spark ? <Sparkline data={t.spark} /> : <span className="text-xl sm:text-2xl font-bold text-gray-1">{t.value}</span>}
          </div>
          {t.spark && <div className="text-xl sm:text-2xl font-bold text-gray-1 mb-1">{t.value}</div>}
          <p className="text-xs sm:text-sm text-gray-1 font-medium">{t.label}</p>
          <p className="text-[11px] text-gray-3 mt-0.5">{t.sub}</p>
        </div>
      ))}
    </div>
  )
}

function SortHeader({ label, mobileLabel, k, sort, toggleSort, align = 'left' }: { label: string; mobileLabel?: string; k: SortKey; sort: { key: SortKey; dir: 'asc' | 'desc' }; toggleSort: (k: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort.key === k
  return (
    <th className={cn('px-2 sm:px-3 py-2 font-medium text-gray-3 select-none cursor-pointer whitespace-nowrap', align === 'right' ? 'text-right' : 'text-left')} onClick={() => toggleSort(k)}>
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {mobileLabel ? (
          <>
            <span className="sm:hidden">{mobileLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : label}
        {active && (sort.dir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </span>
    </th>
  )
}

function Leaderboard({ sorted, sort, toggleSort, viewerId }: { sorted: Member[]; sort: { key: SortKey; dir: 'asc' | 'desc' }; toggleSort: (k: SortKey) => void; viewerId: string }) {
  return (
    <div className="bg-bg-card rounded-xl border border-line overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-line text-xs">
              <SortHeader label="Member" mobileLabel="Member" k="name" sort={sort} toggleSort={toggleSort} />
              <SortHeader label="Completion" mobileLabel="Compl." k="completionRate" sort={sort} toggleSort={toggleSort} align="right" />
              <SortHeader label="On-time" mobileLabel="On-time" k="onTimeRate" sort={sort} toggleSort={toggleSort} align="right" />
              <SortHeader label="Throughput" mobileLabel="Thru" k="throughputTotal" sort={sort} toggleSort={toggleSort} align="right" />
              <SortHeader label="Cycle time" mobileLabel="Cycle" k="cycleTimeDays" sort={sort} toggleSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id} className={cn('border-b border-line last:border-0', m.id === viewerId && 'bg-indigo-50/50 dark:bg-indigo-950/20')}>
                <td className="px-2 sm:px-3 py-2.5 max-w-[160px]">
                  <Link href={`/u/${m.id}`} className="flex items-center gap-2 hover:text-indigo-600 transition-colors min-w-0">
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-bold grid place-items-center flex-shrink-0">
                        {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    )}
                    <span className="text-gray-1 font-medium truncate">{m.name}</span>
                  </Link>
                </td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-gray-1 tabular-nums whitespace-nowrap">
                  {pct(m.completionRate)}
                  <span className="hidden sm:inline text-[11px] text-gray-3 ml-1">({m.completed}/{m.completed + m.open})</span>
                </td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-gray-1 tabular-nums">{pct(m.onTimeRate)}</td>
                <td className="px-2 sm:px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">
                    <span className="hidden sm:inline-block"><Sparkline data={m.throughputSpark} /></span>
                    <span className="text-gray-1 tabular-nums font-medium w-6 text-right">{m.throughputTotal}</span>
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-gray-1 tabular-nums whitespace-nowrap">{cycleStr(m.cycleTimeDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
