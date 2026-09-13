import { NextResponse } from "next/server";
import { maybeScan } from "@/lib/sponsor/scan";

/** Vercel Cron backstop (and manual trigger). The payment page also scans while polling. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const force = Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
  const result = await maybeScan(force);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
