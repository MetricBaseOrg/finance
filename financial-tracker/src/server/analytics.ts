import "server-only";
import Decimal from "decimal.js";
import { db } from "@/server/db";
import type { DashboardPeriod } from "@/lib/periods";
import { PERIOD_LABELS } from "@/lib/periods";

export type SankeySource = { name: string; value: number; color: string };
export type SankeySink = { name: string; value: number; color: string };

export type DashboardSummary = {
  cashflowMtd: string; // baseCurrency
  incomeMtd: string;
  expenseMtd: string;
  monthOverMonth: number | null; // percent vs prior month cashflow
  cashflowByMonth: { month: string; income: number; expense: number }[];
  categoryBreakdown: { name: string; value: number; color: string | null }[];
  sankey: { sources: SankeySource[]; sinks: SankeySink[] };
  recent: Awaited<ReturnType<typeof recentTxns>>;
  balanceSeries: { date: string; value: number }[];
  rangeStart: Date;
  rangeEnd: Date;
};

async function recentTxns(workspaceId: string) {
  return db.transaction.findMany({
    where: { workspaceId },
    include: { finAccount: true, category: true, counterAccount: true },
    orderBy: { date: "desc" },
    take: 5,
  });
}

export type { DashboardPeriod };
export { PERIOD_LABELS };

const INCOME_COLORS = ["#c9a84c", "#e5c168", "#d9b958", "#bfa44d", "#8a7434", "#a18838", "#6b5826", "#7b6630"];
const EXPENSE_COLORS = ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#991b1b", "#fca5a5", "#7f1d1d", "#fecaca"];
const INVEST_COLOR = "#4a9eff";

function periodRange(
  period: DashboardPeriod,
  customRange?: { start: Date; end: Date }
): { rangeStart: Date; rangeEnd: Date; barMonths: number } {
  if (period === "custom" && customRange) {
    const barMonths = Math.max(
      1,
      (customRange.end.getUTCFullYear() - customRange.start.getUTCFullYear()) * 12 +
        (customRange.end.getUTCMonth() - customRange.start.getUTCMonth()) +
        1
    );
    return { rangeStart: customRange.start, rangeEnd: customRange.end, barMonths };
  }

  const now = new Date();
  const rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  switch (period) {
    case "mtd":
      return { rangeStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), rangeEnd, barMonths: 1 };
    case "qtd": {
      const qStartMonth = now.getUTCMonth() - (now.getUTCMonth() % 3);
      return {
        rangeStart: new Date(Date.UTC(now.getUTCFullYear(), qStartMonth, 1)),
        rangeEnd,
        barMonths: now.getUTCMonth() - qStartMonth + 1,
      };
    }
    case "3m":
      return { rangeStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)), rangeEnd, barMonths: 3 };
    case "6m":
      return { rangeStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)), rangeEnd, barMonths: 6 };
    case "ytd":
      return { rangeStart: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), rangeEnd, barMonths: now.getUTCMonth() + 1 };
    case "1y":
      return { rangeStart: new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() + 1, 1)), rangeEnd, barMonths: 12 };
    case "custom":
      return { rangeStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), rangeEnd, barMonths: 1 };
  }
}

export async function buildDashboard(
  workspaceId: string,
  period: DashboardPeriod = "mtd",
  customRange?: { start: Date; end: Date }
): Promise<DashboardSummary> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true },
  });
  const isCompany = workspace?.type === "COMPANY";

  const now = new Date();
  const { rangeStart: monthStart, rangeEnd: nextMonthStart, barMonths } = periodRange(period, customRange);
  const prevMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  // MTD aggregates
  const mtdAgg = await db.transaction.groupBy({
    by: ["type"],
    where: {
      workspaceId,
      date: { gte: monthStart, lt: nextMonthStart },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    _sum: { baseAmount: true },
  });

  const incomeMtd = new Decimal(
    mtdAgg.find((a) => a.type === "INCOME")?._sum.baseAmount?.toString() ?? 0,
  );
  const expenseMtd = new Decimal(
    mtdAgg.find((a) => a.type === "EXPENSE")?._sum.baseAmount?.toString() ?? 0,
  );
  const cashflowMtd = incomeMtd.minus(expenseMtd);

  // Prior month for MoM
  const prevAgg = await db.transaction.groupBy({
    by: ["type"],
    where: {
      workspaceId,
      date: { gte: prevMonthStart, lt: monthStart },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    _sum: { baseAmount: true },
  });
  const prevIncome = new Decimal(
    prevAgg.find((a) => a.type === "INCOME")?._sum.baseAmount?.toString() ?? 0,
  );
  const prevExpense = new Decimal(
    prevAgg.find((a) => a.type === "EXPENSE")?._sum.baseAmount?.toString() ?? 0,
  );
  const prevCashflow = prevIncome.minus(prevExpense);
  const monthOverMonth = prevCashflow.isZero()
    ? null
    : cashflowMtd.minus(prevCashflow).div(prevCashflow.abs()).times(100).toNumber();

  // Bar series for selected period
  const series = await db.transaction.findMany({
    where: {
      workspaceId,
      date: { gte: monthStart, lt: nextMonthStart },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    select: { date: true, type: true, baseAmount: true },
  });
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < barMonths; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (barMonths - 1 - i), 1));
    const key = d.toISOString().slice(0, 7);
    byMonth.set(key, { income: 0, expense: 0 });
  }
  for (const t of series) {
    const key = t.date.toISOString().slice(0, 7);
    const slot = byMonth.get(key);
    if (!slot) continue;
    const v = new Decimal(t.baseAmount.toString()).toNumber();
    if (t.type === "INCOME") slot.income += v;
    else slot.expense += v;
  }
  const cashflowByMonth = Array.from(byMonth.entries()).map(([month, v]) => ({
    month,
    income: Math.round(v.income),
    expense: Math.round(v.expense),
  }));

  // Category breakdown (expenses only, excluding investment transactions)
  const catAgg = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      date: { gte: monthStart, lt: nextMonthStart },
      type: "EXPENSE",
      positionId: null,
    },
    _sum: { baseAmount: true },
  });

  const investAgg = await db.transaction.aggregate({
    where: {
      workspaceId,
      date: { gte: monthStart, lt: nextMonthStart },
      type: "EXPENSE",
      positionId: { not: null },
    },
    _sum: { baseAmount: true },
  });
  const investTotal = new Decimal(investAgg._sum.baseAmount?.toString() ?? 0).toNumber();
  const categoryIds = catAgg.map((c) => c.categoryId).filter(Boolean) as string[];
  const cats = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const rawBreakdown = catAgg
    .map((c) => ({
      name: c.categoryId
        ? byId.get(c.categoryId)?.name ?? "Uncategorized"
        : "Uncategorized",
      value: new Decimal(c._sum.baseAmount?.toString() ?? 0).toNumber(),
      color: c.categoryId ? byId.get(c.categoryId)?.color ?? null : null,
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (investTotal > 0) {
    rawBreakdown.unshift({ name: "Investments", value: investTotal, color: INVEST_COLOR });
  }

  const categoryBreakdown = rawBreakdown.map((c, i) => ({
    ...c,
    color: c.color,
  }));

  // Sankey: income sources → expense sinks (direct proportional flow)
  const incomeAgg = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { workspaceId, date: { gte: monthStart, lt: nextMonthStart }, type: "INCOME" },
    _sum: { baseAmount: true },
  });
  const incomeCatIds = incomeAgg.map((r) => r.categoryId).filter(Boolean) as string[];
  const incomeCats = await db.category.findMany({ where: { id: { in: incomeCatIds } }, select: { id: true, name: true } });
  const incomeCatMap = new Map(incomeCats.map((c) => [c.id, c.name]));

  const sankeySourcesRaw = incomeAgg
    .map((r) => ({
      name: r.categoryId ? incomeCatMap.get(r.categoryId) ?? "Income" : "Income",
      value: Math.round(new Decimal(r._sum.baseAmount?.toString() ?? 0).toNumber()),
    }))
    .filter((r) => r.value > 0);

  const sources: SankeySource[] = sankeySourcesRaw.map((r, i) => ({
    ...r,
    color: INCOME_COLORS[i % INCOME_COLORS.length],
  }));

  const sinks: SankeySink[] = categoryBreakdown
    .filter((c) => c.value > 0)
    .map((c, i) => ({
      name: c.name,
      value: Math.round(c.value),
      color: c.color ?? EXPENSE_COLORS[i % EXPENSE_COLORS.length],
    }));

  const totalSrcVal = sources.reduce((s, x) => s + x.value, 0);
  const totalSnkVal = sinks.reduce((s, x) => s + x.value, 0);

  if (totalSrcVal > totalSnkVal && totalSrcVal > 0) {
    sinks.push({
      name: isCompany ? "Net profit" : "Net savings",
      value: totalSrcVal - totalSnkVal,
      color: "#22c55e", // Green
    });
  } else if (totalSnkVal > totalSrcVal && totalSnkVal > 0) {
    sources.push({
      name: isCompany ? "Net loss" : "Net savings",
      value: totalSnkVal - totalSrcVal,
      color: "#ef4444", // Red
    });
  }

  const sankey = { sources, sinks };

  const recent = await recentTxns(workspaceId);

  // ── Running Balance (1 Year Max or rangeStart) ──
  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  oneYearAgo.setUTCHours(0, 0, 0, 0);

  const seriesStartDate = monthStart < oneYearAgo ? monthStart : oneYearAgo;

  const accounts = await db.finAccount.findMany({ where: { workspaceId }, select: { openingBalance: true } });
  let totalOpening = 0;
  for (const a of accounts) {
    totalOpening += new Decimal(a.openingBalance.toString()).toNumber();
  }

  const [priorInc, priorExp] = await Promise.all([
    db.transaction.aggregate({ where: { workspaceId, type: "INCOME", date: { lt: seriesStartDate } }, _sum: { baseAmount: true } }),
    db.transaction.aggregate({ where: { workspaceId, type: "EXPENSE", date: { lt: seriesStartDate } }, _sum: { baseAmount: true } })
  ]);
  
  let currentBalance = totalOpening 
    + new Decimal(priorInc._sum.baseAmount?.toString() || 0).toNumber()
    - new Decimal(priorExp._sum.baseAmount?.toString() || 0).toNumber();

  const yearTxns = await db.transaction.findMany({
    where: { workspaceId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: seriesStartDate } },
    select: { date: true, type: true, baseAmount: true },
    orderBy: { date: "asc" }
  });

  const txnsByDay = new Map<string, number>();
  for (const t of yearTxns) {
    const day = t.date.toISOString().slice(0, 10);
    const amt = new Decimal(t.baseAmount.toString()).toNumber();
    const net = t.type === "INCOME" ? amt : -amt;
    txnsByDay.set(day, (txnsByDay.get(day) || 0) + net);
  }

  const balanceSeries: { date: string; value: number }[] = [];
  const iterDate = new Date(seriesStartDate);
  const endIterDate = new Date();
  if (nextMonthStart > endIterDate) {
    endIterDate.setTime(nextMonthStart.getTime());
  }
  endIterDate.setUTCHours(0, 0, 0, 0); // up to today or range end

  while (iterDate <= endIterDate) {
    const day = iterDate.toISOString().slice(0, 10);
    const dayNet = txnsByDay.get(day) || 0;
    currentBalance += dayNet;
    balanceSeries.push({ date: day, value: currentBalance });
    iterDate.setUTCDate(iterDate.getUTCDate() + 1);
  }

  return {
    cashflowMtd: cashflowMtd.toString(),
    incomeMtd: incomeMtd.toString(),
    expenseMtd: expenseMtd.toString(),
    monthOverMonth,
    cashflowByMonth,
    categoryBreakdown,
    sankey,
    recent,
    balanceSeries,
    rangeStart: monthStart,
    rangeEnd: nextMonthStart,
  };
}

export type BudgetRow = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  budget: number | null;
  actual: number; // baseCurrency, MTD
};

export async function buildBudgets(workspaceId: string): Promise<BudgetRow[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const cats = await db.category.findMany({
    where: { workspaceId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  const agg = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      date: { gte: monthStart, lt: nextMonthStart },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    _sum: { baseAmount: true },
  });
  const byId = new Map(
    agg.map((a) => [
      a.categoryId,
      new Decimal(a._sum.baseAmount?.toString() ?? 0).toNumber(),
    ]),
  );
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    budget: c.monthlyBudget ? new Decimal(c.monthlyBudget.toString()).toNumber() : null,
    actual: byId.get(c.id) ?? 0,
  }));
}

export type BudgetAlert = {
  categoryId: string;
  name: string;
  budget: number;
  actual: number;
  overBy: number;
};

// Computed-only (no persistence). Surfaces EXPENSE categories whose MTD spend
// exceeds their monthly budget.
export async function buildAlerts(workspaceId: string): Promise<BudgetAlert[]> {
  const rows = await buildBudgets(workspaceId);
  return rows
    .filter(
      (r) =>
        r.kind === "EXPENSE" &&
        r.budget !== null &&
        r.budget > 0 &&
        r.actual > r.budget,
    )
    .map((r) => ({
      categoryId: r.id,
      name: r.name,
      budget: r.budget as number,
      actual: r.actual,
      overBy: r.actual - (r.budget as number),
    }))
    .sort((a, b) => b.overBy - a.overBy);
}
