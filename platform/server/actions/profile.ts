"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { requireUser } from "@/server/workspace";
import { profileUpdateSchema } from "@/lib/schemas";
import { normalizeAvatarUrl } from "@/lib/avatar";

export type ProfileActionState = { error?: string; ok?: boolean; name?: string; image?: string | null };

/** Update the signed-in user's own profile. */
export async function updateProfile(
  _prev: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const parsed = profileUpdateSchema.safeParse({
    name: formData.get("name"),
    title: formData.get("title") ?? "",
    bio: formData.get("bio") ?? "",
    image: formData.get("image") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const image = normalizeAvatarUrl(parsed.data.image);
  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      title: parsed.data.title,
      bio: parsed.data.bio,
      image,
    },
  });

  revalidatePath("/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true, name: parsed.data.name, image };
}

/** Persist the signed-in user's notification preferences (Settings → Preferences). */
export async function updateNotificationPrefs(opts: {
  emailNotifications: boolean;
  dailyDigest: boolean;
}): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: {
      emailNotifications: !!opts.emailNotifications,
      dailyDigest: !!opts.dailyDigest,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export type ChangePasswordState = { error?: string; ok?: boolean };

/** Set or change the signed-in user's password. */
export async function changePassword(
  _prev: ChangePasswordState | undefined,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();

  const current = (formData.get("current") as string | null) ?? "";
  const next = (formData.get("next") as string | null) ?? "";
  const confirm = (formData.get("confirm") as string | null) ?? "";

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "Passwords do not match." };

  const row = await db.user.findUnique({ where: { id: user.id }, select: { password: true } });

  // If they already have a password, verify the current one before allowing change.
  if (row?.password) {
    if (!current) return { error: "Current password is required." };
    const ok = await bcrypt.compare(current, row.password);
    if (!ok) return { error: "Current password is incorrect." };
  }

  const hashed = await bcrypt.hash(next, 12);
  await db.user.update({ where: { id: user.id }, data: { password: hashed } });

  return { ok: true };
}
