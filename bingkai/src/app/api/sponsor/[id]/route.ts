import { NextResponse } from "next/server";
import { getSponsorStatus } from "@/lib/sponsor/board";
import { isSponsorId } from "@/lib/sponsor/memo";
import { maybeScan } from "@/lib/sponsor/scan";

/** Polled by the payment page until the bid lands. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSponsorId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  await maybeScan().catch(() => undefined);
  const status = await getSponsorStatus(id);
  if (!status) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}
