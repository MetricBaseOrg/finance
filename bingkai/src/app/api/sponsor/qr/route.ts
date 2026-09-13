import { NextResponse } from "next/server";
import { TIP_MEMO, sponsorMemo } from "@/lib/sponsor/constants";
import { isSponsorId } from "@/lib/sponsor/memo";
import { qrSvg, solanaPayUrl } from "@/lib/sponsor/pay";

/** Solana Pay QR for a sponsor bid (?id=bsp_…&amount=N) or a tip (?tip=1&amount=N).
    The memo is built here, never taken from the query, so a QR can't be crafted to
    credit something else. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const amount = Math.max(0, Math.min(100000, Number(u.searchParams.get("amount") ?? 0) || 0));
  const id = u.searchParams.get("id") ?? "";
  let memo: string;
  let label: string;
  if (u.searchParams.get("tip")) {
    memo = TIP_MEMO;
    label = "Dukungan untuk Bingkai";
  } else if (isSponsorId(id)) {
    memo = sponsorMemo(id);
    label = "Sponsor Bingkai";
  } else {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const link = solanaPayUrl({ amount: amount || undefined, memo, label, message: "Terima kasih sudah mendukung Bingkai" });
  const svg = await qrSvg(link);
  if (u.searchParams.get("format") === "json") return NextResponse.json({ link, memo, svg });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}
