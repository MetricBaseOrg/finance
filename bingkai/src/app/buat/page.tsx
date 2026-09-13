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

import { useEffect, useState } from "react";
import Link from "next/link";
import { slugify, type FieldSpec } from "@/lib/compose";
import {
  FieldsEditor,
  FrameDropzone,
  FramePreview,
  SaveLinkActions,
  type FrameState,
} from "@/components/FrameSetup";
import { CATEGORIES } from "@/lib/validate";

type Created = { slug: string; url: string; manageUrl: string };

export default function BuatPage() {
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [blurb, setBlurb] = useState("");
  const [category, setCategory] = useState("");
  const [listed, setListed] = useState(true);
  const [frame, setFrame] = useState<FrameState | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [background, setBackground] = useState("#0a0a0a");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Created | null>(null);

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
          category,
          listed,
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

  // The manage link is shown exactly once. Ask before the tab closes on it.
  useEffect(() => {
    if (!done) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [done]);

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
        <SaveLinkActions url={`${origin}${done.manageUrl}`} title={title} />
        <p className="text-[12px] leading-relaxed text-gray-3">
          Tautan kelola adalah satu-satunya cara membuka statistik, mengubah, menutup, atau
          menghapus kampanye. Kami tidak menyimpan email kamu, jadi kami juga tidak bisa
          mengirimkannya ulang. Kirim ke WhatsApp atau email kamu sendiri sekarang.
        </p>
        <div className="flex flex-wrap gap-2">
        <Link
          href={done.url}
          className="inline-block border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold"
        >
          Buka kampanye
        </Link>
        <Link
          href={done.manageUrl}
          className="inline-block border border-line px-5 py-3 text-sm text-gray-1 hover:bg-bg-hover"
        >
          Buka halaman kelola
        </Link>
        </div>
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
        <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
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
          <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
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
          <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
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
        <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
          Keterangan singkat
        </span>
        <textarea
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="Ayo pasang twibbon ini untuk merayakan kelulusan kita!"
          className="w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong"
        />
      </label>

      <div className="space-y-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
          Bingkai (PNG transparan)
        </span>
        <FrameDropzone
          frame={frame}
          onFrame={(f, w) => {
            setErr(null);
            setFrame(f);
            setWarning(w);
          }}
          onError={setErr}
        />
        {warning && (
          <p className="border border-line-strong bg-tint-gold-soft px-3 py-2 text-[11px] text-gold">{warning}</p>
        )}
        {frame && (
          <div className="pt-2">
            <FramePreview frame={frame} background={background} fields={fields} />
            <p className="mt-2 text-center text-[11px] text-gray-3">
              Warna latar terlihat di bagian transparan sampai pendukung memilih foto.
            </p>
          </div>
        )}
      </div>

      <FieldsEditor fields={fields} setFields={setFields} hasFrame={!!frame} />

      <div className="space-y-3 border border-line p-4">
        <label className="block space-y-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
            Kategori <span className="normal-case tracking-normal text-gray-3">(opsional)</span>
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong"
          >
            <option value="">Pilih kategori…</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-gray-1">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => setListed(e.target.checked)}
            className="mt-1 accent-[#c9a84c]"
          />
          <span>
            Tampilkan di direktori kampanye Bingkai
            <span className="block text-[12px] text-gray-3">
              Orang bisa menemukan kampanyemu dari beranda. Hilangkan centang untuk kampanye internal; tautannya tetap
              bisa dibagikan. Bisa diubah kapan saja di halaman kelola.
            </span>
          </span>
        </label>
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
      <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
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
          className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-gold"
        >
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </div>
  );
}
