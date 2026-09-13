"use client";

/**
 * The supporter-side editor.
 *
 * Everything here happens on the device. The photo is never sent anywhere: it is read
 * with FileReader, held as an HTMLImageElement in memory, and composited on a canvas.
 * The only network calls this component makes are anonymous counter pings, and it
 * works with those blocked.
 *
 * Design notes that matter for the comparison with Twibbonize:
 *  - drag and pinch directly on the preview, rather than two sliders
 *  - export presets, because a supporter wants a Story and a feed post, not a guess
 *  - personalised text fields baked into the frame by the organiser
 *  - one tap to the native share sheet on mobile, which is where these get shared
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IDENTITY,
  PRESETS,
  draw,
  download,
  exportBlob,
  isInAppBrowser,
  loadImage,
  readAsDataURL,
  type FieldSpec,
  type Preset,
  type Transform,
} from "@/lib/compose";

export type EditorCampaign = {
  slug: string;
  title: string;
  organiser: string | null;
  blurb: string | null;
  frameData: string;
  frameW: number;
  frameH: number;
  background: string;
  fields: FieldSpec[];
};

function ping(slug: string, kind: string, preset?: string) {
  // Fire and forget. A blocked or failed counter must never interrupt the editor.
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, kind, preset }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Supporters pass the campaign on in WhatsApp groups; make that one tap. */
function CopyLink({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/k/${slug}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
        await nav.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* dismissed */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="w-full border border-line px-4 py-2.5 text-[13px] text-gray-2 transition-colors hover:bg-bg-hover hover:text-gold"
    >
      {copied ? "Tautan tersalin ✓" : "Ajak teman: salin tautan kampanye"}
    </button>
  );
}

export default function FrameEditor({ campaign }: { campaign: EditorCampaign }) {
  const [frame, setFrame] = useState<HTMLImageElement | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [t, setT] = useState<Transform>(IDENTITY);
  const [values, setValues] = useState(() =>
    campaign.fields.map((f) => ({ id: f.id, value: "" })),
  );
  const [preset, setPreset] = useState<Preset>(
    PRESETS.find((p) => p.id === "square") ?? PRESETS[0],
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // The exported image, shown after every save. Where a download silently does nothing
  // (in-app browsers, some iOS setups) a long-press on this still saves it to the gallery.
  const [result, setResult] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadImage(campaign.frameData).then(setFrame).catch(() => setFrame(null));
    ping(campaign.slug, "VIEW");
  }, [campaign.frameData, campaign.slug]);

  const input = useMemo(
    () => ({
      photo,
      frame,
      transform: t,
      fields: campaign.fields,
      values,
      background: campaign.background,
    }),
    [photo, frame, t, campaign.fields, campaign.background, values],
  );

  // Preview is capped at 720 on the long edge; the export re-renders at full size, so
  // there is no reason to pay for a 2400px canvas on every drag frame.
  const previewH = 720;
  const previewW = Math.round((preset.w / preset.h) * previewH);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    c.width = Math.round(previewW * dpr);
    c.height = Math.round(previewH * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, previewW, previewH, input);
  }, [input, previewW, previewH]);

  // Browsers can restore a file input's selection across a reload, and picking the file
  // the input already holds fires no change event. Start every visit with it empty.
  useEffect(() => {
    if (fileRef.current) fileRef.current.value = "";
    setInApp(isInAppBrowser(navigator.userAgent));
  }, []);

  const showResult = async (blob: Blob) => {
    try {
      setResult(await readAsDataURL(blob));
    } catch {
      /* the download itself may still have worked */
    }
  };

  // A slow decode of an earlier pick must not overwrite a later one.
  const pickSeq = useRef(0);

  const pick = useCallback(
    async (file: File | null) => {
      if (!file) return;
      // Some Android and Windows pickers report an empty type for HEIC and friends, so
      // fall back to the extension instead of rejecting a real photo.
      const looksImage =
        file.type.startsWith("image/") ||
        (!file.type && /\.(jpe?g|png|gif|webp|avif|bmp|heic|heif)$/i.test(file.name));
      if (!looksImage) {
        setNote("File itu bukan gambar.");
        return;
      }
      const seq = ++pickSeq.current;
      try {
        const url = await readAsDataURL(file);
        const img = await loadImage(url);
        if (seq !== pickSeq.current) return;
        setPhoto(img);
        setT(IDENTITY);
        setNote(null);
        setResult(null);
        ping(campaign.slug, "PHOTO_PICKED");
      } catch {
        if (seq !== pickSeq.current) return;
        setNote(
          /\.(heic|heif)$/i.test(file.name)
            ? "Browser ini tidak bisa membuka foto HEIC. Coba foto JPG/PNG, atau screenshot fotonya."
            : "Gagal membaca foto. Coba foto lain.",
        );
      }
    },
    [campaign.slug],
  );

  // ---- drag / pinch, in fractions of the canvas so it survives a resize ----
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!photo) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!photo || !drag.current || drag.current.id !== e.pointerId) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const dx = (e.clientX - drag.current.x) / rect.width;
    const dy = (e.clientY - drag.current.y) / rect.height;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setT((p) => ({ ...p, dx: p.dx + dx, dy: p.dy + dy }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!photo) return;
    e.preventDefault();
    setT((p) => ({
      ...p,
      scale: Math.min(6, Math.max(0.4, p.scale * (e.deltaY < 0 ? 1.06 : 1 / 1.06))),
    }));
  };
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale: t.scale,
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const s = pinch.current.scale * (d / pinch.current.dist);
      setT((p) => ({ ...p, scale: Math.min(6, Math.max(0.4, s)) }));
    }
  };

  const filename = (p: Preset) =>
    `${campaign.slug}-${p.id}.png`;

  const doDownload = async () => {
    if (!photo) {
      setNote("Pilih foto dulu.");
      return;
    }
    setBusy(true);
    try {
      const blob = await exportBlob(input, preset);
      download(blob, filename(preset));
      await showResult(blob);
      ping(campaign.slug, "DOWNLOAD", preset.id);
      setNote(`Diunduh · ${preset.w}×${preset.h}`);
    } catch {
      setNote("Gagal menyimpan. Coba ukuran lain.");
    } finally {
      setBusy(false);
    }
  };

  const doDownloadAll = async () => {
    if (!photo) {
      setNote("Pilih foto dulu.");
      return;
    }
    setBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const p of PRESETS) {
        const blob = await exportBlob(input, p);
        zip.file(filename(p), blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      download(out, `${campaign.slug}-semua-ukuran.zip`);
      ping(campaign.slug, "DOWNLOAD", "all");
      setNote(`Tersimpan ${PRESETS.length} ukuran sebagai ZIP`);
    } catch {
      setNote("Gagal membuat ZIP.");
    } finally {
      setBusy(false);
    }
  };

  const doShare = async () => {
    if (!photo) {
      setNote("Pilih foto dulu.");
      return;
    }
    setBusy(true);
    try {
      const blob = await exportBlob(input, preset);
      const file = new File([blob], filename(preset), { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: campaign.title });
        ping(campaign.slug, "SHARE", preset.id);
      } else {
        // Desktop has no share sheet worth using; a download is the honest fallback.
        download(blob, filename(preset));
        await showResult(blob);
        ping(campaign.slug, "DOWNLOAD", preset.id);
        setNote("Perangkat ini tidak punya menu bagikan — file diunduh.");
      }
    } catch {
      /* user dismissed the sheet */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* ---- preview ---- */}
      <div>
        <div
          className="relative mx-auto w-full max-w-[28rem] border border-line bg-bg-card"
          style={{ aspectRatio: `${preset.w} / ${preset.h}` }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={
              photo
                ? `Pratinjau fotomu di bingkai ${campaign.title}`
                : `Bingkai ${campaign.title}, belum ada foto`
            }
            className="h-full w-full touch-none select-none"
            style={{ cursor: photo ? "grab" : "pointer" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onClick={() => {
              if (!photo) fileRef.current?.click();
            }}
          />
          {!photo && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-center"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-gold">
                Ketuk untuk pilih foto
              </span>
              <span className="max-w-[16rem] text-xs text-gray-2">
                Foto tidak diunggah ke mana pun. Semua diproses di perangkat ini.
              </span>
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            // Clear so choosing the same file again still fires a change.
            e.target.value = "";
            void pick(file);
          }}
        />

        {inApp && (
          <p className="mx-auto mt-3 max-w-[28rem] border border-line-strong bg-tint-gold-soft px-3 py-2 text-center text-[11px] text-gold">
            Kamu membuka halaman ini dari dalam aplikasi, yang sering memblokir unduhan.
            Kalau gagal, buka menu ⋮ lalu pilih &quot;Buka di browser&quot; (Chrome/Safari),
            atau tekan lama gambar hasil di bawah.
          </p>
        )}

        {note && (
          <p className="mx-auto mt-3 max-w-[28rem] text-center text-[11px] text-gold">{note}</p>
        )}

        {result && (
          <div className="mx-auto mt-3 max-w-[28rem] border border-line bg-bg-card p-3 text-center">
            <p className="mb-2 text-[11px] text-gray-2">
              File tidak muncul? <span className="text-gold">Tekan lama gambar ini</span> lalu
              pilih &quot;Simpan gambar&quot;.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt={`Hasil bingkai ${campaign.title}`} className="mx-auto w-full" />
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-2 font-mono text-[11px] uppercase tracking-wider text-gray-2 hover:text-gold"
            >
              Tutup
            </button>
          </div>
        )}

        {photo && (
          <div className="mx-auto mt-3 flex max-w-[28rem] items-center gap-3">
            <label className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
              Zoom
            </label>
            <input
              type="range"
              min={0.4}
              max={6}
              step={0.01}
              value={t.scale}
              aria-label="Zoom foto"
              onChange={(e) => setT((p) => ({ ...p, scale: Number(e.target.value) }))}
              className="h-1 flex-1 accent-gold"
            />
            <label className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
              Putar
            </label>
            <input
              type="range"
              min={-30}
              max={30}
              step={0.5}
              value={t.rotate}
              aria-label="Putar foto"
              onChange={(e) => setT((p) => ({ ...p, rotate: Number(e.target.value) }))}
              className="h-1 w-20 accent-gold"
            />
            <button
              type="button"
              onClick={() => setT(IDENTITY)}
              className="font-mono text-[11px] uppercase tracking-wider text-gold hover:text-gold-bright"
            >
              Reset
            </button>
          </div>
        )}
        {photo && (
          <div className="mx-auto mt-3 max-w-[28rem] text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-gold hover:bg-bg-hover"
            >
              Ganti foto
            </button>
          </div>
        )}
        <p className="mx-auto mt-2 max-w-[28rem] text-center text-[11px] text-gray-3">
          Geser untuk memindahkan · cubit atau scroll untuk zoom
        </p>
      </div>

      {/* ---- controls ---- */}
      <div className="space-y-5">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-2">
            Ukuran
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p)}
                className={`border px-2 py-2 text-left transition-colors ${
                  preset.id === p.id
                    ? "border-line-strong bg-tint-gold-soft text-gold"
                    : "border-line text-gray-2 hover:bg-bg-hover"
                }`}
              >
                <span className="block text-xs font-semibold">{p.label}</span>
                <span className="block font-mono text-[10px] text-gray-3">
                  {p.w}×{p.h}
                </span>
              </button>
            ))}
          </div>
        </div>

        {campaign.fields.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-2">
              Isi data
            </p>
            {campaign.fields.map((f) => (
              <label key={f.id} className="block">
                <span className="mb-1 block text-[11px] text-gray-2">{f.label}</span>
                <input
                  value={values.find((v) => v.id === f.id)?.value ?? ""}
                  onChange={(e) =>
                    setValues((prev) =>
                      prev.map((v) =>
                        v.id === f.id ? { ...v, value: e.target.value } : v,
                      ),
                    )
                  }
                  maxLength={60}
                  className="w-full border border-line bg-bg-elev px-2 py-2 text-sm text-gray-1 outline-none focus:border-line-strong"
                  placeholder={f.label}
                />
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {/* Until there is a photo the only useful action is picking one, so the
              primary button says that instead of offering a share that cannot work. */}
          {photo ? (
            <button
              type="button"
              disabled={busy}
              onClick={doShare}
              className="w-full border border-line-strong bg-tint-gold-soft px-4 py-3 text-sm font-semibold text-gold transition-colors hover:bg-tint-gold-hover disabled:opacity-50"
            >
              {busy ? "Memproses…" : "Bagikan"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-line-strong bg-tint-gold-soft px-4 py-3 text-sm font-semibold text-gold transition-colors hover:bg-tint-gold-hover"
            >
              Pilih foto
            </button>
          )}
          <button
            type="button"
            disabled={busy || !photo}
            onClick={doDownload}
            className="w-full border border-line px-4 py-3 text-sm text-gray-1 transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Unduh {preset.label} · {preset.w}×{preset.h}
          </button>
          <button
            type="button"
            disabled={busy || !photo}
            onClick={doDownloadAll}
            className="w-full px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-gray-2 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Unduh semua ukuran (ZIP)
          </button>
        </div>

        <CopyLink slug={campaign.slug} title={campaign.title} />

        <p className="border-t border-line pt-4 text-[11px] leading-relaxed text-gray-3">
          Tanpa watermark. Tanpa akun. Tanpa iklan. Foto kamu tidak pernah dikirim ke
          server mana pun — buka menu jaringan di browser dan lihat sendiri.
        </p>
      </div>
    </div>
  );
}
