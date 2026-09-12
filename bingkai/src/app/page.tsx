import Link from "next/link";

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
  ["Tanpa iklan untuk pendukung", true, false],
  ["Buat kampanye tanpa akun", true, false],
  ["Kolom nama di dalam bingkai", true, false],
  ["Ekspor Story, feed, dan cetak", true, false],
  ["Unduh massal dari daftar CSV", true, false],
  ["Jalan saat internet lemah", true, false],
] as const;

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="space-y-6">
        <p className="eyebrow">Bingkai kampanye</p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl">
          Twibbon tanpa mengunggah wajahmu ke siapa pun.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-gray-2">
          Layanan bingkai kampanye biasanya mengirim fotomu ke server mereka, menempelkan
          bingkai di sana, lalu mengembalikan hasilnya — sering dengan watermark dan
          iklan. Bingkai memasang bingkainya di browser kamu. Fotonya tidak pergi ke
          mana-mana, hasilnya bersih, dan tidak ada yang perlu mendaftar.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/buat"
            className="border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold hover:bg-tint-gold-hover"
          >
            Buat kampanye — gratis
          </Link>
          <Link
            href="/#kenapa"
            className="border border-line px-5 py-3 text-sm text-gray-1 hover:bg-bg-hover"
          >
            Kenapa bukan yang lain
          </Link>
        </div>
      </section>

      <section id="kenapa" className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Enam alasan, satu yang utama
        </h2>
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.k} className="bg-black p-5">
              <p className="font-mono text-[10px] tracking-widest text-gold-dim">{w.k}</p>
              <h3 className="mt-2 text-base font-bold text-white">{w.h}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-2">{w.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Bingkai dibanding layanan twibbon biasa
        </h2>
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-gray-3">
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
                  <td className="px-4 py-3 text-center text-gray-3">
                    {theirs ? "Ya" : "Tidak"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-3">
          Perbandingan ini menyebut kemampuan produk, bukan menuduh siapa pun berbuat
          salah. Memproses foto di server adalah pilihan arsitektur yang wajar; kami
          hanya memilih yang lain, dan itu yang membuat watermark jadi tidak perlu.
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
              <p className="font-mono text-[10px] tracking-widest text-gold-dim">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-base font-bold text-white">{h}</h3>
              <p className="mt-1 text-[13px] text-gray-2">{p}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
