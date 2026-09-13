import { NextRequest, NextResponse } from "next/server";
import { deleteByManageKey, updateByManageKey, type CampaignPatch } from "@/lib/store";
import {
  LIMITS,
  cleanCategory,
  cleanColor,
  cleanDimension,
  cleanFields,
  cleanText,
  frameError,
} from "@/lib/validate";

type Ctx = { params: Promise<{ key: string }> };

/**
 * Organiser edits. The manage key in the path is the only credential, exactly as for
 * the manage page itself. Only keys present in the body are changed.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { key } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const patch: CampaignPatch = {};
  if ("title" in body) {
    const title = cleanText(body.title, LIMITS.title);
    if (!title) return NextResponse.json({ error: "Judul wajib diisi." }, { status: 400 });
    patch.title = title;
  }
  if ("organiser" in body) patch.organiser = cleanText(body.organiser, LIMITS.organiser);
  if ("blurb" in body) patch.blurb = cleanText(body.blurb, LIMITS.blurb);
  if ("background" in body) patch.background = cleanColor(body.background, "#0a0a0a");
  if ("fields" in body) patch.fields = cleanFields(body.fields);
  if ("frameData" in body) {
    const frameData = String(body.frameData ?? "");
    const bad = frameError(frameData);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    patch.frameData = frameData;
    patch.frameW = cleanDimension(body.frameW);
    patch.frameH = cleanDimension(body.frameH);
  }
  if ("closed" in body) patch.closed = Boolean(body.closed);
  if ("listed" in body) patch.listed = Boolean(body.listed);
  if ("category" in body) patch.category = cleanCategory(body.category);

  try {
    const c = await updateByManageKey(key, patch);
    if (!c) return NextResponse.json({ error: "Tautan kelola tidak dikenal." }, { status: 404 });
    return NextResponse.json({ ok: true, closedAt: c.closedAt, listed: c.listed });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan. Coba lagi." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { key } = await params;
  try {
    const ok = await deleteByManageKey(key);
    if (!ok) return NextResponse.json({ error: "Tautan kelola tidak dikenal." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus. Coba lagi." }, { status: 500 });
  }
}
