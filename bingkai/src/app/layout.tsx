import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./globals.css";

// Vendored rather than pulled from next/font/google. That helper fetches at BUILD
// time, so a machine that cannot reach fonts.googleapis.com fails the build outright
// - which is exactly what happened here. Both families ship as a single
// variable-weight file, so the seven subset files Google emits collapse to two.
// See src/fonts/LICENSE-fonts.txt (SIL OFL 1.1).
const manrope = localFont({
  src: "../fonts/manrope-variable.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-manrope",
  display: "swap",
});
const mono = localFont({
  src: "../fonts/jetbrains-mono-variable.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bingkai.metricbase.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  // "twibbon gratis tanpa watermark" is what people actually type; lead with it.
  title: {
    default: "Bingkai — buat twibbon gratis, tanpa watermark & tanpa unggah foto",
    template: "%s · Bingkai",
  },
  description:
    "Bikin dan pakai twibbon kampanye tanpa akun, tanpa watermark, tanpa iklan. Fotomu diproses di perangkatmu sendiri dan tidak pernah dikirim ke server.",
  applicationName: "Bingkai",
  keywords: [
    "twibbon",
    "twibbon gratis",
    "twibbon tanpa watermark",
    "buat twibbon",
    "bingkai foto kampanye",
    "frame foto online",
  ],
  alternates: { canonical: "/" },
  // Icons and the share image come from the file conventions in this folder
  // (icon.svg, favicon.ico, apple-icon.png, opengraph-image.png, twitter-image.png).
  openGraph: { siteName: "Bingkai", type: "website", locale: "id_ID", url: "/" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${manrope.variable} ${mono.variable}`}>
      <body>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-3" aria-label="Bingkai, beranda">
              <Logo />
              <span className="hidden font-mono text-[10px] uppercase tracking-widest text-gray-3 sm:inline">
                metricbase
              </span>
            </Link>
            <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-wider">
              <Link href="/#kenapa" className="text-gray-2 hover:text-gold">
                Kenapa
              </Link>
              <Link
                href="/buat"
                className="border border-line-strong bg-tint-gold-soft px-3 py-1.5 text-gold hover:bg-tint-gold-hover"
              >
                Buat kampanye
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>

        <footer className="mt-16 border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 font-mono text-[11px] uppercase tracking-wider text-gray-3 sm:flex-row sm:justify-between">
            <span>Bingkai · bagian dari MetricBase</span>
            <span className="flex gap-4">
              <a href="https://metricbase.org/privacy">Privasi</a>
              <a href="https://metricbase.org/terms">Ketentuan</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
