import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { RecurringContent } from "./RecurringContent";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);

  const [rules, dueCount, accounts, categories] = await Promise.all([
    db.recurringRule.findMany({
      where: { workspaceId: workspace.id },
      include: {
        finAccount: {
          select: {
            id: true,
            name: true,
            currency: true,
            type: true,
            createdAt: true,
            archivedAt: true,
            workspaceId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.recurringRule.count({
      where: {
        workspaceId: workspace.id,
        nextRunDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
    }),
    db.finAccount.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      select: { id: true, name: true, currency: true },
    }),
    db.category.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, kind: true },
    }),
  ]);

  const serializedRules = rules.map((r) => ({
    ...r,
    amount: r.amount.toString(),
    finAccount: {
      id: r.finAccount.id,
      name: r.finAccount.name,
      currency: r.finAccount.currency,
    },
  })) as any;

  return (
    <RecurringContent
      rules={serializedRules}
      dueRulesCount={dueCount}
      slug={slug}
      accounts={accounts}
      categories={categories}
    />
  );
}
