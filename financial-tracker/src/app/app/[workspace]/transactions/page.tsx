import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { Money } from "@/components/mb/Money";
import { TransactionCreateForm } from "./TransactionCreateForm";
import { TransactionRowActions } from "./TransactionRowActions";
import { TransactionFilters } from "./TransactionFilters";
import { ImportCsvSection } from "./ImportCsvSection";

const PAGE_SIZE = 50;

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    type?: string;
    acct?: string;
    cat?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;
  const { workspace } = await requireMembership(slug);

  const [accounts, categories] = await Promise.all([
    db.finAccount.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    db.category.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
  ]);

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
        <header>
          <Eyebrow>Transactions</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Ledger
          </h1>
        </header>
        <BunEmpty
          title="Add an account first"
          description="You need at least one financial account before you can record transactions."
          action={
            <Link
              href={`/app/${slug}/accounts`}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright"
            >
              → Go to Accounts
            </Link>
          }
        />
      </div>
    );
  }

  // Build filter where clause
  const where: Record<string, unknown> = { workspaceId: workspace.id };
  if (sp.from) (where.date as Record<string, Date>) = { ...((where.date as object) || {}), gte: new Date(sp.from) };
  if (sp.to) (where.date as Record<string, Date>) = { ...((where.date as object) || {}), lte: new Date(sp.to) };
  if (sp.type && ["INCOME", "EXPENSE", "TRANSFER"].includes(sp.type)) where.type = sp.type;
  if (sp.acct) where.finAccountId = sp.acct;
  if (sp.cat) where.categoryId = sp.cat;
  if (sp.q) where.memo = { contains: sp.q, mode: "insensitive" };

  const page = Math.max(1, Number(sp.page) || 1);

  const [txns, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        finAccount: true,
        counterAccount: true,
        category: true,
      },
      orderBy: { date: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.transaction.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Eyebrow>Transactions</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Ledger
          </h1>
          <p className="text-gray-2 text-sm mt-2">
            {total} {total === 1 ? "transaction" : "transactions"} · Base{" "}
            <span className="text-gold mono">{workspace.baseCurrency}</span>
          </p>
        </div>
        <Link
          href={`/api/export/csv?slug=${slug}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
          className="self-start sm:self-auto font-mono text-[11px] uppercase tracking-[0.18em] text-gold border border-gold hover:bg-gold hover:text-black px-4 py-2.5 transition-colors"
        >
          Export CSV
        </Link>
      </header>

      <TransactionCreateForm
        slug={slug}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          currency: a.currency,
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
        }))}
      />

      <ImportCsvSection
        slug={slug}
        accounts={accounts.map((a) => ({ name: a.name }))}
        categories={categories.map((c) => ({ name: c.name, kind: c.kind }))}
      />

      <TransactionFilters
        slug={slug}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      />

      {txns.length === 0 ? (
        <BunEmpty
          title="No transactions match"
          description="Try widening your filters or recording a new entry above."
        />
      ) : (
        <div className="mb-card">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[100px_100px_1.6fr_1.2fr_140px_60px] px-4 py-3 border-b border-line">
            {["Date", "Type", "Memo · Category", "Account", "Amount", ""].map(
              (h) => (
                <span
                  key={h}
                  className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
                >
                  {h}
                </span>
              ),
            )}
          </div>
          {txns.map((t) => {
            const tone =
              t.type === "INCOME"
                ? "text-[var(--color-up)]"
                : t.type === "EXPENSE"
                  ? "text-[var(--color-down)]"
                  : "text-gray-1";
            const sign = t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : "↔";
            return (
              <div
                key={t.id}
                className="border-b border-line last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-[100px_100px_1.6fr_1.2fr_140px_60px] px-4 py-3 items-center">
                  <span className="font-mono text-xs text-gray-2">
                    {t.date.toISOString().slice(0, 10)}
                  </span>
                  <span className={`font-mono text-xs ${tone}`}>{t.type}</span>
                  <div className="flex flex-col">
                    <span className="font-sans text-sm text-white">
                      {t.memo || (t.category?.name ?? "—")}
                    </span>
                    {t.memo && t.category && (
                      <span className="font-mono text-[10px] text-gray-3 uppercase tracking-[0.15em] mt-0.5">
                        {t.category.name}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-gray-2">
                    {t.finAccount.name}
                    {t.counterAccount ? ` → ${t.counterAccount.name}` : ""}
                  </span>
                  <span className={`mono text-sm ${tone}`}>
                    {sign}{" "}
                    <Money value={t.amount.toString()} currency={t.currency} />
                  </span>
                  <TransactionRowActions slug={slug} id={t.id} />
                </div>
                {/* Mobile card */}
                <div className="md:hidden px-4 py-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-sans text-sm text-white truncate">
                        {t.memo || t.category?.name || "—"}
                      </span>
                      <span className="font-mono text-[10px] text-gray-3 uppercase tracking-[0.18em] mt-1">
                        {t.date.toISOString().slice(0, 10)} · {t.type}
                        {t.category && t.memo ? ` · ${t.category.name}` : ""}
                      </span>
                    </div>
                    <span className={`mono text-base font-bold shrink-0 ${tone}`}>
                      {sign}{" "}
                      <Money value={t.amount.toString()} currency={t.currency} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3 pt-1">
                    <span className="font-mono text-[10px] text-gray-3 truncate">
                      {t.finAccount.name}
                      {t.counterAccount ? ` → ${t.counterAccount.name}` : ""}
                    </span>
                    <TransactionRowActions slug={slug} id={t.id} />
                  </div>
                </div>
              </div>
            );
          })}
          {totalPages > 1 && (
            <div className="px-4 py-3 flex justify-between items-center border-t border-line">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <PageLink slug={slug} sp={sp} page={page - 1} disabled={page <= 1}>
                  ← Prev
                </PageLink>
                <PageLink
                  slug={slug}
                  sp={sp}
                  page={page + 1}
                  disabled={page >= totalPages}
                >
                  Next →
                </PageLink>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageLink({
  slug,
  sp,
  page,
  disabled,
  children,
}: {
  slug: string;
  sp: Record<string, string | undefined>;
  page: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-4 px-3 py-1.5 border border-line">
        {children}
      </span>
    );
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue;
    if (v) params.set(k, v);
  }
  params.set("page", String(page));
  return (
    <Link
      href={`/app/${slug}/transactions?${params.toString()}`}
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:text-gold-bright px-3 py-1.5 border border-line hover:border-gold transition-colors"
    >
      {children}
    </Link>
  );
}
