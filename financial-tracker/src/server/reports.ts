import "server-only";
import Decimal from "decimal.js";
import { db } from "@/server/db";

export type PnlRow = {
  categoryId: string | null;
  name: string;
  kind: "INCOME" | "EXPENSE";
  total: number;
};

export type PnlReport = {
  from: Date;
  to: Date;
  income: PnlRow[];
  expense: PnlRow[];
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
};

export async function buildPnl(
  workspaceId: string,
  from: Date,
  to: Date,
): Promise<PnlReport> {
  const txns = await db.transaction.findMany({
    where: {
      workspaceId,
      date: { gte: from, lt: to },
      type: { in: ["INCOME", "EXPENSE"] },
      positionId: null,
    },
    include: { category: true },
  });

  type Bucket = Map<
    string,
    { name: string; total: Decimal; kind: "INCOME" | "EXPENSE" }
  >;
  const bucket: Bucket = new Map();

  for (const t of txns) {
    const key = t.categoryId ?? `__uncat_${t.type}`;
    const name = t.category?.name ?? `Uncategorized ${t.type.toLowerCase()}`;
    const slot = bucket.get(key) ?? {
      name,
      total: new Decimal(0),
      kind: t.type as "INCOME" | "EXPENSE",
    };
    slot.total = slot.total.plus(new Decimal(t.baseAmount.toString()));
    bucket.set(key, slot);
  }

  const rows: PnlRow[] = Array.from(bucket.entries()).map(([k, v]) => ({
    categoryId: k.startsWith("__uncat_") ? null : k,
    name: v.name,
    kind: v.kind,
    total: v.total.toNumber(),
  }));

  const income = rows
    .filter((r) => r.kind === "INCOME")
    .sort((a, b) => b.total - a.total);
  const expense = rows
    .filter((r) => r.kind === "EXPENSE")
    .sort((a, b) => b.total - a.total);

  const totalIncome = income.reduce((s, r) => s + r.total, 0);
  const totalExpense = expense.reduce((s, r) => s + r.total, 0);
  const netIncome = totalIncome - totalExpense;

  return { from, to, income, expense, totalIncome, totalExpense, netIncome };
}

export type AccountBalance = {
  id: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  movements: number; // baseCurrency net (in - out + transfers in - transfers out)
  balanceBase: number;
};

export type BalanceSheet = {
  asOf: Date;
  accounts: AccountBalance[];
  totalAssetsBase: number;
};

export async function buildBalanceSheet(
  workspaceId: string,
  asOf: Date,
): Promise<BalanceSheet> {
  const accounts = await db.finAccount.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const result: AccountBalance[] = [];
  let totalAssetsBase = 0;

  for (const a of accounts) {
    // Opening balance (native currency) → convert via latest known rate by counting
    // its movements in base too. For Phase 0 we assume opening balance equals base for
    // workspace.baseCurrency accounts; for others we don't pre-convert opening, we
    // surface native opening and movement net in base separately (good enough for v0).
    // To keep things simple and useful, we surface: balance native + movements base.
    const [incomingTransfers, outgoingTransfers, incomes, expenses] = await Promise.all([
      db.transaction.aggregate({
        where: {
          workspaceId,
          type: "TRANSFER",
          counterAccountId: a.id,
          date: { lt: asOf },
        },
        _sum: { baseAmount: true },
      }),
      db.transaction.aggregate({
        where: {
          workspaceId,
          type: "TRANSFER",
          finAccountId: a.id,
          date: { lt: asOf },
        },
        _sum: { baseAmount: true },
      }),
      db.transaction.aggregate({
        where: {
          workspaceId,
          type: "INCOME",
          finAccountId: a.id,
          date: { lt: asOf },
        },
        _sum: { baseAmount: true },
      }),
      db.transaction.aggregate({
        where: {
          workspaceId,
          type: "EXPENSE",
          finAccountId: a.id,
          date: { lt: asOf },
        },
        _sum: { baseAmount: true },
      }),
    ]);

    const inflows = new Decimal(incomes._sum.baseAmount?.toString() ?? 0)
      .plus(incomingTransfers._sum.baseAmount?.toString() ?? 0);
    const outflows = new Decimal(expenses._sum.baseAmount?.toString() ?? 0)
      .plus(outgoingTransfers._sum.baseAmount?.toString() ?? 0);
    const movements = inflows.minus(outflows).toNumber();
    const openingNative = new Decimal(a.openingBalance.toString()).toNumber();

    // For base balance estimate, just add movements to opening expressed as native:
    // we don't FX-convert opening here, so the column is "movements base" — operator
    // can read native opening separately. Net assets uses opening * 1 (treat opening
    // in native) plus movements (already base) — caveat documented in UI.
    const balanceBase = openingNative + movements;
    totalAssetsBase += balanceBase;

    result.push({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      openingBalance: openingNative,
      movements,
      balanceBase,
    });
  }

  return { asOf, accounts: result, totalAssetsBase };
}
