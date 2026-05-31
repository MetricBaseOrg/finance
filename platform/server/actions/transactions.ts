"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import Decimal from "decimal.js";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { getFxRate } from "@/server/fx/provider";
import { notifyApprovers } from "@/lib/finance/notify-approvers";

const baseSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  finAccountId: z.string().min(1),
  amount: z.coerce.number().positive(),
  memo: z.string().max(200).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  counterAccountId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
});

export type TxnActionState = { error?: string };

/** A PROJECT account binds its transactions to its project (account wins);
 *  otherwise the per-transaction project tag applies (validated to the org). */
async function resolveProjectId(
  organizationId: string,
  account: { type: string; projectId: string | null },
  formProjectId: string | null,
): Promise<string | null> {
  if (account.type === "PROJECT" && account.projectId) return account.projectId;
  if (!formProjectId) return null;
  const proj = await db.project.findFirst({
    where: { id: formProjectId, organizationId },
    select: { id: true },
  });
  return proj?.id ?? null;
}

export async function createTransaction(
  slug: string,
  _prev: TxnActionState | undefined,
  formData: FormData,
): Promise<TxnActionState> {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role === "VIEWER") {
    return { error: "Your role does not permit recording transactions." };
  }
  const status = membership.role === "MEMBER" ? "PENDING" : "POSTED";
  const parsed = baseSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    finAccountId: formData.get("finAccountId"),
    amount: formData.get("amount"),
    memo: formData.get("memo") || null,
    categoryId: formData.get("categoryId") || null,
    counterAccountId: formData.get("counterAccountId") || null,
    projectId: formData.get("projectId") || null,
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
    where: { id: input.finAccountId, organizationId: workspace.id },
  });
  if (!primary) return { error: "Source account not found." };

  let counter = null as Awaited<ReturnType<typeof db.finAccount.findFirst>> | null;
  if (input.counterAccountId) {
    counter = await db.finAccount.findFirst({
      where: { id: input.counterAccountId, organizationId: workspace.id },
    });
    if (!counter) return { error: "Destination account not found." };
  }

  const projectId = await resolveProjectId(workspace.id, primary, input.projectId ?? null);

  let fxRate: Decimal;
  try {
    fxRate = await getFxRate(primary.currency, workspace.baseCurrency, input.date);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "FX lookup failed" };
  }

  const amount = new Decimal(input.amount);
  const baseAmount = amount.times(fxRate);
  const detail = input.type + " " + amount.toString() + " " + primary.currency;

  const created = await db.transaction.create({
    data: {
      organizationId: workspace.id,
      finAccountId: primary.id,
      counterAccountId: counter?.id,
      categoryId: input.type === "TRANSFER" ? null : input.categoryId || null,
      projectId,
      date: input.date,
      amount: amount.toString(),
      currency: primary.currency,
      fxRate: fxRate.toString(),
      baseAmount: baseAmount.toString(),
      type: input.type,
      status: status,
      memo: input.memo || null,
      createdById: user.id,
    },
  });

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "CREATE",
    entityType: "TRANSACTION",
    entityId: created.id,
    summary: detail,
  });
  notifyApprovers({
    organizationId: workspace.id,
    slug,
    actorId: user.id,
    actorName: user.name || user.email || "A member",
    detail: detail,
    txType: input.type,
    memo: input.memo || undefined,
  }).catch(console.error);
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/dashboard");
  return {};
}

export async function deleteTransaction(slug: string, id: string) {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role === "VIEWER" || membership.role === "MEMBER") {
    return { error: "Your role does not permit deleting transactions." };
  }
  await db.transaction.deleteMany({
    where: { id, organizationId: workspace.id },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "DELETE",
    entityType: "TRANSACTION",
    entityId: id,
    summary: "Deleted transaction",
  });
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/dashboard");
  return {};
}

export async function updateTransaction(
  slug: string,
  id: string,
  _prev: TxnActionState | undefined,
  formData: FormData,
): Promise<TxnActionState> {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role === "VIEWER") {
    return { error: "Your role does not permit editing transactions." };
  }
  const existing = await db.transaction.findFirst({
    where: { id, organizationId: workspace.id },
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
    projectId: formData.get("projectId") || null,
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
    where: { id: input.finAccountId, organizationId: workspace.id },
  });
  if (!primary) return { error: "Source account not found." };

  let counter = null as Awaited<ReturnType<typeof db.finAccount.findFirst>> | null;
  if (input.counterAccountId) {
    counter = await db.finAccount.findFirst({
      where: { id: input.counterAccountId, organizationId: workspace.id },
    });
    if (!counter) return { error: "Destination account not found." };
  }

  const projectId = await resolveProjectId(workspace.id, primary, input.projectId ?? null);

  let fxRate: Decimal;
  try {
    fxRate = await getFxRate(primary.currency, workspace.baseCurrency, input.date);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "FX lookup failed" };
  }

  const amount = new Decimal(input.amount);
  const baseAmount = amount.times(fxRate);
  const newStatus = membership.role === "MEMBER" ? "PENDING" : existing.status;
  const detail = input.type + " " + amount.toString() + " " + primary.currency;

  await db.transaction.update({
    where: { id },
    data: {
      finAccountId: primary.id,
      counterAccountId: input.type === "TRANSFER" ? counter?.id : null,
      categoryId: input.type === "TRANSFER" ? null : input.categoryId || null,
      projectId,
      date: input.date,
      amount: amount.toString(),
      currency: primary.currency,
      fxRate: fxRate.toString(),
      baseAmount: baseAmount.toString(),
      type: input.type,
      status: newStatus,
      memo: input.memo || null,
    },
  });

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "TRANSACTION",
    entityId: id,
    summary: "Updated transaction (" + detail + ")",
  });
  if (newStatus === "PENDING" && existing.status !== "PENDING") {
    notifyApprovers({
      organizationId: workspace.id,
      slug,
      actorId: user.id,
      actorName: user.name || user.email || "A member",
      detail: detail,
      txType: input.type,
      memo: input.memo || undefined,
    }).catch(console.error);
  }
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/dashboard");
  return {};
}

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
    db.finAccount.findMany({ where: { organizationId: workspace.id, archivedAt: null }, select: { id: true, name: true, currency: true } }),
    db.category.findMany({ where: { organizationId: workspace.id }, select: { id: true, name: true, kind: true } }),
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
      errors.push("Row " + rowNum + ": missing required field (date, type, account, amount).");
      continue;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) { errors.push("Row " + rowNum + ": invalid date."); continue; }

    const txnType = type.trim().toUpperCase();
    if (!["INCOME", "EXPENSE", "TRANSFER"].includes(txnType)) {
      errors.push("Row " + rowNum + ": type must be INCOME, EXPENSE, or TRANSFER.");
      continue;
    }

    let primary = acctByName.get(account.toLowerCase());
    if (!primary) {
      primary = await db.finAccount.create({
        data: {
          organizationId: workspace.id,
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
      errors.push("Row " + rowNum + ": amount must be a positive number.");
      continue;
    }

    let counterId: string | null = null;
    if (txnType === "TRANSFER") {
      if (!counter_account) { errors.push("Row " + rowNum + ": TRANSFER requires counter_account."); continue; }
      let counter = acctByName.get(counter_account.toLowerCase());
      if (!counter) {
        counter = await db.finAccount.create({
          data: {
            organizationId: workspace.id,
            name: counter_account,
            type: "BANK",
            currency: workspace.baseCurrency,
          },
          select: { id: true, name: true, currency: true },
        });
        acctByName.set(counter_account.toLowerCase(), counter);
      }
      if (counter.id === primary.id) { errors.push("Row " + rowNum + ": source and destination must differ."); continue; }
      counterId = counter.id;
    }

    let categoryId: string | null = null;
    if (category && txnType !== "TRANSFER") {
      let cat = catByName.get(category.toLowerCase());
      if (!cat) {
        cat = await db.category.create({
          data: {
            organizationId: workspace.id,
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
      errors.push("Row " + rowNum + ": FX rate unavailable.");
      continue;
    }

    const amountD = new Decimal(parsedAmount);
    await db.transaction.create({
      data: {
        organizationId: workspace.id,
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
    revalidatePath("/finance/transactions");
    revalidatePath("/finance/dashboard");
  }

  return { imported, errors };
}

export async function approveTransaction(slug: string, id: string) {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can approve transactions." };
  }
  const txn = await db.transaction.findFirst({
    where: { id, organizationId: workspace.id },
  });
  if (!txn) return { error: "Transaction not found." };
  if (txn.status !== "PENDING") return { error: "Transaction is not pending approval." };

  await db.transaction.update({
    where: { id },
    data: { status: "POSTED", approvedById: user.id, approvedAt: new Date() },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "APPROVE",
    entityType: "TRANSACTION",
    entityId: id,
    summary: "Approved " + txn.type + " " + txn.amount.toString() + " " + txn.currency,
  });
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/dashboard");
  return {};
}

export async function rejectTransaction(slug: string, id: string) {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can reject transactions." };
  }
  const txn = await db.transaction.findFirst({
    where: { id, organizationId: workspace.id },
  });
  if (!txn) return { error: "Transaction not found." };
  if (txn.status !== "PENDING") return { error: "Transaction is not pending approval." };

  await db.transaction.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date() },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "REJECT",
    entityType: "TRANSACTION",
    entityId: id,
    summary: "Rejected " + txn.type + " " + txn.amount.toString() + " " + txn.currency,
  });
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/dashboard");
  return {};
}
