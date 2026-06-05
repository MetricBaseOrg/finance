import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { TransactionEditForm } from "./TransactionEditForm";

export default async function TransactionEditPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: slug, id } = await params;
  const { workspace } = await requireMembership(slug);

  const [txn, accounts, categories] = await Promise.all([
    db.transaction.findFirst({
      where: { id, workspaceId: workspace.id },
    }),
    db.finAccount.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    db.category.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!txn) notFound();
  if (accounts.length === 0) redirect(`/app/${slug}/accounts`);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <header className="flex justify-between items-end">
        <div>
          <Eyebrow>Edit transaction</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
            {txn.memo || "Transaction"}
          </h1>
        </div>
        <Link
          href={`/app/${slug}/transactions`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold"
        >
          ← Back
        </Link>
      </header>

      <TransactionEditForm
        slug={slug}
        id={txn.id}
        initial={{
          date: txn.date.toISOString().slice(0, 10),
          type: txn.type,
          finAccountId: txn.finAccountId,
          counterAccountId: txn.counterAccountId,
          categoryId: txn.categoryId,
          amount: txn.amount.toString(),
          memo: txn.memo,
        }}
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
    </div>
  );
}
