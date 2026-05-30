import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { Money } from "@/components/mb/Money";
import { projectFinanceMap } from "@/lib/finance/project";

export default async function FinanceProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);

  const [projects, finance] = await Promise.all([
    db.project.findMany({
      where: { organizationId: workspace.id, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, color: true, budget: true, _count: { select: { finAccounts: true } } },
      orderBy: { name: "asc" },
    }),
    projectFinanceMap(workspace.id),
  ]);

  const base = workspace.baseCurrency;

  return (
    <div className="flex flex-col gap-8 max-w-[1240px]">
      <header>
        <Eyebrow>Projects</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Project Finance
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          Income, spend and budget per project — in base{" "}
          <span className="text-gold mono">{base}</span>. Link a PROJECT-type account or tag transactions to attribute spend.
        </p>
      </header>

      {projects.length === 0 ? (
        <BunEmpty
          title="No projects yet"
          description="Create a project in /projects, then link a PROJECT account or tag transactions to track its finances here."
        />
      ) : (
        <div className="mb-card">
          <div className="hidden md:grid grid-cols-[1.4fr_120px_120px_120px_120px_120px] px-4 py-3 border-b border-line">
            {["Project", "Income", "Expense", "Net", "Budget", "Remaining"].map((h) => (
              <span key={h} className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">{h}</span>
            ))}
          </div>
          {projects.map((p) => {
            const f = finance.get(p.id) ?? { income: 0, expense: 0, net: 0, txnCount: 0 };
            const budget = p.budget != null ? Number(p.budget) : null;
            const remaining = budget != null ? budget - f.expense : null;
            const over = remaining != null && remaining < 0;
            return (
              <Link
                key={p.id}
                href={`/finance/${slug}/projects/${p.id}`}
                className="block border-b border-line last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <div className="grid grid-cols-2 md:grid-cols-[1.4fr_120px_120px_120px_120px_120px] gap-2 px-4 py-3 md:items-center">
                  <div className="flex items-center gap-2 min-w-0 col-span-2 md:col-span-1">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="font-sans text-sm text-white truncate">{p.name}</span>
                    {p._count.finAccounts > 0 && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold border border-[var(--border-str)] px-1.5 py-0.5 shrink-0">acct</span>
                    )}
                  </div>
                  <span className="mono text-sm text-[var(--color-up)]"><Money value={f.income} currency={base} /></span>
                  <span className="mono text-sm text-[var(--color-down)]"><Money value={f.expense} currency={base} /></span>
                  <span className="mono text-sm text-white"><Money value={f.net} currency={base} /></span>
                  <span className="mono text-sm text-gray-2">{budget != null ? <Money value={budget} currency={base} /> : "—"}</span>
                  <span className={`mono text-sm ${over ? "text-[var(--color-down)]" : "text-gray-2"}`}>
                    {remaining != null ? <Money value={remaining} currency={base} /> : "—"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
