"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { categorySchema } from "@/lib/schemas";

export type CategoryActionState = { error?: string };

export async function createCategory(
  slug: string,
  _prev: CategoryActionState | undefined,
  formData: FormData,
): Promise<CategoryActionState> {
  const { user, workspace } = await requireMembership(slug);
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    monthlyBudget: formData.get("monthlyBudget") ?? "",
    color: formData.get("color") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const category = await db.category.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      monthlyBudget: parsed.data.monthlyBudget ?? undefined,
      color: parsed.data.color ?? undefined,
    },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "CREATE",
    entityType: "CATEGORY",
    entityId: category.id,
    summary: `Created ${parsed.data.kind.toLowerCase()} category "${category.name}"`,
  });
  revalidatePath(`/app/${slug}/budgets`);
  revalidatePath(`/app/${slug}/settings/categories`);
  return {};
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60).optional(),
  monthlyBudget: z
    .union([z.literal(""), z.coerce.number().nonnegative()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  color: z.string().max(20).nullable().optional(),
});

export async function updateCategory(slug: string, formData: FormData) {
  const { user, workspace } = await requireMembership(slug);
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? undefined,
    monthlyBudget:
      formData.get("monthlyBudget") !== null
        ? formData.get("monthlyBudget")
        : undefined,
    color: formData.get("color") ?? undefined,
  });
  if (!parsed.success) return;
  const { id, monthlyBudget, ...rest } = parsed.data;
  await db.category.updateMany({
    where: { id, workspaceId: workspace.id },
    data: {
      ...rest,
      ...(monthlyBudget !== undefined ? { monthlyBudget } : {}),
    },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "CATEGORY",
    entityId: id,
    summary: "Updated category",
  });
  revalidatePath(`/app/${slug}/budgets`);
  revalidatePath(`/app/${slug}/settings/categories`);
}

export async function deleteCategory(slug: string, id: string) {
  const { user, workspace } = await requireMembership(slug);
  // Prevent delete if used; otherwise hard delete
  const usage = await db.transaction.count({
    where: { workspaceId: workspace.id, categoryId: id },
  });
  if (usage > 0) {
    // Soft-fallback: leave it in DB but no UI yet for archive.
    return;
  }
  await db.category.deleteMany({
    where: { id, workspaceId: workspace.id },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "DELETE",
    entityType: "CATEGORY",
    entityId: id,
    summary: "Deleted category",
  });
  revalidatePath(`/app/${slug}/budgets`);
  revalidatePath(`/app/${slug}/settings/categories`);
}
