import { NextRequest } from "next/server";
import { getFxRate } from "@/server/fx/provider";

export const dynamic = "force-dynamic";

const PAIRS: { base: string; quote: string }[] = [
  { base: "USD", quote: "IDR" },
  { base: "IDR", quote: "USD" },
];

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  // Vercel Cron uses `Authorization: Bearer <CRON_SECRET>`
  const header = req.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  // Allow ?secret=... fallback for manual triggers
  return new URL(req.url).searchParams.get("secret") === expected;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const today = new Date();
  const results: { pair: string; rate: string }[] = [];
  for (const { base, quote } of PAIRS) {
    try {
      const rate = await getFxRate(base, quote, today);
      results.push({ pair: `${base}->${quote}`, rate: rate.toString() });
    } catch (e) {
      results.push({
        pair: `${base}->${quote}`,
        rate: `error: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }
  }
  return Response.json({ ok: true, date: today.toISOString().slice(0, 10), results });
}
