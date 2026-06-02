'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wallet, ArrowRight } from 'lucide-react'

type Finance = {
  income: number; expense: number; net: number; txnCount: number
  budget: number | null; remaining: number | null; base: string; slug: string
}

function money(v: number, base: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: base, maximumFractionDigits: 0 }).format(v)
  } catch {
    return `${base} ${Math.round(v).toLocaleString()}`
  }
}

/** Compact budget/spend summary on the project detail page; links into /finance. */
export function ProjectFinanceCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Finance | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/finance`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) { setData(d); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [projectId])

  if (!loaded || !data) return null

  const { base } = data
  const over = data.remaining != null && data.remaining < 0
  const pct = data.budget && data.budget > 0 ? Math.min(100, Math.round((data.expense / data.budget) * 100)) : null

  return (
    <div className="rounded-xl border border-line bg-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-2 uppercase tracking-wider">
          <Wallet className="h-3.5 w-3.5 text-indigo-500" /> Finance
        </span>
        <Link href={`/finance/${data.slug}/projects/${projectId}`} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Income" value={money(data.income, base)} className="text-emerald-600 dark:text-emerald-400" />
        <Metric label="Spend" value={money(data.expense, base)} className="text-rose-600 dark:text-rose-400" />
        <Metric label="Net" value={money(data.net, base)} className="text-gray-1" />
      </div>
      {data.budget != null && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-gray-3 mb-1">
            <span>Budget {money(data.budget, base)}</span>
            <span className={over ? 'text-rose-500' : ''}>
              {over ? `over by ${money(Math.abs(data.remaining ?? 0), base)}` : `${money(data.remaining ?? 0, base)} left`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: over ? '#f43f5e' : '#6366f1' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-2">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${className ?? ''}`}>{value}</div>
    </div>
  )
}
