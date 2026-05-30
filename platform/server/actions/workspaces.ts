"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireMembership, requireUser, slugify } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import {
  DEFAULT_COMPANY_CATEGORIES,
  DEFAULT_INDIVIDUAL_CATEGORIES,
  SUPPORTED_CURRENCIES,
} from "@/lib/constants";

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(60),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
});

export type CreateWorkspaceState = { error?: string };

export async function createWorkspace(
  _prev: CreateWorkspaceState | undefined,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const user = await requireUser();
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    baseCurrency: formData.get("baseCurrency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, type, baseCurrency } = parsed.data;

  // Generate a unique slug
  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let i = 1; i < 50; i++) {
    const existing = await db.organization.findUnique({ where: { slug } });
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
  }

  const defaults =
    type === "COMPANY"
      ? DEFAULT_COMPANY_CATEGORIES
      : DEFAULT_INDIVIDUAL_CATEGORIES;

  const workspace = await db.organization.create({
    data: {
      name,
      slug,
      type,
      baseCurrency,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
      categories: {
        create: [
          ...defaults.income.map((n) => ({ name: n, kind: "INCOME" as const })),
          ...defaults.expense.map((n) => ({ name: n, kind: "EXPENSE" as const })),
        ],
      },
    },
  });

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "CREATE",
    entityType: "WORKSPACE",
    entityId: workspace.id,
    summary: `Created workspace "${workspace.name}"`,
  });
  revalidatePath("/finance");
  redirect('/finance')
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(60),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
});

export type UpdateWorkspaceState = { error?: string; success?: boolean };

export async function updateWorkspace(
  slug: string,
  _prev: UpdateWorkspaceState | undefined,
  formData: FormData,
): Promise<UpdateWorkspaceState> {
  const { user, workspace } = await requireMembership(slug);
  const parsed = updateWorkspaceSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    baseCurrency: formData.get("baseCurrency") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Disallow changing base currency once transactions exist
  if (
    parsed.data.baseCurrency &&
    parsed.data.baseCurrency !== workspace.baseCurrency
  ) {
    const txnCount = await db.transaction.count({
      where: { organizationId: workspace.id },
    });
    if (txnCount > 0) {
      return {
        error:
          "Base currency cannot be changed once transactions exist (would invalidate FX snapshots).",
      };
    }
  }

  await db.organization.update({
    where: { id: workspace.id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      ...(parsed.data.baseCurrency
        ? { baseCurrency: parsed.data.baseCurrency }
        : {}),
    },
  });
  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "WORKSPACE",
    entityId: workspace.id,
    summary: `Updated workspace settings`,
  });
  revalidatePath(`/finance`);
  revalidatePath(`/finance/settings/workspace`);
  return { success: true };
}
