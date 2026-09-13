import { USING_DB, db } from "@/lib/store";
import { isSponsorId } from "@/lib/sponsor/memo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!USING_DB || !isSponsorId(id)) return new Response("not found", { status: 404 });
  const p = await db();
  const rows = await p.$queryRaw<{ logo: string }[]>`select logo from sponsors where id = ${id}`;
  const m = rows[0]?.logo.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "content-type": m[1],
      // URLs carry ?v=<hash>, so a changed logo is a new URL.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
