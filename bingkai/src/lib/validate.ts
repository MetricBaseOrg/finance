/**
 * Input rules shared by campaign creation and campaign editing, so a value that is
 * rejected on /buat cannot sneak in through /kelola, and the messages match.
 */
import type { FieldSpec } from "@/lib/store";

/**
 * Hard cap on the decoded PNG, so an oversized frame fails fast with a clear message.
 *
 * 3 MB, not 5. The frame travels as base64 inside a JSON body, which inflates it by a
 * third: a 5 MB PNG arrives as a ~6.7 MB request. Vercel rejects any function request
 * over 4.5 MB before the handler runs, so the organiser would see a raw platform 413
 * in English instead of our message. 3 MB encodes to ~4.0 MB and leaves room for the
 * other fields. A 1080x1080 transparent frame is typically well under 1.5 MB.
 */
export const MAX_FRAME_BYTES = 3 * 1024 * 1024;

export const LIMITS = { title: 120, organiser: 80, blurb: 280, fields: 3, fieldLabel: 40 } as const;

/** Returns an Indonesian error message, or null when the frame is acceptable. */
export function frameError(frameData: string): string | null {
  if (!frameData.startsWith("data:image/png")) return "Bingkai harus PNG transparan.";
  // base64 is 4 chars per 3 bytes; estimate before we hand it to the DB.
  const approx = Math.floor((frameData.length - frameData.indexOf(",") - 1) * 0.75);
  if (approx > MAX_FRAME_BYTES) return "Bingkai terlalu besar. Maksimal 3 MB.";
  return null;
}

/** Trimmed text, cut to `max`, or null when empty. */
export function cleanText(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

export function cleanColor(v: unknown, fallback: string): string {
  const s = String(v ?? "");
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

export function cleanDimension(v: unknown, fallback = 1080): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 64 && n <= 5000 ? n : fallback;
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/**
 * Text layers are drawn straight into a canvas on every supporter's device, so every
 * number is clamped and the font is fixed rather than trusting what the client sent.
 */
export function cleanFields(v: unknown): FieldSpec[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, LIMITS.fields).map((raw, i): FieldSpec => {
    const f = (raw ?? {}) as Record<string, unknown>;
    const align = f.align === "left" || f.align === "right" ? f.align : "center";
    return {
      id: /^[\w-]{1,24}$/.test(String(f.id)) ? String(f.id) : `f${i + 1}`,
      label: cleanText(f.label, LIMITS.fieldLabel) ?? `Kolom ${i + 1}`,
      x: clamp(f.x, 0, 1, 0.5),
      y: clamp(f.y, 0, 1, 0.88),
      size: clamp(f.size, 0.01, 0.15, 0.045),
      color: cleanColor(f.color, "#ffffff"),
      weight: [400, 500, 600, 700, 800].includes(Number(f.weight)) ? Number(f.weight) : 700,
      align,
      font: "Manrope, sans-serif",
      maxWidth: clamp(f.maxWidth, 0.1, 1, 0.8),
      uppercase: Boolean(f.uppercase),
    };
  });
}

/** Directory categories. Stored as the id; the label is what people see. */
export const CATEGORIES = [
  { id: "pendidikan", label: "Pendidikan" },
  { id: "perusahaan", label: "Perusahaan" },
  { id: "komunitas", label: "Komunitas" },
  { id: "keagamaan", label: "Keagamaan" },
  { id: "pemerintah", label: "Pemerintah" },
  { id: "olahraga", label: "Olahraga" },
  { id: "acara", label: "Acara" },
  { id: "lainnya", label: "Lainnya" },
] as const;

export function cleanCategory(v: unknown): string | null {
  const s = String(v ?? "");
  return CATEGORIES.some((c) => c.id === s) ? s : null;
}
