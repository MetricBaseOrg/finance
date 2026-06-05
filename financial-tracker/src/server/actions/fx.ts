"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireMembership } from "@/server/workspace";
import { logAudit } from "@/server/audit";

const overrideSchema = z.object({
  base: z.enum(["IDR", "USD"]),
  quote: z.enum(["IDR", "USD"]),
  date: z.coerce.date(),
  rate: z.coerce.number().positive(),
});

export type FxActionState = { error?: string };

export async function upsertFxOverride(
  slug: string,
  _prev: FxActionState | undefined,
  formData: FormData,
): Promise<FxActionState> {
  const { user, workspace } = await requireMembership(slug); // gated; FX is workspace-agnostic but require auth
  const parsed = overrideSchema.safeParse({
    base: formData.get("base"),
    quote: formData.get("quote"),
    date: formData.get("date"),
    rate: formData.get("rate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.base === parsed.data.quote) {
    return { error: "Base and quote must differ." };
  }
  const dayStart = new Date(
    Date.UTC(
      parsed.data.date.getUTCFullYear(),
      parsed.data.date.getUTCMonth(),
      parsed.data.date.getUTCDate(),
    ),
  );
  await db.fxRate.upsert({
    where: {
      base_quote_date: {
        base: parsed.data.base,
        quote: parsed.data.quote,
        date: dayStart,
      },
    },
    create: {
      base: parsed.data.base,
      quote: parsed.data.quote,
      date: dayStart,
      rate: parsed.data.rate.toString(),
      source: "manual",
    },
    update: {
      rate: parsed.data.rate.toString(),
      source: "manual",
    },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "UPDATE",
    entityType: "FX_RATE",
    entityId: `${parsed.data.base}_${parsed.data.quote}`,
    summary: `Set FX override ${parsed.data.base}→${parsed.data.quote} = ${parsed.data.rate}`,
  });
  revalidatePath(`/app/${slug}/settings/fx`);
  return {};
}

export async function deleteFxOverride(slug: string, id: string) {
  const { user, workspace } = await requireMembership(slug);
  await db.fxRate.deleteMany({ where: { id } });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "DELETE",
    entityType: "FX_RATE",
    entityId: id,
    summary: "Deleted FX override",
  });
  revalidatePath(`/app/${slug}/settings/fx`);
}
