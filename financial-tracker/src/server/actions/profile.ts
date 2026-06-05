"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/workspace";

const profileSchema = z.object({
  name: z.string().max(60).optional().nullable(),
  image: z
    .union([
      z.string().url("Must be a valid URL").max(2048),
      z.literal(""),
    ])
    .optional(),
});

export type ProfileState = { error?: string; success?: boolean };

export async function updateProfile(
  _prev: ProfileState | undefined,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    image: formData.get("image"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name?.trim() || null,
      image: parsed.data.image === "" ? null : parsed.data.image || undefined,
    },
  });
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { success: true };
}
