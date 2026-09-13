import Link from "next/link";
import CampaignDirectory from "@/components/CampaignDirectory";
import { SponsorBoard } from "@/components/SponsorSlots";
import { listDirectory, type DirectoryEntry } from "@/lib/store";
import { CATEGORIES } from "@/lib/validate";
import { getBoard, priceToEnter, type Slot } from "@/lib/sponsor/board";
import { TIP_MEMO, WALLET } from "@/lib/sponsor/constants";
import { qrSvg, solanaPayUrl } from "@/lib/sponsor/pay";

// Directory and sponsor board refresh every minute; the page itself stays static.
export const revalidate = 60;

/**
 * The landing page has one job: name the reason to switch in the first screen.
 *
 * The reason is not "we have more features". It is that the incumbent uploads your
 * face to composite it, and we do not need to. Everything else on this page is
 * downstream of that one fact.
 */

const WHY = [
  {
    k: "01",
    h: "Fotomu tidak diunggah",
    p: "Bingkai dipasang di browser kamu, bukan di server kami. Foto tidak pernah meninggalkan perangkat. Buka tab Network di browser dan buktikan sendiri.",
  },
  {
    k: "02",
    h: "Tanpa watermark, selamanya",
    p: "Hasilnya bersih. Tidak ada logo kami di foto kamu, tidak ada tulisan kecil di sudut, tidak ada versi berbayar untuk menghilangkannya.",
  },
  {
    k: "03",
    h: "Tanpa akun, dua-duanya",
    p: "Pendukung tinggal buka tautan. Pembuat kampanye juga tidak perlu daftar — kampanye dimiliki oleh siapa pun yang menyimpan tautan kelola.",
  },
  {
    k: "04",
    h: "Nama pendukung bisa masuk ke bingkai",
    p: "Pembuat kampanye menaruh kolom teks di bingkai. Pendukung mengisi nama, kelas, atau unit, dan namanya ikut tercetak. Ini yang tidak bisa dilakukan bingkai gambar biasa.",
  },
  {
    k: "05",
    h: "Semua ukuran sekali unduh",
    p: "Feed, Story, WhatsApp, LinkedIn, dan versi cetak 300 dpi. Pilih satu, atau ambil semuanya sebagai ZIP.",
  },
  {
    k: "06",
    h: "Statistik yang tidak mengintai",
    p: "Pembuat kampanye melihat jumlah kunjungan dan unduhan per jam serta asal tautannya. Kami tidak menyimpan IP, cookie, atau apa pun yang menunjuk ke satu orang.",
  },
];

const VS = [
  ["Foto diproses di perangkat sendiri", true, false],
  ["Tanpa watermark di hasil", true, false],
  ["Buat kampanye tanpa akun", true, false],
  ["Kolom nama di dalam bingkai", true, false],
  ["Ekspor Story, feed, dan cetak", true, false],
  ["Tetap jalan walau sinyal hilang setelah halaman terbuka", true, false],
] as const;

const FAQ = [
  {
    q: "Apa itu twibbon?",
    a: "Twibbon adalah bingkai foto untuk kampanye, acara, atau perayaan — misalnya wisuda, HUT perusahaan, atau kegiatan komunitas. Pendukung memasang fotonya di dalam bingkai lalu membagikannya di media sosial.",
  },
  {
    q: "Apakah Bingkai benar-benar gratis dan tanpa watermark?",
    a: "Ya. Membuat kampanye, memakai bingkai, dan mengunduh hasil semuanya gratis. Tidak ada watermark dan tidak ada versi berbayar untuk menghilangkannya. Biaya server ditanggung sponsor yang tampil di beranda dan di bawah editor, tidak pernah di dalam fotomu.",
  },
  {
    q: "Apakah foto saya diunggah ke server?",
    a: "Tidak. Foto dibaca dan digabungkan dengan bingkai langsung di browser perangkatmu. Yang dikirim dari server hanya gambar bingkainya. Kamu bisa membuktikannya lewat tab Network di browser.",
  },
  {
    q: "Bagaimana cara membuat twibbon sendiri?",
    a: "Siapkan desain bingkai sebagai PNG dengan bagian tengah transparan (maksimal 3 MB), buka halaman Buat kampanye, isi judul, unggah PNG-nya, lalu bagikan tautan yang kamu dapat. Tidak perlu mendaftar.",
  },
  {
    q: "Ukuran bingkai yang disarankan berapa?",
    a: "1080×1080 piksel untuk feed Instagram dan Facebook. Pendukung tetap bisa mengunduh versi Story, Portrait, Wide, Profile, dan cetak dari bingkai yang sama.",
  },
  {
    q: "Bagaimana kampanye saya muncul di direktori?",
    a: "Kampanye yang masih aktif otomatis tampil di direktori beranda agar lebih mudah ditemukan. Kalau kampanyemu hanya untuk kalangan sendiri, hilangkan centang saat membuatnya atau sembunyikan kapan saja dari halaman kelola. Tautannya tetap bekerja seperti biasa.",
  },
  {
    q: "Bagaimana cara memasang iklan di Bingkai?",
    a: "Ada lima slot sponsor yang diperebutkan lewat lelang terbuka. Isi nama merek, satu kalimat, logo, dan tautan di halaman Sponsor, lalu kirim USDC di jaringan Solana mulai $5. Tawaran berlaku 30 hari, dan lima total tertinggi yang tayang.",
  },
  {
    q: "Bagaimana kalau tautan kelola hilang?",
    a: "Tautan kelola adalah satu-satunya kunci kampanye karena kami tidak meminta email. Simpan tautan itu saat kampanye dibuat — kampanyenya tetap bisa dipakai pendukung, tetapi statistiknya tidak bisa dibuka tanpa tautan tersebut.",
  },
];

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bingkai.metricbase.org";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Bingkai",
      url: SITE,
      applicationCategory: "PhotographyApplication",
      operatingSystem: "Web",
      inLanguage: "id",
      description:
        "Buat dan pakai twibbon kampanye tanpa akun dan tanpa watermark. Foto diproses di perangkat pengguna.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
      publisher: { "@type": "Organization", name: "MetricBase", url: "https://metricbase.org" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const TRUST = ["Foto tidak diunggah", "Tanpa watermark", "Tanpa akun", "Gratis selamanya"];

async function loadData(): Promise<{ campaigns: DirectoryEntry[]; board: Slot[]; tipQr: string }> {
  const [campaigns, board, tipQr] = await Promise.all([
    listDirectory().catch((e) => {
      console.error("[home] directory failed", e);
      return [] as DirectoryEntry[];
    }),
    getBoard().catch(() => [] as Slot[]),
    qrSvg(solanaPayUrl({ memo: TIP_MEMO, label: "Dukungan untuk Bingkai", message: "Terima kasih sudah mendukung Bingkai" })),
  ]);
  return { campaigns, board, tipQr };
}

/** Three popular frames fanned out, so the first screen shows the product, not a promise. */
function HeroStack({ picks }: { picks: DirectoryEntry[] }) {
  const tilt = ["-rotate-6 -translate-x-10 translate-y-6", "rotate-0 z-10", "rotate-6 translate-x-10 translate-y-6"];
  const slots = [picks[1], picks[0], picks[2]];
  return (
    <div className="relative mx-auto grid h-72 w-full max-w-sm place-items-center sm:h-80" aria-hidden>
      <div className="absolute inset-6 bg-[radial-gradient(circle,rgba(201,168,76,0.18),transparent_65%)]" />
      {slots.map((c, i) => (
        <div
          key={i}
          className={`absolute w-40 border bg-bg-card p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] sm:w-48 ${tilt[i]} ${
            i === 1 ? "border-line-strong" : "border-line"
          }`}
        >
          {c ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/thumb/${c.slug}?v=${c.version}`} alt="" className="aspect-square w-full bg-bg-elev object-contain" />
          ) : (
            <div className="grid aspect-square w-full place-items-center border-[10px] border-gold/70 bg-[linear-gradient(135deg,#1c1c1c,#0f0f0f)]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-gold">fotomu</span>
            </div>
          )}
          <p className="truncate px-1 pb-0.5 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-gray-3">
            {c ? c.title : "Kampanye kamu"}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  const { campaigns, board, tipQr } = await loadData();
  const popular = [...campaigns].sort((a, b) => b.downloads - a.downloads).slice(0, 3);
  const totalDownloads = campaigns.reduce((a, c) => a + c.downloads, 0);

  return (
    <div className="space-y-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ---- hero ---- */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <p className="eyebrow">Bingkai kampanye · twibbon</p>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Twibbon tanpa mengunggah wajahmu ke siapa pun.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-gray-2">
            Layanan bingkai biasanya mengirim fotomu ke server mereka dan mengembalikannya dengan watermark. Bingkai
            memasang bingkainya langsung di browser kamu. Fotonya tidak pergi ke mana-mana, hasilnya bersih, dan tidak
            ada yang perlu mendaftar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/buat"
              className="border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold hover:bg-tint-gold-hover"
            >
              Buat kampanye gratis
            </Link>
            <Link href="/#kampanye" className="border border-line px-5 py-3 text-sm text-gray-1 hover:bg-bg-hover">
              Cari twibbon →
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-gray-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="text-up">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroStack picks={popular} />
      </section>

      {/* ---- stats band ---- */}
      <section className="grid grid-cols-3 divide-x divide-line border-y border-line">
        {[
          [campaigns.length.toLocaleString("id-ID"), "kampanye aktif"],
          [totalDownloads.toLocaleString("id-ID"), "foto diunduh"],
          ["0", "foto kami simpan"],
        ].map(([n, l]) => (
          <div key={l} className="px-3 py-5 text-center sm:px-6">
            <p className="font-mono text-2xl font-bold text-white sm:text-3xl">{n}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray-3">{l}</p>
          </div>
        ))}
      </section>

      {/* ---- directory ---- */}
      <section id="kampanye" className="scroll-mt-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="eyebrow">Direktori</p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Kampanye yang sedang aktif</h2>
            <p className="max-w-xl text-sm text-gray-2">
              Cari twibbon sekolah, kantor, komunitas, atau acaramu. Pilih satu, pasang fotomu, unduh.
            </p>
          </div>
          <Link href="/buat" className="font-mono text-[11px] uppercase tracking-wider text-gold hover:text-gold-bright">
            + Tambahkan kampanyemu
          </Link>
        </div>
        <CampaignDirectory campaigns={campaigns} categories={CATEGORIES} />
      </section>

      {/* ---- sponsors ---- */}
      <section id="sponsor" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="eyebrow">Sponsor</p>
            <h2 className="text-xl font-bold tracking-tight text-white">Bingkai tetap gratis berkat mereka</h2>
          </div>
        </div>
        <SponsorBoard board={board} price={priceToEnter(board)} />
      </section>

      {/* ---- why ---- */}
      <section id="kenapa" className="scroll-mt-6 space-y-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">Enam alasan, satu yang utama</h2>
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.k} className="bg-black p-5">
              <p className="font-mono text-[11px] tracking-widest text-gold-dim">{w.k}</p>
              <h3 className="mt-2 text-base font-bold text-white">{w.h}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-2">{w.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight text-white">Bingkai dibanding layanan twibbon biasa</h2>
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-gray-3">
                <th className="px-4 py-3 font-normal">Kemampuan</th>
                <th className="px-4 py-3 text-center font-normal text-gold">Bingkai</th>
                <th className="px-4 py-3 text-center font-normal">Layanan lain</th>
              </tr>
            </thead>
            <tbody>
              {VS.map(([label, ours, theirs]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-gray-1">{label}</td>
                  <td className="px-4 py-3 text-center text-up">{ours ? "Ya" : "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-3">{theirs ? "Ya" : "Tidak"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-3">
          Perbandingan ini menyebut kemampuan produk, bukan menuduh siapa pun berbuat salah. Memproses foto di server
          adalah pilihan arsitektur yang wajar; kami hanya memilih yang lain, dan itu yang membuat watermark jadi tidak
          perlu.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight text-white">Cara kerjanya</h2>
        <ol className="grid gap-px border border-line bg-line sm:grid-cols-3">
          {[
            ["Unggah bingkai", "PNG transparan. Satu berkas, sekali saja."],
            ["Bagikan tautan", "Pendukung buka, pilih foto, selesai."],
            ["Lihat hasilnya", "Kunjungan dan unduhan, tanpa melacak siapa pun."],
          ].map(([h, p], i) => (
            <li key={h} className="bg-black p-5">
              <p className="font-mono text-[11px] tracking-widest text-gold-dim">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-base font-bold text-white">{h}</h3>
              <p className="mt-1 text-[13px] text-gray-2">{p}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/buat"
          className="inline-block border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold hover:bg-tint-gold-hover"
        >
          Mulai buat twibbon
        </Link>
      </section>

      {/* ---- tip ---- */}
      <section id="dukung" className="scroll-mt-6 grid items-center gap-6 border border-line-strong bg-tint-gold-soft p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="mx-auto bg-white p-2" style={{ width: 168, height: 168 }}>
          <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: tipQr }} />
        </div>
        <div className="space-y-3">
          <p className="eyebrow">Dukung Bingkai</p>
          <h2 className="text-2xl font-bold tracking-tight text-white">Suka Bingkai? Traktir servernya.</h2>
          <p className="max-w-xl text-sm text-gray-2">
            Pindai dengan dompet Solana (Phantom, Solflare, Backpack) dan kirim USDC berapa pun. Memo{" "}
            <code className="font-mono text-gold-bright">{TIP_MEMO}</code> sudah terisi.
          </p>
          <p className="break-all font-mono text-[11px] text-gray-3">{WALLET}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/sponsor" className="border border-line-strong px-4 py-2 text-sm font-semibold text-gold hover:bg-tint-gold-hover">
              Atau jadi sponsor →
            </Link>
          </div>
        </div>
      </section>

      <section id="tanya" className="scroll-mt-6 space-y-5">
        <h2 className="text-2xl font-bold tracking-tight text-white">Pertanyaan umum</h2>
        <div className="divide-y divide-line border border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                {f.q}
                <span className="font-mono text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-gray-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
