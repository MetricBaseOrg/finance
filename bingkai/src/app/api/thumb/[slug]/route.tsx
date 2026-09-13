import { ImageResponse } from "next/og";
import { getCampaign } from "@/lib/store";

/**
 * Directory card thumbnail: the frame over a neutral fill, 360 px wide. (The
 * organiser's background colour is often a loud "photo goes here" green, which reads
 * as noise in a grid of cards.) Frames
 * are up to 3 MB, so the landing page must never load them at full size. The URL
 * carries ?v=<updatedAt>, so a new frame is a new URL and this can be cached forever.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCampaign(slug);
  if (!c || !c.listed) return new Response("not found", { status: 404 });

  const width = 360;
  const height = Math.max(120, Math.min(640, Math.round((width * c.frameH) / c.frameW)));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1c1c1c" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={c.frameData} width={width} height={height} style={{ objectFit: "contain" }} />
      </div>
    ),
    {
      width,
      height,
      headers: { "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" },
    },
  );
}
