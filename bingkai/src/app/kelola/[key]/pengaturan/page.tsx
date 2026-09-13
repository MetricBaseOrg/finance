import { notFound } from "next/navigation";
import { getByManageKey } from "@/lib/store";
import CampaignSettings from "@/components/CampaignSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan kampanye", robots: { index: false } };

export default async function PengaturanPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ baru?: string }>;
}) {
  const { key } = await params;
  const { baru } = await searchParams;
  const c = await getByManageKey(key);
  if (!c) notFound();
  return (
    <CampaignSettings
      key={key}
      manageKey={key}
      justRotated={baru === "1"}
      campaign={{
        slug: c.slug,
        title: c.title,
        organiser: c.organiser,
        blurb: c.blurb,
        background: c.background,
        fields: c.fields,
        frameData: c.frameData,
        frameW: c.frameW,
        frameH: c.frameH,
        closedAt: c.closedAt,
      }}
    />
  );
}
