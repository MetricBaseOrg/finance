import { NextRequest, NextResponse } from "next/server";
import { getCampaign } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const c = await getCampaign(slug);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  // manageKey must never leave the server on a public read.
  const { manageKey, ...safe } = c;
  void manageKey;
  return NextResponse.json(safe);
}
