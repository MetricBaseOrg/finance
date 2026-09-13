/**
 * The compositing engine. Runs ONLY in the browser, on purpose.
 *
 * This is the whole product argument. Twibbonize and everything like it uploads the
 * supporter's photo to a server, composites it there, and hands back a JPEG. That
 * means a stranger's face sits on someone else's disk, the round trip needs a decent
 * connection, and the operator can put a watermark on the result because they own the
 * pixels.
 *
 * Here the frame PNG is the only thing that travels, and it travels *to* the device.
 * The photo is read with FileReader, drawn to a canvas, and exported with
 * `canvas.toBlob`. No upload, no queue, no server cost per supporter, and nothing to
 * leak. It also means the editor works on a bad conference wifi or fully offline once
 * the page is cached, which is exactly when these campaigns get shared.
 */

export type Preset = {
  id: string;
  label: string;
  w: number;
  h: number;
  note?: string;
};

/** Export sizes people actually need, rather than one square and good luck. */
export const PRESETS: Preset[] = [
  { id: "square", label: "Feed", w: 1080, h: 1080, note: "Instagram, Facebook, X" },
  { id: "story", label: "Story", w: 1080, h: 1920, note: "IG & FB Story, WA Status" },
  { id: "portrait", label: "Portrait", w: 1080, h: 1350, note: "Instagram 4:5" },
  { id: "wide", label: "Wide", w: 1200, h: 630, note: "LinkedIn, link preview" },
  { id: "profile", label: "Profile", w: 800, h: 800, note: "Avatar / PP" },
  { id: "print", label: "Print", w: 2400, h: 2400, note: "300 dpi at 8 inch" },
];

export type TextValue = { id: string; value: string };

export type FieldSpec = {
  id: string;
  label: string;
  /** Fractions of the canvas, so one spec works at every export size. */
  x: number;
  y: number;
  size: number;
  color: string;
  weight: number;
  align: CanvasTextAlign;
  font: string;
  maxWidth: number;
  uppercase?: boolean;
};

export type Transform = { scale: number; dx: number; dy: number; rotate: number };

export const IDENTITY: Transform = { scale: 1, dx: 0, dy: 0, rotate: 0 };

export type ComposeInput = {
  photo: HTMLImageElement | null;
  frame: HTMLImageElement | null;
  transform: Transform;
  fields: FieldSpec[];
  values: TextValue[];
  /** Behind a transparent frame; shows through wherever the photo does not reach. */
  background: string;
};

/**
 * Cover-fit the photo, then apply the user's transform on top.
 *
 * Cover rather than contain because a frame is a window: letterboxing a photo inside
 * a campaign frame looks broken, and every supporter would have to fix it by hand.
 */
export function coverRect(
  iw: number,
  ih: number,
  cw: number,
  ch: number,
  t: Transform,
) {
  const base = Math.max(cw / iw, ch / ih);
  const s = base * t.scale;
  const w = iw * s;
  const h = ih * s;
  return {
    x: (cw - w) / 2 + t.dx * cw,
    y: (ch - h) / 2 + t.dy * ch,
    w,
    h,
  };
}

/** Draw one composite at an arbitrary size. Used for both preview and export. */
export function draw(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  input: ComposeInput,
) {
  const { photo, frame, transform, fields, values, background } = input;

  ctx.save();
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, cw, ch);

  if (photo && photo.naturalWidth > 0) {
    const r = coverRect(photo.naturalWidth, photo.naturalHeight, cw, ch, transform);
    if (transform.rotate) {
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((transform.rotate * Math.PI) / 180);
      ctx.translate(-cw / 2, -ch / 2);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, r.x, r.y, r.w, r.h);
    if (transform.rotate) ctx.restore();
  }

  // The frame is stretched to the full canvas deliberately. A campaign frame is
  // authored for one aspect; when the supporter picks a different export size we
  // want the frame to still occupy the whole image rather than float in the middle.
  if (frame && frame.naturalWidth > 0) {
    ctx.drawImage(frame, 0, 0, cw, ch);
  }

  for (const f of fields) {
    const raw = values.find((v) => v.id === f.id)?.value ?? "";
    if (!raw.trim()) continue;
    const text = f.uppercase ? raw.toUpperCase() : raw;
    // Sizes are fractions of the canvas height, so the same field spec renders
    // correctly whether this is a 1080 preview or a 2400 print export.
    const px = Math.round(f.size * ch);
    ctx.font = `${f.weight} ${px}px ${f.font}`;
    ctx.fillStyle = f.color;
    ctx.textAlign = f.align;
    ctx.textBaseline = "middle";
    const max = f.maxWidth * cw;
    let shown = text;
    // Shrink to fit rather than clip: a name that overflows the frame is worse than
    // a slightly smaller name, and clipping someone's name is the one thing a
    // graduation campaign cannot do.
    let size = px;
    while (size > 8 && ctx.measureText(shown).width > max) {
      size -= 1;
      ctx.font = `${f.weight} ${size}px ${f.font}`;
    }
    ctx.fillText(shown, f.x * cw, f.y * ch, max);
  }

  ctx.restore();
}

/** Render a composite at a preset size and hand back a PNG blob. */
export async function exportBlob(
  input: ComposeInput,
  preset: Preset,
  type: "image/png" | "image/jpeg" = "image/png",
  quality = 0.94,
): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = preset.w;
  c.height = preset.h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  draw(ctx, preset.w, preset.h, input);
  const blob = await new Promise<Blob | null>((res) =>
    c.toBlob((b) => res(b), type, quality),
  );
  if (!blob) throw new Error("export failed");
  return blob;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image load failed"));
    img.src = src;
  });
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error("read failed"));
    fr.readAsDataURL(file);
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick; revoking synchronously cancels the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * In-app browsers (Instagram, Facebook, TikTok, LINE, and WhatsApp/others on iOS) ignore
 * `<a download>` on a blob URL without any error, so the button looks dead. These links
 * mostly arrive through exactly those apps.
 */
export function isInAppBrowser(ua: string) {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|WhatsApp|Snapchat|Twitter|; wv\)/i.test(
    ua,
  );
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

/**
 * Parse a CSV for bulk generation. Deliberately small: a header row plus one row per
 * person. Organisers keep these lists in Excel, and "export as CSV" is the one thing
 * every version of Excel can do.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === "," || ch === ";") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}
