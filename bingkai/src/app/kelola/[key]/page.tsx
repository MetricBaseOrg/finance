import { notFound } from "next/navigation";
import Link from "next/link";
import { getByManageKey, tallies } from "@/lib/store";
import { PRESETS } from "@/lib/compose";
import { computeStats, type Bar } from "@/lib/stats";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kelola kampanye", robots: { index: false } };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bingkai.metricbase.org";

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
const fmtDayLong = (ymd: string) =>
  new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const num = (n: number) => n.toLocaleString("id-ID");
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const hh = (h: number) => `${String(h).padStart(2, "0")}.00`;

/** Counters are bucketed by the hour, so "last activity" can only be said to the hour. */
function relative(iso: string, now: number) {
  const start = new Date(iso).getTime();
  if (now - start < 3600 * 1000) return "dalam 1 jam terakhir";
  const hours = Math.floor((now - start) / (3600 * 1000));
  if (hours < 24) return `sekitar ${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

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

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-mono text-[11px] uppercase tracking-wider text-gray-2">{children}</h2>
);

function RankList({
  items,
  empty,
  note,
}: {
  items: [string, number][];
  empty: string;
  note?: string;
}) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  const total = items.reduce((a, [, n]) => a + n, 0);
  return (
    <>
      {items.length === 0 ? (
        <p className="text-xs text-gray-3">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map(([name, n]) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] text-gray-1">{name}</span>
                <span className="font-mono text-[11px] text-gray-2">
                  {num(n)} <span className="text-gray-3">· {pct(n, total)}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-bg-card">
                <div className="h-1.5 rounded-r-sm bg-gold/70" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-[11px] leading-relaxed text-gray-3">{note}</p>}
    </>
  );
}

/** Single-series column chart. Server-rendered; hover (or tap) a column for its value. */
function Columns({ bars, every, height = 140 }: { bars: Bar[]; every: number; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {bars.map((b) => (
          <div key={b.key} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
            <div
              className={`w-full rounded-t-[3px] ${b.value > 0 ? "bg-gold/75 group-hover:bg-gold group-focus:bg-gold" : "bg-line"}`}
              style={{ height: b.value > 0 ? `${Math.max(3, (b.value / max) * 100)}%` : 1 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap border border-line bg-bg-elev px-2 py-1 text-[11px] text-gray-1 shadow group-hover:block group-focus:block">
              <span className="font-semibold text-white">{num(b.value)}</span> foto · {b.tip}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-line pt-1">
        {bars.map((b, i) => (
          <span key={b.key} className="flex-1 text-center font-mono text-[9px] text-gray-3">
            {i % every === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
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
  const now = Date.now();
  const s = computeStats(rows, c.createdAt, now);

  const group = (pred: (k: string) => boolean, key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) if (pred(r.kind)) m.set(key(r), (m.get(key(r)) ?? 0) + r.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sources = group((k) => k === "VIEW", (r) => sourceName(r.refHost)).slice(0, 8);
  const presets = group((k) => k === "DOWNLOAD" || k === "SHARE", (r) => presetName(r.preset));

  const campaignUrl = `${SITE}/k/${c.slug}`;
  const runningDays = Math.max(1, Math.ceil((now - new Date(c.createdAt).getTime()) / 86400000));
  const perDay = s.outputs / runningDays;

  const delta = s.today - s.yesterday;
  const todaySub =
    s.yesterday === 0
      ? s.today > 0
        ? "Kemarin belum ada"
        : "Belum ada hari ini"
      : `${delta >= 0 ? "▲" : "▼"} ${num(Math.abs(delta))} dibanding kemarin (${num(s.yesterday)})`;

  const stats: { label: string; n: number; sub: string }[] = [
    {
      label: "Kunjungan",
      n: s.views,
      sub: s.partialViews ? `Dihitung sejak ${fmtDateTime(s.viewStart!)}` : "Halaman kampanye dibuka",
    },
    {
      label: "Pilih foto",
      n: s.picked,
      sub:
        s.funnel.views > 0
          ? `${pct(s.funnel.picked, s.funnel.views)}% pengunjung memilih foto`
          : "Pengunjung yang memilih foto",
    },
    { label: "Diunduh", n: s.downloads, sub: "Disimpan sebagai file" },
    { label: "Dibagikan", n: s.shares, sub: "Lewat tombol Bagikan di HP" },
  ];

  // Funnel widths are relative to visits in the same window; outputs can exceed picks
  // because one person may save several sizes, so the bar is capped and the ratio said.
  const f = s.funnel;
  const funnelSteps =
    f.views > 0
      ? [
          { label: "Membuka halaman", n: f.views, note: "100%" },
          { label: "Memilih foto", n: f.picked, note: `${pct(f.picked, f.views)}% dari pengunjung` },
          {
            label: "Menyimpan / membagikan",
            n: f.outputs,
            note:
              f.picked > 0 && f.outputs > f.picked
                ? `rata-rata ${(f.outputs / f.picked).toLocaleString("id-ID", { maximumFractionDigits: 1 })}× per foto dipilih`
                : `${pct(f.outputs, f.picked)}% dari yang memilih foto`,
          },
        ]
      : [];
  const pickedButNotSaved = Math.max(0, f.picked - f.outputs);

  // Plain-language pointers the organiser can act on.
  const tips: string[] = [];
  if (s.peakHour !== null)
    tips.push(
      `Pendukung paling aktif sekitar pukul ${hh(s.peakHour)}–${hh((s.peakHour + 1) % 24)} WIB. Kirim pengingat ke grup sedikit sebelum jam itu.`,
    );
  if (s.lastOutput && now - new Date(s.lastOutput).getTime() > 24 * 3600 * 1000 && !c.closedAt)
    tips.push("Tidak ada foto baru dalam 24 jam terakhir. Bagikan ulang tautannya supaya kampanye tetap ramai.");
  if (f.views >= 10 && pct(f.picked, f.views) < 40)
    tips.push(
      "Banyak yang membuka halaman tapi tidak memilih foto. Coba tambahkan ajakan singkat di pesan, misalnya “klik, pilih foto, selesai dalam 10 detik”.",
    );
  if (pickedButNotSaved >= 5)
    tips.push(
      `${num(pickedButNotSaved)} orang memilih foto tapi belum menyimpannya. Ingatkan untuk menekan tombol Unduh atau Bagikan.`,
    );
  const storyShare = presets.find(([n]) => n.startsWith("Story"))?.[1] ?? 0;
  if (s.outputs >= 20 && storyShare / s.outputs < 0.1)
    tips.push("Hampir semua memakai ukuran Feed. Kalau ingin ramai di WA Status/IG Story, sebutkan ukuran Story di pesanmu.");

  const chartEvery = s.activity.unit === "jam" ? 3 : s.activity.bars.length > 14 ? 3 : 1;
  const peakBar = s.activity.bars.reduce<Bar | null>((a, b) => (!a || b.value > a.value ? b : a), null);

  return (
    <div className="space-y-12">
      {/* ---- header ---- */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Kelola kampanye</p>
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              c.closedAt ? "border-line text-gray-2" : "border-line-strong text-gold"
            }`}
          >
            {c.closedAt ? `● Ditutup ${fmtDate(c.closedAt)}` : "● Aktif"}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{c.title}</h1>
        <p className="text-[12px] text-gray-3">
          Dibuat {fmtDate(c.createdAt)} · berjalan {num(runningDays)} hari
          {s.lastAny && <> · aktivitas terakhir {relative(s.lastAny, now)}</>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/k/${c.slug}`} className="break-all font-mono text-[12px] text-gold hover:text-gold-bright">
            {campaignUrl.replace(/^https?:\/\//, "")}
          </Link>
          <CopyButton text={campaignUrl} />
        </div>
      </header>

      {/* ---- headline ---- */}
      <section className="space-y-3">
        <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-black p-5 sm:col-span-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">Foto jadi</p>
            <p className="mt-1 text-5xl font-extrabold text-white">{num(s.outputs)}</p>
            <p className="mt-1 text-[11px] text-gold-dim">Diunduh + dibagikan, sejak awal</p>
          </div>
          <div className="bg-black p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">Hari ini</p>
            <p className="mt-1 text-3xl font-extrabold text-white">{num(s.today)}</p>
            <p className="mt-1 text-[11px] text-gold-dim">{todaySub}</p>
          </div>
          {/* On day one a per-day average just repeats "Hari ini", so show the pace
              while the campaign is being shared instead. */}
          <div className="bg-black p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
              {runningDays > 1 ? "Rata-rata per hari" : "Rata-rata per jam aktif"}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-white">
              {(runningDays > 1 ? perDay : s.activeHours > 0 ? s.outputs / s.activeHours : 0).toLocaleString(
                "id-ID",
                { maximumFractionDigits: 1 },
              )}
            </p>
            <p className="mt-1 text-[11px] text-gold-dim">
              {s.outputs === 0
                ? "Belum ada foto"
                : runningDays > 1
                  ? `Aktif di ${num(s.activeDays)} dari ${num(runningDays)} hari`
                  : `Ada foto baru di ${num(s.activeHours)} jam berbeda`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
          {stats.map((st) => (
            <div key={st.label} className="bg-black p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">{st.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{num(st.n)}</p>
              <p className="mt-1 text-[11px] text-gold-dim">{st.sub}</p>
            </div>
          ))}
        </div>
        {s.partialViews && (
          <p className="text-[11px] leading-relaxed text-gray-3">
            Catatan: kunjungan dan pilih foto baru tercatat sejak {fmtDateTime(s.viewStart!)}, sedangkan
            unduhan dan bagikan sudah tercatat sejak kampanye dibuat. Persentase di halaman ini hanya
            memakai data sejak tanggal tersebut.
          </p>
        )}
      </section>

      {/* ---- activity ---- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <H2>Foto jadi per {s.activity.unit}</H2>
          <p className="text-[11px] text-gray-3">
            {s.activity.unit === "jam" ? `${s.activity.bars.length} jam terakhir, jam WIB` : `${s.activity.bars.length} hari terakhir, tanggal`}
            {peakBar && peakBar.value > 0 && <> · puncak {num(peakBar.value)} foto ({peakBar.tip})</>}
          </p>
        </div>
        {s.outputs === 0 ? (
          <p className="text-xs text-gray-3">Belum ada foto yang disimpan atau dibagikan.</p>
        ) : (
          <Columns bars={s.activity.bars} every={chartEvery} />
        )}
        <details className="text-[12px] text-gray-2">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-gray-3 hover:text-gold">
            Lihat sebagai tabel
          </summary>
          <div className="mt-2 max-h-64 overflow-auto border border-line">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-bg-elev text-[11px] text-gray-3">
                <tr>
                  <th className="px-3 py-1.5 font-normal">Waktu</th>
                  <th className="px-3 py-1.5 text-right font-normal">Foto jadi</th>
                </tr>
              </thead>
              <tbody>
                {[...s.activity.bars].reverse().filter((b) => b.value > 0).map((b) => (
                  <tr key={b.key} className="border-t border-line">
                    <td className="px-3 py-1.5">{b.tip}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{num(b.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* ---- when & funnel ---- */}
      <section className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <H2>Jam paling ramai (WIB)</H2>
          {s.peakHour === null ? (
            <p className="text-xs text-gray-3">Belum ada data.</p>
          ) : (
            <>
              <p className="text-[13px] text-gray-1">
                Paling ramai pukul <span className="font-semibold text-gold">{hh(s.peakHour)}–{hh((s.peakHour + 1) % 24)}</span>
                {s.bestDay && (
                  <>
                    {" "}· hari terbaik <span className="font-semibold text-gold">{fmtDayLong(s.bestDay[0])}</span> (
                    {num(s.bestDay[1])} foto)
                  </>
                )}
              </p>
              <Columns
                height={80}
                every={6}
                bars={s.byHour.map((v, h) => ({
                  key: String(h),
                  label: String(h).padStart(2, "0"),
                  value: v,
                  tip: `pukul ${hh(h)}–${hh((h + 1) % 24)} WIB, semua hari`,
                }))}
              />
            </>
          )}
        </div>

        <div className="space-y-4">
          <H2>Dari kunjungan sampai foto jadi</H2>
          {funnelSteps.length === 0 ? (
            <p className="text-xs text-gray-3">Belum ada kunjungan tercatat.</p>
          ) : (
            <ul className="space-y-3">
              {funnelSteps.map((st) => (
                <li key={st.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-gray-1">{st.label}</span>
                    <span className="font-mono text-[12px] text-white">{num(st.n)}</span>
                  </div>
                  <p className="text-[11px] text-gray-3">{st.note}</p>
                  <div className="mt-1 h-2.5 bg-bg-card">
                    <div
                      className="h-2.5 rounded-r-sm bg-gold/70"
                      style={{ width: `${Math.min(100, pct(st.n, f.views))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {s.outputs > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-[12px] text-gray-2">Cara menyimpan</p>
              <div className="flex h-2.5 gap-[2px]">
                {s.downloads > 0 && <div className="h-full bg-gold/80" style={{ width: `${pct(s.downloads, s.outputs)}%` }} />}
                {s.shares > 0 && <div className="h-full bg-gray-2/60" style={{ width: `${pct(s.shares, s.outputs)}%` }} />}
              </div>
              <div className="flex justify-between text-[11px] text-gray-2">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 bg-gold/80" />
                  Diunduh {num(s.downloads)} · {pct(s.downloads, s.outputs)}%
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 bg-gray-2/60" />
                  Dibagikan {num(s.shares)} · {pct(s.shares, s.outputs)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---- where & what ---- */}
      <section className="grid gap-10 sm:grid-cols-2">
        <div className="space-y-3">
          <H2>Asal kunjungan</H2>
          <RankList
            items={sources}
            empty="Belum ada kunjungan tercatat."
            note="“Langsung / aplikasi chat” berarti tautan dibuka tanpa info asal — biasanya dari WhatsApp, Telegram, atau diketik langsung."
          />
        </div>
        <div className="space-y-3">
          <H2>Ukuran yang dipilih</H2>
          <RankList items={presets} empty="Belum ada foto jadi." note="Termasuk unduhan dan bagikan." />
        </div>
      </section>

      {/* ---- tips ---- */}
      {tips.length > 0 && (
        <section className="space-y-3 border border-line-strong bg-tint-gold-soft p-5">
          <H2>Saran untuk kampanye ini</H2>
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-gray-1">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <H2>Apa yang tidak kami simpan</H2>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-gray-3">
          Tidak ada alamat IP, cookie, sidik jari perangkat, atau identitas pendukung dalam bentuk apa
          pun. Angka di halaman ini adalah penghitung yang dibulatkan ke jam, jadi dua pendukung pada jam
          yang sama tidak bisa dibedakan, dan jumlah orang unik tidak bisa dihitung. Foto pendukung tidak
          pernah sampai ke server kami, jadi tidak ada yang bisa kami serahkan kepada siapa pun — termasuk
          kepada kamu.
        </p>
      </section>
    </div>
  );
}
