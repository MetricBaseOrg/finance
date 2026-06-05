"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { finAccountSchema } from "@/lib/schemas";

export type AccountActionState = { error?: string };

export async function createAccount(
  slug: string,
  _prev: AccountActionState | undefined,
  formData: FormData,
): Promise<AccountActionState> {
  const { user, workspace } = await requireMembership(slug);
  const parsed = finAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    openingBalance: formData.get("openingBalance") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const account = await db.finAccount.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      openingBalance: parsed.data.openingBalance,
    },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "CREATE",
    entityType: "ACCOUNT",
    entityId: account.id,
    summary: `Created account "${account.name}"`,
  });
  revalidatePath(`/app/${slug}/accounts`);
  return {};
}

const updateSchema = finAccountSchema.partial().extend({
  id: z.string().min(1),
});

export async function updateAccount(
  slug: string,
  _prev: AccountActionState | undefined,
  formData: FormData,
): Promise<AccountActionState> {
  const { user, workspace } = await requireMembership(slug);
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") || undefined,
    type: formData.get("type") || undefined,
    currency: formData.get("currency") || undefined,
    openingBalance:
      formData.get("openingBalance") !== null
        ? formData.get("openingBalance")
        : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, ...rest } = parsed.data;
  await db.finAccount.updateMany({
    where: { id, workspaceId: workspace.id },
    data: rest,
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "ACCOUNT",
    entityId: id,
    summary: `Updated account ${rest.name ?? ""}`.trim(),
  });
  revalidatePath(`/app/${slug}/accounts`);
  return {};
}

export async function archiveAccount(slug: string, id: string) {
  const { user, workspace } = await requireMembership(slug);
  await db.finAccount.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { archivedAt: new Date() },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "ARCHIVE",
    entityType: "ACCOUNT",
    entityId: id,
    summary: "Archived account",
  });
  revalidatePath(`/app/${slug}/accounts`);
}

export async function unarchiveAccount(slug: string, id: string) {
  const { user, workspace } = await requireMembership(slug);
  await db.finAccount.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { archivedAt: null },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "UNARCHIVE",
    entityType: "ACCOUNT",
    entityId: id,
    summary: "Unarchived account",
  });
  revalidatePath(`/app/${slug}/accounts`);
}
