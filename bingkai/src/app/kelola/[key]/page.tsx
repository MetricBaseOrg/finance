import { notFound } from "next/navigation";
import Link from "next/link";
import { getByManageKey, tallies, type EventKind } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kelola kampanye", robots: { index: false } };

const LABEL: Record<EventKind, string> = {
  VIEW: "Kunjungan",
  PHOTO_PICKED: "Pilih foto",
  DOWNLOAD: "Unduhan",
  SHARE: "Dibagikan",
};

export default async function KelolaPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const c = await getByManageKey(key);
  if (!c) notFound();
  const rows = await tallies(c.id);

  const total = (k: EventKind) =>
    rows.filter((r) => r.kind === k).reduce((a, r) => a + r.count, 0);

  const views = total("VIEW");
  const picked = total("PHOTO_PICKED");
  const downloads = total("DOWNLOAD");

  // Sources, so an organiser can tell WhatsApp from Instagram. Bare hosts only.
  const bySource = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== "VIEW") continue;
    const k = r.refHost ?? "langsung";
    bySource.set(k, (bySource.get(k) ?? 0) + r.count);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Downloads per export size tells the organiser what their supporters actually
  // post to, which is the one piece of insight that changes how they design the next
  // frame. Nothing here identifies a person.
  const byPreset = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== "DOWNLOAD") continue;
    const k = r.preset ?? "—";
    byPreset.set(k, (byPreset.get(k) ?? 0) + r.count);
  }
  const presets = [...byPreset.entries()].sort((a, b) => b[1] - a[1]);

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="eyebrow">Kelola</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{c.title}</h1>
        <p className="font-mono text-[11px] text-gray-3">
          Dibuat {new Date(c.createdAt).toLocaleDateString("id-ID")} ·{" "}
          <Link href={`/k/${c.slug}`} className="text-gold hover:text-gold-bright">
            /k/{c.slug}
          </Link>
        </p>
      </header>

      <section className="grid gap-px border border-line bg-line sm:grid-cols-3">
        {[
          ["Kunjungan", views, null],
          ["Pilih foto", picked, pct(picked, views)],
          ["Unduhan", downloads, pct(downloads, views)],
        ].map(([label, n, p]) => (
          <div key={String(label)} className="bg-black p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
              {String(label)}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-white">{Number(n)}</p>
            {p !== null && (
              <p className="mt-1 font-mono text-[11px] text-gold-dim">
                {Number(p)}% dari kunjungan
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
            Asal kunjungan
          </h2>
          {sources.length === 0 ? (
            <p className="text-xs text-gray-3">Belum ada data.</p>
          ) : (
            <ul className="space-y-1.5">
              {sources.map(([host, n]) => (
                <li key={host} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-gray-1">{host}</span>
                  <span className="font-mono text-[11px] text-gold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
            Ukuran yang diunduh
          </h2>
          {presets.length === 0 ? (
            <p className="text-xs text-gray-3">Belum ada data.</p>
          ) : (
            <ul className="space-y-1.5">
              {presets.map(([p, n]) => (
                <li key={p} className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-gray-1">{p}</span>
                  <span className="font-mono text-[11px] text-gold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
