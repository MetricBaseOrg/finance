"use client";

/**
 * Create a campaign. No account, by design.
 *
 * The organiser uploads one transparent PNG and gets two links back: the public one to
 * share, and a manage link that is the only proof of ownership. Requiring registration
 * here is the biggest drop-off in the funnel for the people who actually run these
 * campaigns — a school admin the night before, a committee volunteer on a phone — and
 * an unlisted secret link is a proportionate trust model for a photo frame.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { loadImage, readAsDataURL, slugify, type FieldSpec } from "@/lib/compose";

type Created = { slug: string; url: string; manageUrl: string };

const DEFAULT_FIELD = (n: number): FieldSpec => ({
  id: `f${n}`,
  label: n === 1 ? "Nama" : `Kolom ${n}`,
  x: 0.5,
  y: 0.88,
  size: 0.045,
  color: "#ffffff",
  weight: 700,
  align: "center",
  font: "Manrope, sans-serif",
  maxWidth: 0.8,
  uppercase: false,
});

export default function BuatPage() {
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [blurb, setBlurb] = useState("");
  const [frame, setFrame] = useState<{ data: string; w: number; h: number } | null>(null);
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [background, setBackground] = useState("#0a0a0a");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Created | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickFrame = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    if (file.type !== "image/png") {
      setErr("Bingkai harus PNG dengan latar transparan.");
      return;
    }
    // matches MAX_FRAME_BYTES in api/campaigns/route.ts: Vercel caps request bodies at 4.5 MB
    if (file.size > 3 * 1024 * 1024) {
      setErr("Berkas terlalu besar. Maksimal 3 MB.");
      return;
    }
    try {
      const data = await readAsDataURL(file);
      const img = await loadImage(data);
      setFrame({ data, w: img.naturalWidth, h: img.naturalHeight });
    } catch {
      setErr("Gagal membaca berkas.");
    }
  };

  const submit = async () => {
    if (!title.trim()) return setErr("Judul wajib diisi.");
    if (!frame) return setErr("Unggah bingkai PNG dulu.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          organiser,
          blurb,
          slug: slugify(title),
          frameData: frame.data,
          frameW: frame.w,
          frameH: frame.h,
          background,
          fields,
        }),
      });
      const j = (await res.json()) as Created & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Gagal membuat kampanye.");
      setDone(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membuat kampanye.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <div className="max-w-2xl space-y-6">
        <p className="eyebrow">Selesai</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Kampanye kamu sudah hidup.
        </h1>
        <div className="space-y-3">
          <Field label="Tautan untuk dibagikan" value={`${origin}${done.url}`} />
          <Field
            label="Tautan kelola — simpan, ini satu-satunya kunci"
            value={`${origin}${done.manageUrl}`}
            warn
          />
        </div>
        <p className="text-[12px] leading-relaxed text-gray-3">
          Tautan kelola adalah satu-satunya cara membuka statistik dan menutup kampanye.
          Kami tidak menyimpan email kamu, jadi kami juga tidak bisa mengirimkannya
          ulang. Simpan sekarang.
        </p>
        <Link
          href={done.url}
          className="inline-block border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold"
        >
          Buka kampanye
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <p className="eyebrow">Buat kampanye</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Satu PNG transparan, dan selesai.
        </h1>
        <p className="text-sm text-gray-2">
          Tidak perlu mendaftar. Kamu akan dapat dua tautan: satu untuk dibagikan, satu
          untuk kamu simpan.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
          Judul kampanye
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Wisuda Angkatan 2026"
          className="w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
            Penyelenggara
          </span>
          <input
            value={organiser}
            onChange={(e) => setOrganiser(e.target.value)}
            maxLength={80}
            placeholder="SMA Negeri 1"
            className="w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
            Warna latar
          </span>
          <input
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            className="h-[42px] w-full border border-line bg-bg-elev px-1"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
          Keterangan singkat
        </span>
        <textarea
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          maxLength={280}
          rows={2}
          className="w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong"
        />
      </label>

      <div className="space-y-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
          Bingkai (PNG transparan)
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center border border-dashed border-line bg-bg-elev px-4 py-8 text-sm text-gray-2 hover:bg-bg-hover"
        >
          {frame ? `Terpasang · ${frame.w}×${frame.h}` : "Pilih berkas PNG"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => pickFrame(e.target.files?.[0] ?? null)}
        />
        {frame && (
          <div
            className="mx-auto mt-2 w-40 border border-line"
            style={{ background, aspectRatio: `${frame.w} / ${frame.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame.data} alt="Pratinjau bingkai" className="h-full w-full" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
            Kolom teks · opsional
          </span>
          {fields.length < 3 && (
            <button
              type="button"
              onClick={() => setFields((f) => [...f, DEFAULT_FIELD(f.length + 1)])}
              className="font-mono text-[10px] uppercase tracking-wider text-gold hover:text-gold-bright"
            >
              + Tambah kolom
            </button>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-gray-3">
          Pendukung mengisi kolom ini dan isinya tercetak di bingkai. Cocok untuk nama,
          kelas, atau unit kerja.
        </p>
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[1fr_5rem_5rem_2rem] gap-2">
            <input
              value={f.label}
              onChange={(e) =>
                setFields((p) =>
                  p.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)),
                )
              }
              placeholder="Label"
              className="border border-line bg-bg-elev px-2 py-2 text-xs outline-none focus:border-line-strong"
            />
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={f.y}
              onChange={(e) =>
                setFields((p) =>
                  p.map((x, j) => (i === j ? { ...x, y: Number(e.target.value) } : x)),
                )
              }
              title="Posisi vertikal (0 atas, 1 bawah)"
              className="border border-line bg-bg-elev px-2 py-2 text-xs outline-none"
            />
            <input
              type="color"
              value={f.color}
              onChange={(e) =>
                setFields((p) =>
                  p.map((x, j) => (i === j ? { ...x, color: e.target.value } : x)),
                )
              }
              className="border border-line bg-bg-elev"
            />
            <button
              type="button"
              onClick={() => setFields((p) => p.filter((_, j) => j !== i))}
              className="text-gray-3 hover:text-down"
              aria-label="Hapus kolom"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {err && <p className="border border-down/40 px-3 py-2 text-xs text-down">{err}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="w-full border border-line-strong bg-tint-gold-soft px-5 py-3.5 text-sm font-semibold text-gold hover:bg-tint-gold-hover disabled:opacity-50"
      >
        {busy ? "Membuat…" : "Buat kampanye"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`border p-3 ${warn ? "border-line-strong" : "border-line"}`}>
      <p className="font-mono text-[10px] uppercase tracking-wider text-gray-2">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-1">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-gold"
        >
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </div>
  );
}
