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
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can manage accounts." };
  }
  const parsed = finAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    openingBalance: formData.get("openingBalance") ?? 0,
    projectId: formData.get("projectId") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // PROJECT accounts must name a project that belongs to this workspace.
  let projectId: string | null = null;
  if (parsed.data.type === "PROJECT") {
    if (!parsed.data.projectId) return { error: "Pick a project for a PROJECT account." };
    const proj = await db.project.findFirst({
      where: { id: parsed.data.projectId, organizationId: workspace.id },
      select: { id: true },
    });
    if (!proj) return { error: "Selected project not found in this workspace." };
    projectId = proj.id;
  }
  const account = await db.finAccount.create({
    data: {
      organizationId: workspace.id,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      openingBalance: parsed.data.openingBalance,
      projectId,
    },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "CREATE",
    entityType: "ACCOUNT",
    entityId: account.id,
    summary: `Created account "${account.name}"`,
  });
  revalidatePath(`/finance/accounts`);
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
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Only owners and admins can manage accounts." };
  }
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") || undefined,
    type: formData.get("type") || undefined,
    currency: formData.get("currency") || undefined,
    openingBalance:
      formData.get("openingBalance") !== null
        ? formData.get("openingBalance")
        : undefined,
    projectId: formData.get("projectId") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, ...rest } = parsed.data;
  // Keep the project link consistent with the type.
  if (rest.type !== undefined) {
    if (rest.type === "PROJECT") {
      if (!rest.projectId) return { error: "Pick a project for a PROJECT account." };
      const proj = await db.project.findFirst({
        where: { id: rest.projectId, organizationId: workspace.id },
        select: { id: true },
      });
      if (!proj) return { error: "Selected project not found in this workspace." };
    } else {
      rest.projectId = null;
    }
  }
  await db.finAccount.updateMany({
    where: { id, organizationId: workspace.id },
    data: rest,
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "ACCOUNT",
    entityId: id,
    summary: `Updated account ${rest.name ?? ""}`.trim(),
  });
  revalidatePath(`/finance/accounts`);
  return {};
}

export async function archiveAccount(slug: string, id: string) {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") return;
  await db.finAccount.updateMany({
    where: { id, organizationId: workspace.id },
    data: { archivedAt: new Date() },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "ARCHIVE",
    entityType: "ACCOUNT",
    entityId: id,
    summary: "Archived account",
  });
  revalidatePath(`/finance/accounts`);
}

export async function unarchiveAccount(slug: string, id: string) {
  const { user, workspace, membership } = await requireMembership(slug);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") return;
  await db.finAccount.updateMany({
    where: { id, organizationId: workspace.id },
    data: { archivedAt: null },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "UNARCHIVE",
    entityType: "ACCOUNT",
    entityId: id,
    summary: "Unarchived account",
  });
  revalidatePath(`/finance/accounts`);
}
