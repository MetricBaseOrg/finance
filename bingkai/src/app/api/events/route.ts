import { NextRequest, NextResponse } from "next/server";
import { getCampaign, recordEvent, refHostOf, type EventKind } from "@/lib/store";

const KINDS: EventKind[] = ["VIEW", "PHOTO_PICKED", "DOWNLOAD", "SHARE"];

/**
 * Counters only. No cookie is set, no IP is stored, no identifier of any kind is
 * derived from the request. The referrer is reduced to a bare host before it is
 * written. An analytics endpoint that quietly fingerprinted supporters would
 * contradict the only promise this product makes.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const kind = String(body.kind ?? "") as EventKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ ok: false }, { status: 400 });
  const c = await getCampaign(String(body.slug ?? ""));
  if (!c) return NextResponse.json({ ok: false }, { status: 404 });
  await recordEvent(
    c.id,
    kind,
    refHostOf(req.headers.get("referer")),
    body.preset ? String(body.preset).slice(0, 24) : null,
  );
  return NextResponse.json({ ok: true });
}
