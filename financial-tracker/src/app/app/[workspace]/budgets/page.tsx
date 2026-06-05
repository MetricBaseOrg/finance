import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { Money } from "@/components/mb/Money";
import { buildBudgets, type BudgetRow } from "@/server/analytics";
import { BudgetEditRow } from "./BudgetEditRow";

export default async function BudgetsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);
  const rows = await buildBudgets(workspace.id);

  const expense = rows.filter((r) => r.kind === "EXPENSE");
  const income = rows.filter((r) => r.kind === "INCOME");

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <Eyebrow>Budgets</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Monthly Budgets
          </h1>
          <p className="text-gray-2 text-sm mt-2">
            Set a target per category. Bun tracks your actual MTD spend in your
            base currency (
            <span className="text-gold mono">{workspace.baseCurrency}</span>).
          </p>
        </div>
        <Link
          href={`/app/${slug}/settings/categories`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:text-gold-bright self-start sm:self-auto"
        >
          Manage categories →
        </Link>
      </header>

      {rows.length === 0 ? (
        <BunEmpty
          title="No categories yet"
          description="Workspaces are seeded with starter categories. If you cleared them, recreate some from settings."
          action={
            <Link
              href={`/app/${slug}/settings/categories`}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright"
            >
              → Add categories
            </Link>
          }
        />
      ) : (
        <>
          <BudgetSection
            slug={slug}
            base={workspace.baseCurrency}
            title="Expense"
            rows={expense}
          />
          <BudgetSection
            slug={slug}
            base={workspace.baseCurrency}
            title="Income"
            rows={income}
          />
        </>
      )}
    </div>
  );
}

function BudgetSection({
  slug,
  base,
  title,
  rows,
}: {
  slug: string;
  base: string;
  title: string;
  rows: BudgetRow[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{title}</Eyebrow>
      <div className="mb-card">
        <div className="hidden md:grid grid-cols-[1fr_140px_140px_1.4fr_120px] px-4 py-3 border-b border-line">
          {["Category", "Actual MTD", "Budget", "Progress", ""].map((h) => (
            <span
              key={h}
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
            >
              {h}
            </span>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-3 text-sm">
            No categories
          </div>
        ) : (
          rows.map((r) => {
            const pct =
              r.budget && r.budget > 0
                ? Math.min(100, Math.round((r.actual / r.budget) * 100))
                : null;
            const over = r.budget && r.actual > r.budget;
            return (
              <div
                key={r.id}
                className="border-b border-line last:border-b-0"
              >
                <div className="hidden md:grid grid-cols-[1fr_140px_140px_1.4fr_120px] px-4 py-3 items-center">
                  <span className="font-sans text-sm text-white">{r.name}</span>
                  <span className="mono text-sm text-white">
                    <Money value={r.actual} currency={base} />
                  </span>
                  <span className="mono text-sm text-gray-2">
                    {r.budget !== null ? (
                      <Money value={r.budget} currency={base} />
                    ) : (
                      <span className="text-gray-3">—</span>
                    )}
                  </span>
                  {r.budget !== null && r.budget > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--color-gray-4)]">
                        <div
                          className={over ? "bg-[var(--color-down)]" : "bg-gold"}
                          style={{ width: `${pct}%`, height: "100%" }}
                        />
                      </div>
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          over ? "text-[var(--color-down)]" : "text-gray-2"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-gray-3">
                      No budget set
                    </span>
                  )}
                  <BudgetEditRow slug={slug} id={r.id} currentBudget={r.budget} />
                </div>
                <div className="md:hidden px-4 py-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans text-white font-semibold truncate">
                        {r.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3 mt-1">
                        Actual ·{" "}
                        <span className="text-white">
                          <Money value={r.actual} currency={base} />
                        </span>
                        {r.budget !== null ? (
                          <>
                            {" / "}
                            <Money value={r.budget} currency={base} />
                          </>
                        ) : null}
                      </span>
                    </div>
                    <BudgetEditRow slug={slug} id={r.id} currentBudget={r.budget} />
                  </div>
                  {r.budget !== null && r.budget > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--color-gray-4)]">
                        <div
                          className={over ? "bg-[var(--color-down)]" : "bg-gold"}
                          style={{ width: `${pct}%`, height: "100%" }}
                        />
                      </div>
                      <span
                        className={`font-mono text-[10px] tabular-nums shrink-0 ${
                          over ? "text-[var(--color-down)]" : "text-gray-2"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-gray-3">
                      No budget set
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
