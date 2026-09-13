"use client";

/**
 * Everything an organiser can change after launch. The public link (slug) never changes,
 * so a frame fix or a typo fix reaches every supporter who already has the link.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadImage, type FieldSpec } from "@/lib/compose";
import {
  FieldsEditor,
  FrameDropzone,
  FramePreview,
  SaveLinkActions,
  type FrameState,
} from "@/components/FrameSetup";

type Editable = {
  slug: string;
  title: string;
  organiser: string | null;
  blurb: string | null;
  background: string;
  fields: FieldSpec[];
  frameData: string;
  frameW: number;
  frameH: number;
  closedAt: string | null;
};

const label = "font-mono text-[11px] uppercase tracking-wider text-gray-2";
const input =
  "w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong";

function Section({
  title,
  desc,
  children,
  danger,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={`space-y-4 border p-5 ${danger ? "border-down/40" : "border-line"}`}>
      <div className="space-y-1">
        <h2 className={`text-base font-bold ${danger ? "text-down" : "text-white"}`}>{title}</h2>
        {desc && <p className="text-[12px] leading-relaxed text-gray-3">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(j.error ?? "Terjadi kesalahan. Coba lagi."));
  return j;
}

const fmt = (iso: string) =>
  `${new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;

export default function CampaignSettings({
  manageKey,
  campaign,
  justRotated = false,
}: {
  manageKey: string;
  campaign: Editable;
  justRotated?: boolean;
}) {
  const router = useRouter();
  const api = `/api/kelola/${manageKey}`;

  // ---- details form ----
  const [saved, setSaved] = useState(campaign);
  const [title, setTitle] = useState(campaign.title);
  const [organiser, setOrganiser] = useState(campaign.organiser ?? "");
  const [blurb, setBlurb] = useState(campaign.blurb ?? "");
  const [background, setBackground] = useState(campaign.background);
  const [fields, setFields] = useState<FieldSpec[]>(campaign.fields);
  const [frame, setFrame] = useState<FrameState | null>(null);
  const [newFrame, setNewFrame] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSavedFrame = (c: Editable) =>
    loadImage(c.frameData)
      .then((img) => setFrame({ data: c.frameData, w: c.frameW, h: c.frameH, img }))
      .catch(() => setFrame(null));

  useEffect(() => {
    void loadSavedFrame(campaign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(
    () =>
      title !== saved.title ||
      organiser !== (saved.organiser ?? "") ||
      blurb !== (saved.blurb ?? "") ||
      background !== saved.background ||
      JSON.stringify(fields) !== JSON.stringify(saved.fields) ||
      newFrame,
    [title, organiser, blurb, background, fields, newFrame, saved],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const reset = () => {
    setTitle(saved.title);
    setOrganiser(saved.organiser ?? "");
    setBlurb(saved.blurb ?? "");
    setBackground(saved.background);
    setFields(saved.fields);
    setNewFrame(false);
    setWarning(null);
    void loadSavedFrame(saved);
    setMsg(null);
  };

  const save = async () => {
    if (!title.trim()) return setMsg({ ok: false, text: "Judul wajib diisi." });
    setBusy("save");
    setMsg(null);
    try {
      const body: Record<string, unknown> = { title, organiser, blurb, background, fields };
      if (newFrame && frame) Object.assign(body, { frameData: frame.data, frameW: frame.w, frameH: frame.h });
      await call(api, "PATCH", body);
      setSaved({
        ...saved,
        title: title.trim(),
        organiser: organiser.trim() || null,
        blurb: blurb.trim() || null,
        background,
        fields,
        ...(newFrame && frame ? { frameData: frame.data, frameW: frame.w, frameH: frame.h } : {}),
      });
      setTitle(title.trim());
      setOrganiser(organiser.trim());
      setBlurb(blurb.trim());
      setNewFrame(false);
      setWarning(null);
      setMsg({ ok: true, text: "Perubahan tersimpan. Pendukung langsung melihat versi baru." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal menyimpan." });
    } finally {
      setBusy(null);
    }
  };

  // ---- status ----
  const [closedAt, setClosedAt] = useState(campaign.closedAt);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const toggleClosed = async () => {
    setBusy("status");
    setStatusMsg(null);
    try {
      const j = await call(api, "PATCH", { closed: !closedAt });
      setClosedAt((j.closedAt as string | null) ?? null);
      router.refresh();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Gagal mengubah status.");
    } finally {
      setBusy(null);
    }
  };

  // ---- manage link ----
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [rotateAsk, setRotateAsk] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const rotate = async () => {
    setBusy("rotate");
    setLinkMsg(null);
    try {
      const j = await call(`${api}/rotate`, "POST");
      // Move to the new link so the tabs and every later save use the new key.
      router.replace(`${String(j.manageUrl)}/pengaturan?baru=1`);
    } catch (e) {
      setLinkMsg(e instanceof Error ? e.message : "Gagal membuat tautan baru.");
    } finally {
      setBusy(null);
    }
  };

  // ---- delete ----
  const [confirmText, setConfirmText] = useState("");
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const canDelete = confirmText.trim().toLowerCase() === saved.title.trim().toLowerCase();
  const remove = async () => {
    if (!canDelete) return;
    setBusy("delete");
    setDelMsg(null);
    try {
      await call(api, "DELETE");
      setDeleted(true);
    } catch (e) {
      setDelMsg(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(null);
    }
  };

  if (deleted) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold text-white">Kampanye dihapus.</h1>
        <p className="text-sm text-gray-2">
          &quot;{saved.title}&quot; beserta statistiknya sudah dihapus permanen. Tautan kampanye dan tautan
          kelola tidak berlaku lagi.
        </p>
        <a href="/buat" className="inline-block border border-line-strong bg-tint-gold-soft px-5 py-3 text-sm font-semibold text-gold">
          Buat kampanye baru
        </a>
      </div>
    );
  }

  const manageUrl = `${origin}/kelola/${manageKey}`;
  const shown = frame ?? null;

  return (
    <div className="max-w-3xl space-y-8 pb-24">
      <header className="space-y-2">
        <p className="eyebrow">Pengaturan</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{saved.title}</h1>
        <p className="text-[12px] text-gray-3">
          Tautan kampanye tidak berubah saat kamu menyimpan perubahan:{" "}
          <a href={`/k/${saved.slug}`} className="font-mono text-gold hover:text-gold-bright" target="_blank">
            /k/{saved.slug}
          </a>
        </p>
      </header>

      {/* ---- details ---- */}
      <Section title="Detail kampanye" desc="Perbaiki judul, keterangan, bingkai, atau kolom teks kapan saja.">
        <label className="block space-y-1">
          <span className={label}>Judul kampanye</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={label}>Penyelenggara</span>
            <input
              value={organiser}
              onChange={(e) => setOrganiser(e.target.value)}
              maxLength={80}
              placeholder="SMA Negeri 1"
              className={input}
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Warna latar</span>
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="h-[42px] w-full border border-line bg-bg-elev px-1"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className={label}>Keterangan singkat</span>
          <textarea
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            maxLength={280}
            rows={2}
            className={input}
          />
          <span className="block text-right font-mono text-[10px] text-gray-3">{blurb.length}/280</span>
        </label>

        <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <div className="space-y-2">
              <span className={label}>Bingkai (PNG transparan)</span>
              <FrameDropzone
                frame={shown}
                onFrame={(f, w) => {
                  setFrame(f);
                  setNewFrame(true);
                  setWarning(w);
                  setMsg(null);
                }}
                onError={(m) => setMsg({ ok: false, text: m })}
              />
              {warning && (
                <p className="border border-line-strong bg-tint-gold-soft px-3 py-2 text-[11px] text-gold">{warning}</p>
              )}
              {newFrame && (
                <p className="text-[11px] text-gray-3">Bingkai baru belum disimpan. Pendukung masih melihat bingkai lama.</p>
              )}
            </div>
            <FieldsEditor fields={fields} setFields={setFields} hasFrame={!!shown} />
          </div>
          <div className="md:sticky md:top-4 md:self-start">
            <p className={`${label} mb-2`}>Pratinjau</p>
            {shown ? (
              <FramePreview frame={shown} background={background} fields={fields} />
            ) : (
              <p className="text-xs text-gray-3">Memuat bingkai…</p>
            )}
          </div>
        </div>
      </Section>

      {/* ---- status ---- */}
      <Section
        title="Status kampanye"
        desc="Menutup kampanye tidak menghapus apa pun. Halaman tetap bisa dibuka dan bingkai tetap bisa dipakai, tapi pendukung melihat pemberitahuan bahwa kampanye sudah selesai."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-1">
            {closedAt ? (
              <>
                <span className="text-gray-2">●</span> Ditutup sejak {fmt(closedAt)}
              </>
            ) : (
              <>
                <span className="text-gold">●</span> Aktif
              </>
            )}
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={toggleClosed}
            className="border border-line px-4 py-2 text-sm text-gray-1 hover:bg-bg-hover disabled:opacity-50"
          >
            {busy === "status" ? "Memproses…" : closedAt ? "Buka kembali kampanye" : "Tutup kampanye"}
          </button>
        </div>
        {statusMsg && <p className="text-xs text-down">{statusMsg}</p>}
      </Section>

      {/* ---- manage link ---- */}
      <Section
        title="Tautan kelola"
        desc="Siapa pun yang memegang tautan ini bisa mengubah dan menghapus kampanye. Simpan di tempat aman, dan jangan bagikan di grup."
      >
        {justRotated && (
          <p className="border border-line-strong bg-tint-gold-soft px-3 py-2 text-[12px] text-gold">
            Tautan kelola baru sudah dibuat dan tautan lama tidak berlaku lagi. Simpan tautan baru di bawah ini
            sekarang.
          </p>
        )}
        <code className="block break-all border border-line bg-bg-elev px-3 py-2 font-mono text-[11px] text-gray-1">
          {manageUrl}
        </code>
        <SaveLinkActions url={manageUrl} title={saved.title} />
        <div className="border-t border-line pt-4">
          {!rotateAsk ? (
            <button
              type="button"
              onClick={() => setRotateAsk(true)}
              className="text-[12px] text-gray-2 underline-offset-2 hover:text-gold hover:underline"
            >
              Tautan kelola terlanjur dibagikan? Buat tautan baru
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-gray-1">
                Tautan kelola lama akan langsung mati, termasuk yang sudah kamu simpan atau bagikan. Tautan kampanye
                untuk pendukung tidak berubah.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={rotate}
                  className="border border-line-strong bg-tint-gold-soft px-4 py-2 text-sm text-gold disabled:opacity-50"
                >
                  {busy === "rotate" ? "Membuat…" : "Ya, buat tautan baru"}
                </button>
                <button type="button" onClick={() => setRotateAsk(false)} className="px-4 py-2 text-sm text-gray-2">
                  Batal
                </button>
              </div>
            </div>
          )}
          {linkMsg && <p className="mt-2 text-xs text-down">{linkMsg}</p>}
        </div>
      </Section>

      {/* ---- delete ---- */}
      <Section
        danger
        title="Hapus kampanye"
        desc="Menghapus bersifat permanen: bingkai, pengaturan, dan semua statistik hilang, dan tautan kampanye berhenti bekerja untuk semua orang. Kalau hanya ingin berhenti, pakai Tutup kampanye."
      >
        <label className="block space-y-1">
          <span className="text-[12px] text-gray-2">
            Ketik judul kampanye <span className="font-semibold text-white">{saved.title}</span> untuk konfirmasi
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={input}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={!canDelete || busy !== null}
          onClick={remove}
          className="border border-down/60 px-4 py-2 text-sm text-down hover:bg-down/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "delete" ? "Menghapus…" : "Hapus kampanye permanen"}
        </button>
        {delMsg && <p className="text-xs text-down">{delMsg}</p>}
      </Section>

      {/* ---- sticky save bar ---- */}
      {(dirty || msg) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg-elev/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className={`text-[12px] ${msg ? (msg.ok ? "text-gold" : "text-down") : "text-gray-1"}`}>
              {msg?.text ?? "Ada perubahan yang belum disimpan."}
            </p>
            <div className="flex gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy !== null}
                  className="px-4 py-2 text-sm text-gray-2 hover:text-white disabled:opacity-50"
                >
                  Batalkan
                </button>
              )}
              {dirty ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={busy !== null}
                  className="border border-line-strong bg-tint-gold-soft px-5 py-2 text-sm font-semibold text-gold hover:bg-tint-gold-hover disabled:opacity-50"
                >
                  {busy === "save" ? "Menyimpan…" : "Simpan perubahan"}
                </button>
              ) : (
                <button type="button" onClick={() => setMsg(null)} className="px-3 py-2 text-sm text-gray-2">
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
