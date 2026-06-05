import { NextRequest } from "next/server";
import Papa from "papaparse";
import { requireMembership } from "@/server/workspace";
import { buildPnl } from "@/server/reports";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const kind = url.searchParams.get("kind") ?? "transactions";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }
  const { workspace } = await requireMembership(slug);

  if (kind === "pnl") {
    if (!from || !to) return new Response("Missing date range", { status: 400 });
    const report = await buildPnl(workspace.id, new Date(from), new Date(to));
    const rows = [
      ...report.income.map((r) => ({
        kind: "INCOME",
        category: r.name,
        amount_base: r.total.toFixed(2),
        currency: workspace.baseCurrency,
      })),
      ...report.expense.map((r) => ({
        kind: "EXPENSE",
        category: r.name,
        amount_base: r.total.toFixed(2),
        currency: workspace.baseCurrency,
      })),
      {
        kind: "TOTAL",
        category: "Income",
        amount_base: report.totalIncome.toFixed(2),
        currency: workspace.baseCurrency,
      },
      {
        kind: "TOTAL",
        category: "Expense",
        amount_base: report.totalExpense.toFixed(2),
        currency: workspace.baseCurrency,
      },
      {
        kind: "TOTAL",
        category: "Net income",
        amount_base: report.netIncome.toFixed(2),
        currency: workspace.baseCurrency,
      },
    ];
    const csv = Papa.unparse(rows);
    return csvResponse(csv, `metricbase-pnl-${slug}-${from}-to-${to}.csv`);
  }

  // Default: transactions in date range (or all)
  const where: Record<string, unknown> = { workspaceId: workspace.id };
  if (from || to) {
    const date: { gte?: Date; lt?: Date } = {};
    if (from) date.gte = new Date(from);
    if (to) date.lt = new Date(to);
    where.date = date;
  }
  const txns = await db.transaction.findMany({
    where,
    include: { finAccount: true, counterAccount: true, category: true },
    orderBy: { date: "asc" },
  });
  const rows = txns.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    type: t.type,
    account: t.finAccount.name,
    counter_account: t.counterAccount?.name ?? "",
    category: t.category?.name ?? "",
    memo: t.memo ?? "",
    amount: t.amount.toString(),
    currency: t.currency,
    fx_rate: t.fxRate.toString(),
    amount_base: t.baseAmount.toString(),
    base_currency: workspace.baseCurrency,
  }));
  const csv = Papa.unparse(rows);
  return csvResponse(csv, `metricbase-txns-${slug}.csv`);
}

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
