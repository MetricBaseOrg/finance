"use server";

import { revalidatePath } from "next/cache";
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
