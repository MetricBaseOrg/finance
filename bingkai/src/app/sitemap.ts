import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bingkai.metricbase.org";

// Only the public product pages. Campaign pages are shared by their organisers and get
// discovered through those links; listing every campaign here would publish test and
// private campaigns nobody asked to have indexed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/buat`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/sponsor`, changeFrequency: "weekly", priority: 0.5 },
  ];
}
