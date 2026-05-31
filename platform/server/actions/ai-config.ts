"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { encryptToken } from "@/lib/crypto";

export type AiConfigState = { error?: string; ok?: boolean };

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

// Save per-workspace AI provider config. Admin/owner only. The API key is
// encrypted at rest and only written when a new value is supplied (blank keeps
// the existing key); "clearKey" removes it. base URL / model are non-secret.
export async function saveAiConfig(
  slug: string,
  _prev: AiConfigState | undefined,
  formData: FormData,
): Promise<AiConfigState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);

  const baseUrl = clean(formData.get("baseUrl"));
  const model = clean(formData.get("model"));
  const apiKey = clean(formData.get("apiKey"));
  const clearKey = clean(formData.get("clearKey")) === "on";

  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return { error: "Base URL must start with http:// or https://" };
  }

  const data: { aiBaseUrl: string | null; aiModel: string | null; aiApiKeyEnc?: string | null } = {
    aiBaseUrl: baseUrl || null,
    aiModel: model || null,
  };
  if (clearKey) data.aiApiKeyEnc = null;
  else if (apiKey) data.aiApiKeyEnc = encryptToken(apiKey);

  await db.organization.update({ where: { id: workspace.id }, data });

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "ai.config.update",
    entityType: "organization",
    entityId: workspace.id,
    summary: `Updated workspace AI provider config${
      clearKey ? " (key cleared)" : apiKey ? " (key set)" : ""
    }`,
  });

  revalidatePath("/settings/agents");
  return { ok: true };
}
