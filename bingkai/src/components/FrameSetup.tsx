"use client";

/**
 * Frame upload, live preview and text-field editor. Shared by /buat and the campaign
 * settings page so creating and editing a campaign behave identically.
 */

import { useEffect, useRef, useState } from "react";
import { draw, loadImage, readAsDataURL, type FieldSpec } from "@/lib/compose";

export type FrameState = { data: string; w: number; h: number; img: HTMLImageElement };

const MAX_FRAME_BYTES = 3 * 1024 * 1024; // matches lib/validate.ts

/**
 * Share of the frame that a photo can show through. A PNG exported without a transparent
 * window is the most common organiser mistake: every supporter's photo ends up hidden.
 */
function transparentShare(img: HTMLImageElement): number {
  const s = 96;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 1;
  ctx.drawImage(img, 0, 0, s, s);
  const px = ctx.getImageData(0, 0, s, s).data;
  let clear = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 200) clear++;
  return clear / (s * s);
}

export async function readFrame(
  file: File,
): Promise<{ frame: FrameState; warning: string | null } | { error: string }> {
  if (file.type !== "image/png") return { error: "Bingkai harus PNG dengan latar transparan." };
  if (file.size > MAX_FRAME_BYTES) return { error: "Berkas terlalu besar. Maksimal 3 MB." };
  try {
    const data = await readAsDataURL(file);
    const img = await loadImage(data);
    const share = transparentShare(img);
    const warning =
      share < 0.03
        ? "Bingkai ini hampir tidak punya bagian transparan, jadi foto pendukung akan tertutup. Pastikan bagian untuk foto dihapus (transparan) sebelum diekspor."
        : img.naturalWidth < 800
          ? `Resolusi bingkai kecil (${img.naturalWidth}×${img.naturalHeight}). Hasilnya bisa buram; disarankan minimal 1080×1080.`
          : null;
    return { frame: { data, w: img.naturalWidth, h: img.naturalHeight, img }, warning };
  } catch {
    return { error: "Gagal membaca berkas." };
  }
}

export function FrameDropzone({
  frame,
  onFrame,
  onError,
}: {
  frame: FrameState | null;
  onFrame: (f: FrameState, warning: string | null) => void;
  onError: (msg: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pick = async (file: File | null) => {
    if (!file) return;
    const r = await readFrame(file);
    if ("error" in r) onError(r.error);
    else onFrame(r.frame, r.warning);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void pick(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 border border-dashed px-4 py-8 text-sm hover:bg-bg-hover ${
          dragOver ? "border-gold bg-tint-gold-soft text-gold" : "border-line bg-bg-elev text-gray-2"
        }`}
      >
        <span>
          {frame ? `Terpasang · ${frame.w}×${frame.h} — klik untuk ganti` : "Pilih atau seret berkas PNG ke sini"}
        </span>
        <span className="text-[11px] text-gray-3">
          Bagian untuk foto harus transparan · disarankan 1080×1080 · maks 3 MB
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          void pick(f);
        }}
      />
    </>
  );
}

/**
 * Live preview of the frame with its text fields, so an organiser positions a field by
 * looking at it instead of guessing a 0–1 number.
 */
export function FramePreview({
  frame,
  background,
  fields,
}: {
  frame: { img: HTMLImageElement; w: number; h: number };
  background: string;
  fields: FieldSpec[];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const W = 320;
  const H = Math.round((frame.h / frame.w) * W);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, W, H, {
      photo: null,
      frame: frame.img,
      transform: { scale: 1, dx: 0, dy: 0, rotate: 0 },
      fields,
      // Show each field's label as sample text so its position is visible.
      values: fields.map((f) => ({ id: f.id, value: f.label || "Contoh nama" })),
      background,
    });
  }, [frame, background, fields, H]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Pratinjau bingkai dengan kolom teks"
      className="mx-auto block w-full max-w-[20rem] border border-line"
      style={{ aspectRatio: `${W} / ${H}` }}
    />
  );
}

export const DEFAULT_FIELD = (n: number): FieldSpec => ({
  id: `f${n}-${Math.random().toString(36).slice(2, 6)}`,
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

export function FieldsEditor({
  fields,
  setFields,
  hasFrame,
}: {
  fields: FieldSpec[];
  setFields: (fn: (prev: FieldSpec[]) => FieldSpec[]) => void;
  hasFrame: boolean;
}) {
  const set = (i: number, patch: Partial<FieldSpec>) =>
    setFields((p) => p.map((x, j) => (i === j ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-gray-2">Kolom teks · opsional</span>
        {fields.length < 3 && (
          <button
            type="button"
            onClick={() => setFields((f) => [...f, DEFAULT_FIELD(f.length + 1)])}
            className="font-mono text-[11px] uppercase tracking-wider text-gold hover:text-gold-bright"
          >
            + Tambah kolom
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-gray-3">
        Pendukung mengisi kolom ini dan isinya tercetak di bingkai. Cocok untuk nama, kelas, atau unit kerja.
      </p>
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-2 border border-line p-3">
          <div className="grid grid-cols-[1fr_3rem_2.5rem] gap-2">
            <input
              value={f.label}
              maxLength={40}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder="Label, misal Nama"
              aria-label={`Label kolom ${i + 1}`}
              className="border border-line bg-bg-elev px-2 py-2 text-sm outline-none focus:border-line-strong"
            />
            <input
              type="color"
              value={f.color}
              aria-label={`Warna teks kolom ${i + 1}`}
              onChange={(e) => set(i, { color: e.target.value })}
              className="h-full w-full border border-line bg-bg-elev"
            />
            <button
              type="button"
              onClick={() => setFields((p) => p.filter((_, j) => j !== i))}
              className="border border-line text-lg text-gray-2 hover:text-down"
              aria-label={`Hapus kolom ${i + 1}`}
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2 text-[11px] text-gray-2">
            <span>Atas–bawah</span>
            <input
              type="range"
              min={0.03}
              max={0.97}
              step={0.005}
              value={f.y}
              aria-label={`Posisi vertikal kolom ${i + 1}`}
              onChange={(e) => set(i, { y: Number(e.target.value) })}
              className="h-1 accent-gold"
            />
            <span>Kiri–kanan</span>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.005}
              value={f.x}
              aria-label={`Posisi horizontal kolom ${i + 1}`}
              onChange={(e) => set(i, { x: Number(e.target.value) })}
              className="h-1 accent-gold"
            />
            <span>Ukuran</span>
            <input
              type="range"
              min={0.02}
              max={0.1}
              step={0.001}
              value={f.size}
              aria-label={`Ukuran teks kolom ${i + 1}`}
              onChange={(e) => set(i, { size: Number(e.target.value) })}
              className="h-1 accent-gold"
            />
            <span>Gaya</span>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={f.weight >= 700}
                  onChange={(e) => set(i, { weight: e.target.checked ? 700 : 500 })}
                  className="accent-gold"
                />
                Tebal
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(f.uppercase)}
                  onChange={(e) => set(i, { uppercase: e.target.checked })}
                  className="accent-gold"
                />
                HURUF BESAR
              </label>
            </div>
          </div>
        </div>
      ))}
      {fields.length > 0 && !hasFrame && (
        <p className="text-[11px] text-gray-3">Unggah bingkai untuk melihat posisi teks.</p>
      )}
    </div>
  );
}

/** Copy, WhatsApp-to-self and email-to-self for the manage link. No server involved. */
export function SaveLinkActions({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Tautan KELOLA kampanye "${title}" (rahasia, jangan dibagikan):\n${url}`;
  const btn =
    "border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-gold hover:bg-bg-hover text-center";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* visible link can still be copied by hand */
          }
        }}
      >
        {copied ? "Tersalin ✓" : "Salin tautan kelola"}
      </button>
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        Kirim ke WhatsApp saya
      </a>
      <a
        className={btn}
        href={`mailto:?subject=${encodeURIComponent(`Tautan kelola: ${title}`)}&body=${encodeURIComponent(text)}`}
      >
        Kirim ke email saya
      </a>
    </div>
  );
}
