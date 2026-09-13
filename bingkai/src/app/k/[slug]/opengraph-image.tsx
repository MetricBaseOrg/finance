import { ImageResponse } from "next/og";
import { getCampaign } from "@/lib/store";

/**
 * The preview a campaign link shows in WhatsApp, X, and Facebook: the organiser's own
 * frame and title, not Bingkai's launch card. Supporters decide whether to tap from
 * this image, so it should look like the thing they are about to use.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pratinjau bingkai kampanye";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCampaign(slug);

  const title = c?.title ?? "Bingkai";
  const organiser = c?.organiser ?? "Kampanye";
  const box = 520;
  const ratio = c ? c.frameW / c.frameH : 1;
  const fw = ratio >= 1 ? box : Math.round(box * ratio);
  const fh = ratio >= 1 ? Math.round(box / ratio) : box;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#0a0a0a",
          padding: "0 64px",
          gap: 56,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#c9a84c",
            }}
          >
            {organiser.slice(0, 40)}
          </div>
          <div
            style={{
              fontSize: title.length > 40 ? 50 : 62,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
            }}
          >
            {title.slice(0, 90)}
          </div>
          <div style={{ fontSize: 26, color: "#999999", marginTop: 8 }}>
            Pasang fotomu di bingkai ini — gratis, tanpa watermark.
          </div>
          <div style={{ fontSize: 22, color: "#c9a84c", marginTop: 24 }}>
            bingkai.metricbase.org
          </div>
        </div>
        {c && (
          <div
            style={{
              display: "flex",
              width: fw,
              height: fh,
              background: c.background,
              border: "2px solid rgba(201,168,76,0.4)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={c.frameData} width={fw} height={fh} />
          </div>
        )}
      </div>
    ),
    size,
  );
}
