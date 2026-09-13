"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const WALLET = "9utfHAwb8ZqasYygd9keiFNqyTTB91wzT3dvvJcTbSyP";
const NAME_MAX = 32;
const TAGLINE_MAX = 60;

type BoardRow = { rank: number; id: string; name: string; totalUsd: number };
type Status = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  logo: string;
  hidden: boolean;
  totalUsd: number;
  rank: number | null;
  bids: { amount: number; mint: string; at: string }[];
};

const label = "font-mono text-[11px] uppercase tracking-wider text-gray-2";
const input =
  "w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong";
const primary =
  "inline-flex w-full items-center justify-center border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold hover:bg-tint-gold-hover disabled:cursor-not-allowed disabled:opacity-40";
const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Square-fit and downscale the logo in the browser so uploads stay small. */
async function prepareLogo(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

function Preview({ name, tagline, logo }: { name: string; tagline: string; logo: string | null }) {
  const n = name || "Nama merek";
  const t = tagline || "Satu kalimat promosimu tampil di sini";
  const Img = ({ size }: { size: number }) =>
    logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className="shrink-0 border border-line bg-white/5 object-contain" style={{ width: size, height: size }} />
    ) : (
      <div className="grid shrink-0 place-items-center border border-dashed border-line text-gray-3" style={{ width: size, height: size }}>
        ◎
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <p className={`${label} mb-2`}>Beranda Bingkai</p>
        <div className="flex items-center gap-3 border border-line bg-bg-card p-3">
          <Img size={44} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{n}</p>
            <p className="line-clamp-2 text-[12px] text-gray-2">{t}</p>
          </div>
        </div>
      </div>
      <div>
        <p className={`${label} mb-2`}>Setiap halaman kampanye (di bawah editor)</p>
        <div className="flex w-64 items-center gap-2.5 border border-line bg-bg-card p-2.5">
          <Img size={32} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-white">{n}</p>
            <p className="truncate text-[11px] text-gray-2">{t}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SponsorFlow({ priceToEnter, board }: { priceToEnter: number; board: BoardRow[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [url, setUrl] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState<Status | null>(null);
  const [missing, setMissing] = useState(false);
  const [amount, setAmount] = useState(priceToEnter);
  const [pay, setPay] = useState<{ link: string; memo: string; svg: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const prevTotal = useRef<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // Payment step: poll the bid status (each poll also triggers a throttled chain scan).
  useEffect(() => {
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/sponsor/${id}`, { cache: "no-store" }).catch(() => null);
      if (!res || stop) return;
      if (res.status === 404) return setMissing(true);
      if (!res.ok) return;
      const s: Status = await res.json();
      if (prevTotal.current !== null && s.totalUsd > prevTotal.current) setCelebrate(true);
      prevTotal.current = s.totalUsd;
      setStatus(s);
    };
    void tick();
    const t = setInterval(tick, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    const h = setTimeout(async () => {
      const res = await fetch(`/api/sponsor/qr?id=${id}&amount=${amount}&format=json`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) setPay(await res.json());
    }, 250);
    return () => {
      clearTimeout(h);
      ctrl.abort();
    };
  }, [id, amount]);

  const neededFor = useMemo(() => {
    const total = status?.totalUsd ?? 0;
    return board
      .filter((b) => b.id !== status?.id)
      .map((b) => ({ rank: b.rank, need: Math.max(0, Math.ceil(b.totalUsd - total + 1)) }))
      .slice(0, 3);
  }, [board, status]);

  async function submit() {
    setError(null);
    if (!logo) return setError("Unggah logo dulu.");
    setBusy(true);
    try {
      const res = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, tagline, url, logo }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal membuat slot sponsor.");
      router.push(`/sponsor?id=${j.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  // ------------------------------------------------------------------ pay step
  if (id) {
    if (missing) {
      return (
        <div className="max-w-xl space-y-3">
          <p className="eyebrow">Sponsor</p>
          <h1 className="text-2xl font-extrabold text-white">Slot sponsor tidak ditemukan.</h1>
          <p className="text-sm text-gray-2">
            Tautannya salah, atau iklan yang belum dibayar sudah dihapus otomatis setelah 7 hari.
          </p>
          <a href="/sponsor" className="inline-block border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold">
            Buat iklan baru
          </a>
        </div>
      );
    }
    const live = status && status.rank !== null && !status.hidden;
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="eyebrow">Langkah 2 dari 2 · Pasang tawaran</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Kirim USDC untuk tayang</h1>
            <p className="text-sm text-gray-2">
              Pindai dengan Phantom, Solflare, atau Backpack: jumlah dan memo sudah terisi. Iklan tayang begitu pembayaran
              terkonfirmasi dan totalmu masuk 5 besar. Simpan halaman ini untuk menambah tawaran nanti.
            </p>
          </div>

          <div className="grid gap-6 border border-line-strong bg-bg-card p-5 md:grid-cols-[auto_1fr]">
            <div className="mx-auto bg-white p-2" style={{ width: 220, height: 220 }}>
              {pay ? (
                <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: pay.svg }} />
              ) : (
                <div className="grid h-full place-items-center text-xs text-gray-3">Memuat QR…</div>
              )}
            </div>
            <div className="min-w-0 space-y-4">
              <label className="block space-y-1">
                <span className={label}>Jumlah tawaran (USDC)</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-3">$</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
                    className={`${input} !text-2xl !font-bold`}
                  />
                </div>
                <span className="block text-[11px] text-gray-3">
                  Masuk papan mulai ${priceToEnter}. Kamu bisa kirim jumlah berapa pun dan menambah kapan saja.
                </span>
              </label>
              {pay && (
                <a href={pay.link} className={primary}>
                  Buka di dompet
                </a>
              )}
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center gap-2 border border-line bg-bg-elev px-3 py-2">
                  <span className="w-11 shrink-0 text-gray-3">Ke</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-gray-1">{WALLET}</code>
                  <button type="button" className="shrink-0 font-semibold text-gold" onClick={() => copy(WALLET, "w")}>
                    {copied === "w" ? "Tersalin" : "Salin"}
                  </button>
                </div>
                <div className="flex items-center gap-2 border border-line bg-bg-elev px-3 py-2">
                  <span className="w-11 shrink-0 text-gray-3">Memo</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-gold-bright">{pay?.memo ?? "…"}</code>
                  <button type="button" className="shrink-0 font-semibold text-gold" onClick={() => pay && copy(pay.memo, "m")}>
                    {copied === "m" ? "Tersalin" : "Salin"}
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-3">
                  Kirim manual? Pakai <b className="text-gray-1">USDC di jaringan Solana</b> dan tulis memo persis seperti di
                  atas. Tanpa memo, tawaran tidak bisa dicocokkan dengan iklanmu.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className={`border p-5 ${celebrate ? "border-up/60" : "border-line"}`}>
            <p className={label}>Status iklanmu</p>
            {!status ? (
              <p className="mt-3 text-sm text-gray-2">Memuat…</p>
            ) : (
              <>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-3xl font-bold text-up">${status.totalUsd}</span>
                  <span
                    className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${
                      live ? "bg-up/15 text-up" : "bg-white/5 text-gray-2"
                    }`}
                  >
                    {status.hidden
                      ? "Disembunyikan"
                      : live
                        ? `Tayang · #${status.rank}`
                        : status.totalUsd > 0
                          ? "Tersalip"
                          : "Menunggu pembayaran"}
                  </span>
                </div>
                {!status.totalUsd && (
                  <p className="mt-3 flex items-center gap-2 text-[12px] text-gray-2">
                    <span className="h-2 w-2 animate-pulse bg-gold" /> Memantau blockchain, halaman ini diperbarui sendiri.
                  </p>
                )}
                {celebrate && (
                  <p className="mt-3 bg-up/10 p-3 text-sm font-semibold text-up">Pembayaran diterima. Terima kasih!</p>
                )}
                {status.hidden && (
                  <p className="mt-3 bg-down/10 p-3 text-[12px] text-down">
                    Iklan ini disembunyikan karena laporan atau peninjauan. Hubungi tim MetricBase untuk menyelesaikannya.
                  </p>
                )}
                {neededFor.length > 0 && (
                  <ul className="mt-4 space-y-1 text-[12px] text-gray-2">
                    {neededFor.map((n) => (
                      <li key={n.rank}>
                        Tambah <b className="text-white">${n.need}</b> untuk menyalip #{n.rank}
                      </li>
                    ))}
                  </ul>
                )}
                {status.bids.length > 0 && (
                  <div className="mt-4 space-y-1 border-t border-line pt-3 text-[11px] text-gray-3">
                    {status.bids.map((b) => (
                      <div key={b.at + b.amount} className="flex justify-between gap-2">
                        <span>{tanggal(b.at)}</span>
                        <span>
                          ${b.amount} · berlaku s.d. {tanggal(new Date(new Date(b.at).getTime() + 30 * 864e5).toISOString())}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {status && <Preview name={status.name} tagline={status.tagline} logo={status.logo} />}
        </aside>
      </div>
    );
  }

  // ------------------------------------------------------------------ details step
  return (
    <div className="space-y-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="eyebrow">Langkah 1 dari 2 · Iklanmu</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Tampilkan merekmu di Bingkai.
            </h1>
            <p className="max-w-xl text-sm text-gray-2">
              Logo, satu kalimat, dan tautan. Tampil di beranda dan di bawah editor setiap kampanye twibbon, tempat
              orang membuka bingkai dari WhatsApp dan Instagram. Iklan tidak pernah masuk ke foto pendukung.
            </p>
          </div>

          <div className="space-y-5 border border-line p-5">
            <label className="block space-y-1">
              <span className={`${label} flex justify-between`}>
                Nama merek <span className="text-gray-3">{name.length}/{NAME_MAX}</span>
              </span>
              <input className={input} maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="Toko Kue Bu Ani" />
            </label>
            <label className="block space-y-1">
              <span className={`${label} flex justify-between`}>
                Satu kalimat <span className="text-gray-3">{tagline.length}/{TAGLINE_MAX}</span>
              </span>
              <input
                className={input}
                maxLength={TAGLINE_MAX}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Kue ulang tahun custom, antar se-Jabodetabek"
              />
            </label>
            <label className="block space-y-1">
              <span className={label}>Tautan</span>
              <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tokokue.id" inputMode="url" />
            </label>
            <div className="space-y-1">
              <span className={label}>Logo</span>
              <label className="flex cursor-pointer items-center gap-4 border border-dashed border-line p-4 hover:border-line-strong">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" width={56} height={56} className="border border-line" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center border border-line text-2xl text-gray-3">+</span>
                )}
                <span className="text-[12px] text-gray-2">Persegi paling bagus. PNG, JPG, atau WebP, otomatis diubah ke 256×256.</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      setLogo(await prepareLogo(f));
                    } catch {
                      setError("Gambar tidak bisa dibaca.");
                    }
                  }}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-[12px] text-gray-2">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-[#c9a84c]" />
              <span>
                Iklan tayang otomatis. Konten ilegal, menipu, judi, atau dewasa akan dihapus, pengunjung bisa melaporkan
                iklan, dan iklan yang dihapus tidak dikembalikan dananya.
              </span>
            </label>
            {error && <p className="bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}
            <button type="button" className={primary} disabled={busy || !name || !tagline || !url || !logo || !agree} onClick={submit}>
              {busy ? "Membuat…" : "Lanjut ke pembayaran"}
            </button>
          </div>
        </div>
        <aside className="lg:pt-28">
          <Preview name={name} tagline={tagline} logo={logo} />
        </aside>
      </div>

      <section className="grid gap-4 border-t border-line pt-8 sm:grid-cols-3">
        {[
          ["5 slot, lelang terbuka", "Total tawaran 30 hari terakhir menentukan peringkat. Lima teratas tayang, minimal $5."],
          ["Bayar USDC di Solana", "Tanpa akun dan tanpa invoice. Kirim dari dompet mana pun, tayang dalam hitungan menit."],
          ["Berlaku 30 hari", "Setiap tawaran dihitung 30 hari sejak dikirim. Tambah kapan saja untuk naik peringkat."],
        ].map(([t, d]) => (
          <div key={t} className="space-y-1">
            <p className="text-sm font-bold text-white">{t}</p>
            <p className="text-[12px] leading-relaxed text-gray-2">{d}</p>
          </div>
        ))}
      </section>

      {board.length > 0 && (
        <section className="space-y-3">
          <p className="eyebrow">Papan saat ini</p>
          <ol className="divide-y divide-line border border-line">
            {board.map((b) => (
              <li key={b.id} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-1">
                  <span className="mr-3 font-mono text-gray-3">#{b.rank}</span>
                  {b.name}
                </span>
                <span className="font-mono text-gold">${b.totalUsd}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
