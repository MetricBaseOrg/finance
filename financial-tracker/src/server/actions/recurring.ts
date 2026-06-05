"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { getFxRate } from "@/server/fx/provider";

const recurringRuleSchema = z.object({
  finAccountId: z.string().cuid(),
  counterAccountId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  memo: z.string().max(500).optional(),
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.coerce.number().int().positive().default(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export type RecurringState = { error?: string; success?: boolean };

export async function postDueRulesAction(slug: string, _formData: FormData): Promise<void> {
  await postDueRules(slug, undefined, _formData);
}

export async function postDueRules(
  slug: string,
  _prev: RecurringState | undefined,
  _formData: FormData,
): Promise<RecurringState> {
  const { workspace } = await requireMembership(slug);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueRules = await db.recurringRule.findMany({
    where: {
      workspaceId: workspace.id,
      nextRunDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
    include: {
      finAccount: true,
    },
  });

  if (dueRules.length === 0) {
    return { success: true };
  }

  try {
    for (const rule of dueRules) {
      await db.$transaction(async (tx) => {
        let currentDate = new Date(rule.nextRunDate);
        const daysToAdd = getIntervalDays(rule.freq, rule.interval);

        while (currentDate <= today && (!rule.endDate || currentDate <= rule.endDate)) {
          const fxRate = await getFxRate(
            rule.currency,
            workspace.baseCurrency,
            currentDate,
          );

          const amount = new Decimal(rule.amount);
          const baseAmount = amount.times(fxRate);

          await tx.transaction.create({
            data: {
              workspaceId: workspace.id,
              finAccountId: rule.finAccountId,
              counterAccountId: rule.counterAccountId || null,
              categoryId: rule.categoryId || null,
              date: currentDate,
              amount,
              currency: rule.currency,
              fxRate,
              baseAmount,
              type: rule.type,
              memo: rule.memo || null,
            },
          });

          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + daysToAdd);
        }

        await tx.recurringRule.update({
          where: { id: rule.id },
          data: { nextRunDate: currentDate, lastPostedAt: today },
        });
      });
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to post recurring rules.",
    };
  }

  revalidatePath(`/app/${slug}/recurring`);
  revalidatePath(`/app/${slug}/transactions`);
  revalidatePath(`/app/${slug}/dashboard`);
  return { success: true };
}

export async function createRecurringRule(
  slug: string,
  _prev: RecurringState | undefined,
  formData: FormData,
): Promise<RecurringState> {
  const { workspace } = await requireMembership(slug);

  const parsed = recurringRuleSchema.safeParse({
    finAccountId: formData.get("finAccountId"),
    counterAccountId: formData.get("counterAccountId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    type: formData.get("type"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    memo: formData.get("memo") || undefined,
    freq: formData.get("freq"),
    interval: formData.get("interval"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const finAccount = await db.finAccount.findFirst({
    where: { id: parsed.data.finAccountId, workspaceId: workspace.id },
  });
  if (!finAccount) {
    return { error: "Account not found" };
  }

  try {
    await db.recurringRule.create({
      data: {
        workspaceId: workspace.id,
        finAccountId: parsed.data.finAccountId,
        counterAccountId: parsed.data.counterAccountId,
        categoryId: parsed.data.categoryId,
        type: parsed.data.type,
        amount: new Decimal(parsed.data.amount),
        currency: parsed.data.currency,
        memo: parsed.data.memo,
        freq: parsed.data.freq,
        interval: parsed.data.interval,
        startDate: parsed.data.startDate,
        nextRunDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      },
    });

    revalidatePath(`/app/${slug}/recurring`);
    return { success: true };
  } catch (error) {
    return { error: "Failed to create recurring rule" };
  }
}

export async function updateRecurringRule(
  slug: string,
  ruleId: string,
  _prev: RecurringState | undefined,
  formData: FormData,
): Promise<RecurringState> {
  const { workspace } = await requireMembership(slug);

  const rule = await db.recurringRule.findFirst({
    where: { id: ruleId, workspaceId: workspace.id },
  });
  if (!rule) {
    return { error: "Rule not found" };
  }

  const parsed = recurringRuleSchema.safeParse({
    finAccountId: formData.get("finAccountId"),
    counterAccountId: formData.get("counterAccountId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    type: formData.get("type"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    memo: formData.get("memo") || undefined,
    freq: formData.get("freq"),
    interval: formData.get("interval"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await db.recurringRule.update({
      where: { id: ruleId },
      data: {
        finAccountId: parsed.data.finAccountId,
        counterAccountId: parsed.data.counterAccountId,
        categoryId: parsed.data.categoryId,
        type: parsed.data.type,
        amount: new Decimal(parsed.data.amount),
        currency: parsed.data.currency,
        memo: parsed.data.memo,
        freq: parsed.data.freq,
        interval: parsed.data.interval,
        endDate: parsed.data.endDate,
      },
    });

    revalidatePath(`/app/${slug}/recurring`);
    return { success: true };
  } catch (error) {
    return { error: "Failed to update recurring rule" };
  }
}

export async function deleteRecurringRule(
  slug: string,
  ruleId: string,
): Promise<RecurringState> {
  const { workspace } = await requireMembership(slug);

  const rule = await db.recurringRule.findFirst({
    where: { id: ruleId, workspaceId: workspace.id },
  });
  if (!rule) {
    return { error: "Rule not found" };
  }

  try {
    await db.recurringRule.delete({ where: { id: ruleId } });
    revalidatePath(`/app/${slug}/recurring`);
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete recurring rule" };
  }
}

function getIntervalDays(freq: string, interval: number): number {
  switch (freq) {
    case "DAILY":
      return interval;
    case "WEEKLY":
      return interval * 7;
    case "MONTHLY":
      return interval * 30;
    case "YEARLY":
      return interval * 365;
    default:
      return interval;
  }
}
