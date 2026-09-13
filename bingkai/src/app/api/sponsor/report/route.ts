import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { USING_DB, db } from "@/lib/store";
import { REPORT_HIDE_THRESHOLD } from "@/lib/sponsor/constants";
import { isSponsorId } from "@/lib/sponsor/memo";

/**
 * A visitor reports an ad. Reporters are counted by a salted hash of their IP (the IP
 * itself is never stored). After REPORT_HIDE_THRESHOLD distinct reporters the ad is
 * hidden until the admin reviews it.
 */
export async function POST(req: Request) {
  let body: { id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!USING_DB || !isSponsorId(id)) return NextResponse.json({ error: "Iklan tidak dikenal." }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const reporter = createHash("sha256").update(`${process.env.ADMIN_KEY ?? ""}:${ip}`).digest("hex").slice(0, 24);
  const reason = String(body.reason ?? "").slice(0, 200) || null;

  const p = await db();
  const exists = await p.$queryRaw<unknown[]>`select 1 from sponsors where id = ${id}`;
  if (!exists.length) return NextResponse.json({ error: "Iklan tidak dikenal." }, { status: 404 });
  await p.$executeRaw`insert into sponsor_reports (sponsor_id, reporter, reason) values (${id}, ${reporter}, ${reason})
    on conflict (sponsor_id, reporter) do nothing`;
  await p.$executeRaw`update sponsors set hidden = true, hidden_reason = 'reports'
    where id = ${id} and not hidden
    and (select count(*) from sponsor_reports where sponsor_id = ${id}) >= ${REPORT_HIDE_THRESHOLD}`;
  return NextResponse.json({ ok: true });
}
