import { notFound } from "next/navigation";
import Link from "next/link";
import { getByManageKey, tallies, type EventKind } from "@/lib/store";
import { PRESETS } from "@/lib/compose";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kelola kampanye", robots: { index: false } };

// Organisers are Indonesian and the server runs in UTC; render every time in WIB.
const TZ = "Asia/Jakarta";
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const fmtDateTime = (d: string | Date) =>
  `${new Date(d).toLocaleString("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
const num = (n: number) => n.toLocaleString("id-ID");

/** Bare hosts are meaningless to an organiser; name the app they know. */
function sourceName(host: string | null): string {
  if (!host || /(^|\.)metricbase\.org$/.test(host)) return "Langsung / aplikasi chat";
  const known: [RegExp, string][] = [
    [/whatsapp|wa\.me/, "WhatsApp"],
    [/instagram/, "Instagram"],
    [/facebook|fb\.com|fb\.me/, "Facebook"],
    [/tiktok/, "TikTok"],
    [/^t\.co$|twitter|x\.com/, "X (Twitter)"],
    [/t\.me|telegram/, "Telegram"],
    [/line\.me/, "LINE"],
    [/linkedin|lnkd\.in/, "LinkedIn"],
    [/google\./, "Google"],
    [/youtube/, "YouTube"],
  ];
  return known.find(([re]) => re.test(host))?.[1] ?? host;
}

function presetName(id: string | null): string {
  if (id === "all") return "Semua ukuran (ZIP)";
  const p = PRESETS.find((x) => x.id === id);
  return p ? `${p.label} · ${p.w}×${p.h}` : "Lainnya";
}

export default async function KelolaPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const c = await getByManageKey(key);
  if (!c) notFound();
  const rows = await tallies(c.id);

  const total = (k: EventKind, since?: string) =>
    rows
      .filter((r) => r.kind === k && (!since || r.hour >= since))
      .reduce((a, r) => a + r.count, 0);

  const views = total("VIEW");
  const picked = total("PHOTO_PICKED");
  const downloads = total("DOWNLOAD");
  const shares = total("SHARE");

  // Visits and photo picks were not recorded for every campaign from the start, while
  // downloads were. Comparing across different windows gave "650% dari kunjungan", so
  // rates only use hours since visits began being counted, and the gap is spelled out.
  const firstHour = (k?: EventKind) =>
    rows.filter((r) => !k || r.kind === k).map((r) => r.hour).sort()[0];
  const viewStart = firstHour("VIEW");
  const partialViews = !!viewStart && firstHour()! < viewStart;
  const pickRate =
    viewStart && total("VIEW", viewStart) > 0
      ? Math.round((total("PHOTO_PICKED", viewStart) / total("VIEW", viewStart)) * 100)
      : null;

  const group = (k: EventKind, key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.kind === k) m.set(key(r), (m.get(key(r)) ?? 0) + r.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sources = group("VIEW", (r) => sourceName(r.refHost)).slice(0, 8);
  const presets = group("DOWNLOAD", (r) => presetName(r.preset));

  const stats: { label: string; n: number; sub: string }[] = [
    {
      label: "Kunjungan",
      n: views,
      sub: partialViews ? `Dihitung sejak ${fmtDateTime(viewStart!)}` : "Halaman kampanye dibuka",
    },
    {
      label: "Pilih foto",
      n: picked,
      sub: pickRate !== null ? `${pickRate}% pengunjung memilih foto` : "Pengunjung yang memilih foto",
    },
    { label: "Unduhan", n: downloads, sub: "Satu orang bisa mengunduh lebih dari sekali" },
    { label: "Dibagikan", n: shares, sub: "Lewat tombol Bagikan di HP" },
  ];

  const List = ({
    title,
    items,
    empty,
    note,
  }: {
    title: string;
    items: [string, number][];
    empty: string;
    note?: string;
  }) => {
    const max = Math.max(1, ...items.map(([, n]) => n));
    return (
      <div className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-gray-2">{title}</h2>
        {items.length === 0 ? (
          <p className="text-xs text-gray-3">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map(([name, n]) => (
              <li key={name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-gray-1">{name}</span>
                  <span className="font-mono text-[11px] text-gold">{num(n)}</span>
                </div>
                <div className="mt-1 h-1 bg-bg-card">
                  <div className="h-1 bg-gold/60" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {note && <p className="text-[11px] leading-relaxed text-gray-3">{note}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="eyebrow">Kelola kampanye</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{c.title}</h1>
        <p className="text-[12px] text-gray-3">
          Dibuat {fmtDate(c.createdAt)} · Tautan untuk pendukung:{" "}
          <Link href={`/k/${c.slug}`} className="font-mono text-gold hover:text-gold-bright">
            bingkai.metricbase.org/k/{c.slug}
          </Link>
        </p>
      </header>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-black p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold text-white">{num(s.n)}</p>
              <p className="mt-1 text-[11px] text-gold-dim">{s.sub}</p>
            </div>
          ))}
        </div>
        {partialViews && (
          <p className="text-[11px] leading-relaxed text-gray-3">
            Catatan: kunjungan dan pilih foto baru tercatat sejak {fmtDateTime(viewStart!)},
            sedangkan unduhan dan bagikan sudah tercatat sejak kampanye dibuat. Karena itu
            jumlah unduhan bisa lebih besar dari jumlah kunjungan.
          </p>
        )}
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <List
          title="Asal kunjungan"
          items={sources}
          empty="Belum ada kunjungan tercatat."
          note="“Langsung / aplikasi chat” berarti tautan dibuka tanpa info asal — biasanya dari WhatsApp, Telegram, atau diketik langsung."
        />
        <List title="Ukuran yang diunduh" items={presets} empty="Belum ada unduhan." />
      </section>

      <section className="border-t border-line pt-6">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
          Apa yang tidak kami simpan
        </h2>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-gray-3">
          Tidak ada alamat IP, cookie, sidik jari perangkat, atau identitas pendukung
          dalam bentuk apa pun. Angka di halaman ini adalah penghitung yang dibulatkan
          ke jam, jadi dua pendukung pada jam yang sama tidak bisa dibedakan. Foto
          pendukung tidak pernah sampai ke server kami, jadi tidak ada yang bisa kami
          serahkan kepada siapa pun — termasuk kepada kamu.
        </p>
      </section>
    </div>
  );
}
