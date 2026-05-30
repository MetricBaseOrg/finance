import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { Money } from "@/components/mb/Money";
import { projectFinance } from "@/lib/finance/project";
import { BudgetForm } from "./BudgetForm";

export const dynamic = "force-dynamic";

export default async function ProjectFinancePage({
  params,
}: {
  params: Promise<{ workspace: string; projectId: string }>;
}) {
  const { workspace: slug, projectId } = await params;
  const { workspace } = await requireMembership(slug);
  const base = workspace.baseCurrency;

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: workspace.id },
    select: {
      id: true, name: true, color: true, budget: true,
      finAccounts: { select: { id: true, name: true, currency: true, openingBalance: true } },
    },
  });
  if (!project) notFound();

  const [f, recent] = await Promise.all([
    projectFinance(workspace.id, projectId),
    db.transaction.findMany({
      where: { organizationId: workspace.id, projectId, status: "POSTED" },
      include: { finAccount: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const budget = project.budget != null ? Number(project.budget) : null;
  const remaining = budget != null ? budget - f.expense : null;
  const pct = budget && budget > 0 ? Math.min(100, Math.round((f.expense / budget) * 100)) : null;

  return (
    <div className="flex flex-col gap-8 max-w-[1240px]">
      <Link href={`/finance/${slug}/projects`} className="font-mono rounded-lg text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors self-start">
        ← All projects
      </Link>
      <header className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: project.color }} />
        <div>
          <Eyebrow>Project finance</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-1">{project.name}</h1>
        </div>
        <Link href={`/projects/${project.id}`} className="ml-auto font-mono rounded-lg text-[11px] uppercase tracking-[0.18em] text-gold hover:text-gold-bright">
          Open in Projects →
        </Link>
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Income" value={f.income} base={base} tone="up" />
        <Kpi label="Expense" value={f.expense} base={base} tone="down" />
        <Kpi label="Net" value={f.net} base={base} />
        <Kpi label="Transactions" raw={String(f.txnCount)} />
      </div>

      {/* Budget vs actual */}
      <div className="mb-card p-6 flex flex-col gap-4">
        <Eyebrow>Budget vs actual</Eyebrow>
        {budget != null ? (
          <>
            <div className="flex justify-between font-mono text-xs text-gray-2">
              <span>Spent <Money value={f.expense} currency={base} /></span>
              <span>Budget <Money value={budget} currency={base} /></span>
            </div>
            <div className="h-2 w-full bg-[var(--mid)] border border-line overflow-hidden">
              <div className="h-full" style={{ width: `${pct ?? 0}%`, background: remaining != null && remaining < 0 ? "var(--color-down)" : "var(--gold)" }} />
            </div>
            <div className="font-mono text-xs">
              {remaining != null && remaining < 0
                ? <span className="text-[var(--color-down)]">Over budget by <Money value={Math.abs(remaining)} currency={base} /></span>
                : <span className="text-gray-2"><Money value={remaining ?? 0} currency={base} /> remaining</span>}
            </div>
          </>
        ) : (
          <p className="text-gray-3 text-sm">No budget set. Add one to track spend against it.</p>
        )}
        <BudgetForm slug={slug} projectId={project.id} initial={budget} base={base} />
      </div>

      {/* Linked accounts */}
      {project.finAccounts.length > 0 && (
        <div className="flex flex-col gap-3">
          <Eyebrow>Linked accounts</Eyebrow>
          <div className="mb-card">
            {project.finAccounts.map((a) => (
              <div key={a.id} className="border-b border-line last:border-b-0 px-4 py-3 flex justify-between items-center">
                <span className="font-sans text-sm text-white">{a.name}</span>
                <span className="font-mono text-xs text-gray-2">{a.currency} · opening <Money value={a.openingBalance.toString()} currency={a.currency} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Recent transactions</Eyebrow>
          <Link href={`/finance/${slug}/transactions?project=${project.id}`} className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:text-gold-bright">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="mb-card px-4 py-6 text-center text-gray-3 text-sm">No transactions attributed to this project yet.</div>
        ) : (
          <div className="mb-card">
            {recent.map((t) => {
              const tone = t.type === "INCOME" ? "text-[var(--color-up)]" : t.type === "EXPENSE" ? "text-[var(--color-down)]" : "text-gray-1";
              const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : "↔";
              return (
                <div key={t.id} className="border-b border-line last:border-b-0 px-4 py-3 flex justify-between items-center gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="font-sans text-sm text-white truncate">{t.memo || t.category?.name || "—"}</span>
                    <span className="font-mono text-[10px] text-gray-3 uppercase tracking-[0.15em] mt-0.5">{t.date.toISOString().slice(0, 10)} · {t.finAccount.name}</span>
                  </div>
                  <span className={`mono text-sm shrink-0 ${tone}`}>{sign} <Money value={t.amount.toString()} currency={t.currency} /></span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, raw, base, tone }: { label: string; value?: number; raw?: string; base?: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-[var(--color-up)]" : tone === "down" ? "text-[var(--color-down)]" : "text-white";
  return (
    <div className="mb-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">{label}</div>
      <div className={`mono text-xl font-bold mt-1 ${color}`}>
        {raw != null ? raw : <Money value={value ?? 0} currency={base!} />}
      </div>
    </div>
  );
}
