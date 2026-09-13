import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Buat twibbon gratis",
  description:
    "Buat kampanye twibbon gratis dalam satu menit: unggah bingkai PNG transparan, dapat tautan untuk dibagikan. Tanpa daftar, tanpa watermark.",
  alternates: { canonical: "/buat" },
};

export default function BuatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
