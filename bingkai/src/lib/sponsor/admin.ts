import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "bingkai_admin";

export function keyMatches(candidate: string | undefined | null): boolean {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 16 || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  return keyMatches((await cookies()).get(ADMIN_COOKIE)?.value);
}
