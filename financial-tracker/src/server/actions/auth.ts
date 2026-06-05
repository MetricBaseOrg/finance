"use server";

import { signIn, signOut } from "@/server/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/app" });
}

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) return;
  await signIn("resend", { email, redirectTo: "/app" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
