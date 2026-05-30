"use server";

import { signIn } from "@/server/auth";

export async function inviteSignInWithEmail(token: string, formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) return;
  await signIn("resend", { email, redirectTo: `/invite/${token}` });
}

export async function inviteSignInWithGoogle(token: string) {
  await signIn("google", { redirectTo: `/invite/${token}` });
}
