import { NextRequest, NextResponse } from "next/server";
import { createCampaign, type FieldSpec } from "@/lib/store";
import { slugify } from "@/lib/compose";

/** Hard cap so a pasted 20 MB PNG fails fast with a clear message. */
const MAX_FRAME_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const frameData = String(body.frameData ?? "");
  if (!title) return NextResponse.json({ error: "Judul wajib diisi." }, { status: 400 });
  if (!frameData.startsWith("data:image/png")) {
    return NextResponse.json(
      { error: "Bingkai harus PNG transparan." },
      { status: 400 },
    );
  }
  // base64 is 4 chars per 3 bytes; estimate before we hand it to the DB.
  const approx = Math.floor((frameData.length - frameData.indexOf(",") - 1) * 0.75);
  if (approx > MAX_FRAME_BYTES) {
    return NextResponse.json(
      { error: "Bingkai terlalu besar. Maksimal 5 MB." },
      { status: 413 },
    );
  }

  const wanted = slugify(String(body.slug ?? "") || title);
  // Collisions are likely on a popular title, so append a short discriminator
  // rather than rejecting and making the organiser invent a new name.
  const slug = `${wanted || "kampanye"}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const c = await createCampaign({
      slug,
      title: title.slice(0, 120),
      organiser: (String(body.organiser ?? "").trim() || null)?.slice(0, 80) ?? null,
      blurb: (String(body.blurb ?? "").trim() || null)?.slice(0, 280) ?? null,
      frameData,
      frameW: Number(body.frameW) || 1080,
      frameH: Number(body.frameH) || 1080,
      background: String(body.background ?? "#0a0a0a"),
      fields: Array.isArray(body.fields) ? (body.fields as FieldSpec[]).slice(0, 6) : [],
    });
    return NextResponse.json({
      slug: c.slug,
      manageKey: c.manageKey,
      url: `/k/${c.slug}`,
      manageUrl: `/kelola/${c.manageKey}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
