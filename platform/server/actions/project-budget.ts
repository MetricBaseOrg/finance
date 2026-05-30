"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { logAudit } from "@/server/audit";

export type BudgetActionState = { error?: string; ok?: boolean };

/** Set (or clear) a project's finance budget, in the org base currency. */
export async function setProjectBudget(
  slug: string,
  projectId: string,
  _prev: BudgetActionState | undefined,
  formData: FormData,
): Promise<BudgetActionState> {
  const { user, workspace } = await requireMembership(slug);

  const raw = String(formData.get("budget") ?? "").trim();
  let budget: number | null = null;
  if (raw !== "") {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return { error: "Budget must be a non-negative number." };
    budget = n;
  }

  const res = await db.project.updateMany({
    where: { id: projectId, organizationId: workspace.id },
    data: { budget },
  });
  if (res.count === 0) return { error: "Project not found." };

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "PROJECT_BUDGET",
    entityId: projectId,
    summary: budget === null ? "Cleared project budget" : `Set project budget to ${budget}`,
  });

  revalidatePath(`/finance/${slug}/projects`);
  revalidatePath(`/finance/${slug}/projects/${projectId}`);
  return { ok: true };
}
