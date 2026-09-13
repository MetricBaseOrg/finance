import { NextRequest, NextResponse } from "next/server";
import { rotateManageKey } from "@/lib/store";

/** Issue a new manage link and invalidate the old one, for when a link was shared by mistake. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    const next = await rotateManageKey(key);
    if (!next) return NextResponse.json({ error: "Tautan kelola tidak dikenal." }, { status: 404 });
    return NextResponse.json({ manageUrl: `/kelola/${next}` });
  } catch {
    return NextResponse.json({ error: "Gagal membuat tautan baru. Coba lagi." }, { status: 500 });
  }
}
