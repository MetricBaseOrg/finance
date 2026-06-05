import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { buildPnl } from "@/server/reports";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { Money } from "@/components/mb/Money";

export default async function PnlPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;
  const { workspace } = await requireMembership(slug);

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(sp.to) : defaultTo;

  const report = await buildPnl(workspace.id, from, to);
  const exportParams = new URLSearchParams({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    kind: "pnl",
  }).toString();

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header className="flex flex-col gap-2">
        <Eyebrow>Reports · P&amp;L</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
          Income statement
        </h1>
        <p className="text-gray-2 text-sm">
          {from.toISOString().slice(0, 10)} → {to.toISOString().slice(0, 10)} ·
          Base <span className="text-gold mono">{workspace.baseCurrency}</span>
        </p>
      </header>

      <form className="mb-card p-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="mb-input mono"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="mb-input mono"
          />
        </label>
        <button
          type="submit"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-black bg-gold hover:bg-gold-bright px-4 py-2.5"
        >
          Apply
        </button>
        <div className="flex-1" />
        <Link
          href={`/api/export/csv?slug=${slug}&${exportParams}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold border border-gold hover:bg-gold hover:text-black px-4 py-2.5 transition-colors"
        >
          Export CSV
        </Link>
        <Link
          href={`/api/export/pdf?slug=${slug}&${exportParams}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold border border-gold hover:bg-gold hover:text-black px-4 py-2.5 transition-colors"
        >
          Export PDF
        </Link>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--color-line)]">
        <div className="mb-card p-6">
          <Eyebrow>Total income</Eyebrow>
          <div className="mt-3 mono text-3xl font-extrabold text-[var(--color-up)]">
            <Money value={report.totalIncome} currency={workspace.baseCurrency} />
          </div>
        </div>
        <div className="mb-card p-6">
          <Eyebrow>Total expense</Eyebrow>
          <div className="mt-3 mono text-3xl font-extrabold text-[var(--color-down)]">
            <Money value={report.totalExpense} currency={workspace.baseCurrency} />
          </div>
        </div>
        <div className="mb-card p-6">
          <Eyebrow>Net income</Eyebrow>
          <div
            className={`mt-3 mono text-3xl font-extrabold ${
              report.netIncome >= 0
                ? "text-[var(--color-up)]"
                : "text-[var(--color-down)]"
            }`}
          >
            <Money value={report.netIncome} currency={workspace.baseCurrency} />
          </div>
        </div>
      </div>

      <PnlTable
        title="Income"
        rows={report.income}
        total={report.totalIncome}
        currency={workspace.baseCurrency}
        tone="up"
      />
      <PnlTable
        title="Expense"
        rows={report.expense}
        total={report.totalExpense}
        currency={workspace.baseCurrency}
        tone="down"
      />
    </div>
  );
}

function PnlTable({
  title,
  rows,
  total,
  currency,
  tone,
}: {
  title: string;
  rows: { name: string; total: number }[];
  total: number;
  currency: string;
  tone: "up" | "down";
}) {
  const toneClass =
    tone === "up" ? "text-[var(--color-up)]" : "text-[var(--color-down)]";
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{title}</Eyebrow>
      <div className="mb-card">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-3 text-sm">
            No {title.toLowerCase()} in this period
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.name}
              className="grid grid-cols-[1fr_140px] sm:grid-cols-[1fr_200px] px-4 py-3 border-b border-line last:border-b-0"
            >
              <span className="font-sans text-white text-sm">{r.name}</span>
              <span className={`mono text-sm text-right ${toneClass}`}>
                <Money value={r.total} currency={currency} />
              </span>
            </div>
          ))
        )}
        <div className="grid grid-cols-[1fr_140px] sm:grid-cols-[1fr_200px] px-4 py-3 border-t border-line-strong">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold">
            Total
          </span>
          <span className={`mono text-base font-bold text-right ${toneClass}`}>
            <Money value={total} currency={currency} />
          </span>
        </div>
      </div>
    </div>
  );
}
