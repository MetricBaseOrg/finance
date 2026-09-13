import { NextRequest, NextResponse } from "next/server";
import { createCampaign } from "@/lib/store";
import { slugify } from "@/lib/compose";
import {
  LIMITS,
  cleanColor,
  cleanDimension,
  cleanFields,
  cleanText,
  frameError,
} from "@/lib/validate";

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
  const bad = frameError(frameData);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const wanted = slugify(String(body.slug ?? "") || title);
  // Collisions are likely on a popular title, so append a short discriminator
  // rather than rejecting and making the organiser invent a new name.
  const slug = `${wanted || "kampanye"}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const c = await createCampaign({
      slug,
      title: title.slice(0, LIMITS.title),
      organiser: cleanText(body.organiser, LIMITS.organiser),
      blurb: cleanText(body.blurb, LIMITS.blurb),
      frameData,
      frameW: cleanDimension(body.frameW),
      frameH: cleanDimension(body.frameH),
      background: cleanColor(body.background, "#0a0a0a"),
      fields: cleanFields(body.fields),
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
