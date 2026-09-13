import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCampaign } from "@/lib/store";
import FrameEditor from "@/components/FrameEditor";
import { SponsorStrip } from "@/components/SponsorSlots";
import { getBoardCached } from "@/lib/sponsor/board";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCampaign(slug);
  if (!c) return { title: "Kampanye tidak ditemukan", robots: { index: false } };
  const title = `Twibbon ${c.title}`;
  const description =
    c.blurb ??
    `Pasang twibbon ${c.title} di fotomu. Gratis, tanpa unggah, tanpa watermark, tanpa akun.`;
  return {
    title,
    description,
    alternates: { canonical: `/k/${c.slug}` },
    openGraph: { title, description, url: `/k/${c.slug}`, type: "website", locale: "id_ID" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [c, board] = await Promise.all([getCampaign(slug), getBoardCached()]);
  if (!c) notFound();

  // manageKey is stripped here rather than in the component, so the secret is never
  // part of the payload React serialises into the page.
  const { manageKey, ...safe } = c;
  void manageKey;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="eyebrow">{c.organiser ?? "Kampanye"}</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {c.title}
        </h1>
        {c.blurb && <p className="max-w-2xl text-sm text-gray-2">{c.blurb}</p>}
        {c.closedAt && (
          <p className="border border-line-strong bg-tint-gold-soft px-3 py-2 text-xs text-gold">
            Kampanye ini sudah ditutup, tapi kamu masih bisa memakai bingkainya.
          </p>
        )}
      </header>

      <FrameEditor campaign={safe} />

      <SponsorStrip board={board} />
    </div>
  );
}
