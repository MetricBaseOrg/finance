"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import Decimal from "decimal.js";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { getFxRate } from "@/server/fx/provider";

const baseSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  finAccountId: z.string().min(1),
  amount: z.coerce.number().positive(),
  memo: z.string().max(200).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  counterAccountId: z.string().optional().nullable(),
});

export type TxnActionState = { error?: string };

export async function createTransaction(
  slug: string,
  _prev: TxnActionState | undefined,
  formData: FormData,
): Promise<TxnActionState> {
  const { user, workspace } = await requireMembership(slug);
  const parsed = baseSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    finAccountId: formData.get("finAccountId"),
    amount: formData.get("amount"),
    memo: formData.get("memo") || null,
    categoryId: formData.get("categoryId") || null,
    counterAccountId: formData.get("counterAccountId") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  if (input.type === "TRANSFER" && !input.counterAccountId) {
    return { error: "Transfers require a destination account." };
  }
  if (input.type === "TRANSFER" && input.counterAccountId === input.finAccountId) {
    return { error: "Source and destination must differ." };
  }

  const primary = await db.finAccount.findFirst({
    where: { id: input.finAccountId, workspaceId: workspace.id },
  });
  if (!primary) return { error: "Source account not found." };

  let counter = null as Awaited<ReturnType<typeof db.finAccount.findFirst>> | null;
  if (input.counterAccountId) {
    counter = await db.finAccount.findFirst({
      where: { id: input.counterAccountId, workspaceId: workspace.id },
    });
    if (!counter) return { error: "Destination account not found." };
  }

  // INCOME/EXPENSE: amount is in primary.currency
  // TRANSFER: amount is debited from primary in primary.currency
  // FX rate: convert primary.currency → workspace.baseCurrency on `date`
  let fxRate: Decimal;
  try {
    fxRate = await getFxRate(primary.currency, workspace.baseCurrency, input.date);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "FX lookup failed" };
  }

  const amount = new Decimal(input.amount);
  const baseAmount = amount.times(fxRate);

  const created = await db.transaction.create({
    data: {
      workspaceId: workspace.id,
      finAccountId: primary.id,
      counterAccountId: counter?.id,
      categoryId:
        input.type === "TRANSFER" ? null : input.categoryId || null,
      date: input.date,
      amount: amount.toString(),
      currency: primary.currency,
      fxRate: fxRate.toString(),
      baseAmount: baseAmount.toString(),
      type: input.type,
      memo: input.memo || null,
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "CREATE",
    entityType: "TRANSACTION",
    entityId: created.id,
    summary: `${input.type} ${amount.toString()} ${primary.currency}`,
  });
  revalidatePath(`/app/${slug}/transactions`);
  revalidatePath(`/app/${slug}/dashboard`);
  return {};
}

export async function deleteTransaction(slug: string, id: string) {
  const { user, workspace } = await requireMembership(slug);
  await db.transaction.deleteMany({
    where: { id, workspaceId: workspace.id },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "DELETE",
    entityType: "TRANSACTION",
    entityId: id,
    summary: "Deleted transaction",
  });
  revalidatePath(`/app/${slug}/transactions`);
  revalidatePath(`/app/${slug}/dashboard`);
}

export async function updateTransaction(
  slug: string,
  id: string,
  _prev: TxnActionState | undefined,
  formData: FormData,
): Promise<TxnActionState> {
  const { user, workspace } = await requireMembership(slug);
  const existing = await db.transaction.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) return { error: "Transaction not found." };

  const parsed = baseSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    finAccountId: formData.get("finAccountId"),
    amount: formData.get("amount"),
    memo: formData.get("memo") || null,
    categoryId: formData.get("categoryId") || null,
    counterAccountId: formData.get("counterAccountId") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  if (input.type === "TRANSFER" && !input.counterAccountId) {
    return { error: "Transfers require a destination account." };
  }
  if (input.type === "TRANSFER" && input.counterAccountId === input.finAccountId) {
    return { error: "Source and destination must differ." };
  }

  const primary = await db.finAccount.findFirst({
    where: { id: input.finAccountId, workspaceId: workspace.id },
  });
  if (!primary) return { error: "Source account not found." };

  let counter = null as Awaited<ReturnType<typeof db.finAccount.findFirst>> | null;
  if (input.counterAccountId) {
    counter = await db.finAccount.findFirst({
      where: { id: input.counterAccountId, workspaceId: workspace.id },
    });
    if (!counter) return { error: "Destination account not found." };
  }

  let fxRate: Decimal;
  try {
    fxRate = await getFxRate(primary.currency, workspace.baseCurrency, input.date);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "FX lookup failed" };
  }

  const amount = new Decimal(input.amount);
  const baseAmount = amount.times(fxRate);

  await db.transaction.update({
    where: { id },
    data: {
      finAccountId: primary.id,
      counterAccountId: input.type === "TRANSFER" ? counter?.id : null,
      categoryId: input.type === "TRANSFER" ? null : input.categoryId || null,
      date: input.date,
      amount: amount.toString(),
      currency: primary.currency,
      fxRate: fxRate.toString(),
      baseAmount: baseAmount.toString(),
      type: input.type,
      memo: input.memo || null,
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "TRANSACTION",
    entityId: id,
    summary: `Updated transaction (${input.type} ${amount.toString()} ${primary.currency})`,
  });
  revalidatePath(`/app/${slug}/transactions`);
  revalidatePath(`/app/${slug}/dashboard`);
  return {};
}

// ── CSV Import ────────────────────────────────────────────────────────────────

export type ImportResult = { imported: number; errors: string[] };

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { result.push(current); current = ""; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/ /g, "_"));
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  });
}

export async function importTransactions(
  slug: string,
  _prev: ImportResult | undefined,
  formData: FormData,
): Promise<ImportResult> {
  const { workspace } = await requireMembership(slug);
  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) return { imported: 0, errors: ["No file provided."] };

  const text = await file.text();
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { imported: 0, errors: ["CSV has no data rows."] };

  const [accounts, categories] = await Promise.all([
    db.finAccount.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, select: { id: true, name: true, currency: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id }, select: { id: true, name: true, kind: true } }),
  ]);

  const acctByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const { date, type, account, amount, memo, category, counter_account } = row;

    if (!date || !type || !account || !amount) {
      errors.push(`Row ${rowNum}: missing required field (date, type, account, amount).`);
      continue;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) { errors.push(`Row ${rowNum}: invalid date "${date}".`); continue; }

    const txnType = type.trim().toUpperCase();
    if (!["INCOME", "EXPENSE", "TRANSFER"].includes(txnType)) {
      errors.push(`Row ${rowNum}: type must be INCOME, EXPENSE, or TRANSFER.`);
      continue;
    }

    let primary = acctByName.get(account.toLowerCase());
    if (!primary) {
      primary = await db.finAccount.create({
        data: {
          workspaceId: workspace.id,
          name: account,
          type: "BANK",
          currency: workspace.baseCurrency,
        },
        select: { id: true, name: true, currency: true },
      });
      acctByName.set(account.toLowerCase(), primary);
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push(`Row ${rowNum}: amount must be a positive number.`);
      continue;
    }

    let counterId: string | null = null;
    if (txnType === "TRANSFER") {
      if (!counter_account) { errors.push(`Row ${rowNum}: TRANSFER requires counter_account.`); continue; }
      let counter = acctByName.get(counter_account.toLowerCase());
      if (!counter) {
        counter = await db.finAccount.create({
          data: {
            workspaceId: workspace.id,
            name: counter_account,
            type: "BANK",
            currency: workspace.baseCurrency,
          },
          select: { id: true, name: true, currency: true },
        });
        acctByName.set(counter_account.toLowerCase(), counter);
      }
      if (counter.id === primary.id) { errors.push(`Row ${rowNum}: source and destination must differ.`); continue; }
      counterId = counter.id;
    }

    let categoryId: string | null = null;
    if (category && txnType !== "TRANSFER") {
      let cat = catByName.get(category.toLowerCase());
      if (!cat) {
        cat = await db.category.create({
          data: {
            workspaceId: workspace.id,
            name: category,
            kind: txnType === "INCOME" ? "INCOME" : "EXPENSE",
          },
          select: { id: true, name: true, kind: true },
        });
        catByName.set(category.toLowerCase(), cat);
      }
      categoryId = cat.id;
    }

    let fxRate: Decimal;
    try {
      fxRate = await getFxRate(primary.currency, workspace.baseCurrency, parsedDate);
    } catch {
      errors.push(`Row ${rowNum}: FX rate unavailable for ${primary.currency}→${workspace.baseCurrency} on ${date}.`);
      continue;
    }

    const amountD = new Decimal(parsedAmount);
    await db.transaction.create({
      data: {
        workspaceId: workspace.id,
        finAccountId: primary.id,
        counterAccountId: counterId,
        categoryId,
        date: parsedDate,
        amount: amountD.toString(),
        currency: primary.currency,
        fxRate: fxRate.toString(),
        baseAmount: amountD.times(fxRate).toString(),
        type: txnType as "INCOME" | "EXPENSE" | "TRANSFER",
        memo: memo || null,
      },
    });
    imported++;
  }

  if (imported > 0) {
    revalidatePath(`/app/${slug}/transactions`);
    revalidatePath(`/app/${slug}/dashboard`);
  }

  return { imported, errors };
}
