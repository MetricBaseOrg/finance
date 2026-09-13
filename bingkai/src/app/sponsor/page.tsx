import type { Metadata } from "next";
import { Suspense } from "react";
import { getBoard, priceToEnter } from "@/lib/sponsor/board";
import SponsorFlow from "./SponsorFlow";

export const metadata: Metadata = {
  title: "Pasang iklan di Bingkai — 5 slot sponsor, lelang USDC",
  description:
    "Tampilkan merekmu di beranda Bingkai dan di setiap halaman kampanye twibbon. Lima slot sponsor lewat lelang terbuka USDC di Solana, mulai $5.",
  alternates: { canonical: "/sponsor" },
  openGraph: {
    title: "Sponsor Bingkai — 5 slot iklan, lelang terbuka",
    description: "Logo, satu kalimat, dan tautan di beranda dan setiap halaman kampanye Bingkai. Mulai $5.",
    url: "/sponsor",
  },
};
export const revalidate = 30;

export default async function SponsorPage() {
  const board = await getBoard().catch(() => []);
  return (
    <Suspense>
      <SponsorFlow
        priceToEnter={priceToEnter(board)}
        board={board.map((s) => ({ rank: s.rank, id: s.id, name: s.name, totalUsd: s.totalUsd }))}
      />
    </Suspense>
  );
}
