import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GridBg } from "@/components/mb/GridBg";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MetricBase Financial Tracker",
  description:
    "Multi-entity financial tracking for individuals and companies. Built for the operator who reads their own books.",
  metadataBase: new URL("https://apps.metricbase.org"),
  icons: {
    icon: "https://metricbase.org/assets/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="mb-page h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('mb-theme');
                if (stored === 'light') document.documentElement.setAttribute('data-theme', 'light');
              } catch (e) {}
            `,
          }}
        />
        <GridBg />
        <div className="relative z-10 flex-1 flex flex-col min-h-0">{children}</div>
      </body>
    </html>
  );
}
