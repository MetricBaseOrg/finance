"use client";

/**
 * Public directory of open campaigns: search, sort and filter entirely in the browser
 * over the list the server rendered, so every keystroke is instant and the campaign
 * links are in the HTML for search engines.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DirectoryEntry } from "@/lib/store";

type Category = { id: string; label: string };
type Sort = "populer" | "terbaru" | "az";
type Shape = "" | DirectoryEntry["shape"];

const PAGE = 12;
const SHAPES: { id: Shape; label: string }[] = [
  { id: "", label: "Semua bentuk" },
  { id: "square", label: "Persegi" },
  { id: "portrait", label: "Potret" },
  { id: "landscape", label: "Lanskap" },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const ctl =
  "border border-line bg-bg-elev px-3 py-2.5 text-sm text-gray-1 outline-none focus:border-line-strong";

export default function CampaignDirectory({
  campaigns,
  categories,
}: {
  campaigns: DirectoryEntry[];
  categories: readonly Category[];
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("populer");
  const [cat, setCat] = useState("");
  const [shape, setShape] = useState<Shape>("");
  const [nameOnly, setNameOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const labelOf = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);
  // Campaign count per category, shown next to each option.
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of campaigns) if (c.category) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [campaigns]);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const list = campaigns.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (shape && c.shape !== shape) return false;
      if (nameOnly && !c.hasNameField) return false;
      if (!terms.length) return true;
      const hay = norm(`${c.title} ${c.organiser ?? ""}`);
      return terms.every((t) => hay.includes(t));
    });
    const by: Record<Sort, (a: DirectoryEntry, b: DirectoryEntry) => number> = {
      populer: (a, b) => b.downloads - a.downloads || b.createdAt.localeCompare(a.createdAt),
      terbaru: (a, b) => b.createdAt.localeCompare(a.createdAt),
      az: (a, b) => a.title.localeCompare(b.title, "id"),
    };
    return list.sort(by[sort]);
  }, [campaigns, q, sort, cat, shape, nameOnly]);

  const filtered = Boolean(q || cat || shape || nameOnly);
  const reset = () => {
    setQ("");
    setCat("");
    setShape("");
    setNameOnly(false);
    setShown(PAGE);
  };
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE);
  };

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="space-y-3 border border-line bg-bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Cari kampanye</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => touch(setQ)(e.target.value)}
              placeholder="Cari judul atau penyelenggara…"
              className={`${ctl} w-full pl-9`}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray-3">Urutkan</span>
            <select value={sort} onChange={(e) => touch(setSort)(e.target.value as Sort)} className={`${ctl} flex-1 sm:flex-none`}>
              <option value="populer">Terpopuler</option>
              <option value="terbaru">Terbaru</option>
              <option value="az">Judul A–Z</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cat}
            onChange={(e) => touch(setCat)(e.target.value)}
            className={`${ctl} !py-2 text-[13px]`}
            aria-label="Kategori"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {catCounts.get(c.id) ? ` (${catCounts.get(c.id)})` : ""}
              </option>
            ))}
          </select>
          <select
            value={shape}
            onChange={(e) => touch(setShape)(e.target.value as Shape)}
            className={`${ctl} !py-2 text-[13px]`}
            aria-label="Bentuk bingkai"
          >
            {SHAPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={nameOnly}
            onClick={() => touch(setNameOnly)(!nameOnly)}
            className={`border px-3 py-2 text-[13px] transition-colors ${
              nameOnly
                ? "border-line-strong bg-tint-gold-soft text-gold"
                : "border-line bg-bg-elev text-gray-2 hover:text-gray-1"
            }`}
          >
            {nameOnly ? "✓ " : ""}Punya kolom nama
          </button>
          {filtered && (
            <button type="button" onClick={reset} className="px-2 py-2 text-[12px] text-gray-3 hover:text-gold">
              Hapus filter
            </button>
          )}
          <span className="ml-auto font-mono text-[11px] text-gray-3">
            {results.length} kampanye
          </span>
        </div>
      </div>

      {/* results */}
      {results.length === 0 ? (
        <div className="border border-dashed border-line px-5 py-12 text-center">
          <p className="text-sm text-gray-1">
            {campaigns.length === 0 ? "Belum ada kampanye aktif." : "Tidak ada kampanye yang cocok."}
          </p>
          <p className="mt-1 text-[12px] text-gray-3">
            {campaigns.length === 0 || !filtered ? (
              <>
                Jadilah yang pertama.{" "}
                <Link href="/buat" className="text-gold hover:text-gold-bright">
                  Buat kampanye →
                </Link>
              </>
            ) : (
              <button type="button" onClick={reset} className="text-gold hover:text-gold-bright">
                Hapus semua filter
              </button>
            )}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {results.slice(0, shown).map((c) => (
            <li key={c.slug}>
              <Link
                href={`/k/${c.slug}`}
                className="group flex h-full flex-col border border-line bg-bg-card transition-colors hover:border-line-strong"
              >
                <div className="relative aspect-square overflow-hidden bg-bg-elev">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/thumb/${c.slug}?v=${c.version}`}
                    alt={`Bingkai ${c.title}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {c.hasNameField && (
                    <span className="absolute left-2 top-2 bg-black/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gold">
                      + Nama
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white group-hover:text-gold">
                    {c.title}
                  </p>
                  {c.organiser && <p className="truncate text-[11px] text-gray-2">{c.organiser}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2 font-mono text-[10px] uppercase tracking-wider text-gray-3">
                    <span className="truncate">{c.category ? labelOf.get(c.category) : "Kampanye"}</span>
                    <span className="shrink-0" title="Jumlah unduhan">
                      ↓ {c.downloads.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {results.length > shown && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="border border-line px-5 py-2.5 text-sm text-gray-1 hover:border-line-strong hover:text-gold"
          >
            Tampilkan lebih banyak ({results.length - shown} lagi)
          </button>
        </div>
      )}
    </div>
  );
}
