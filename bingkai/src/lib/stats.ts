/**
 * Everything the manage page shows, derived from hourly counters only.
 *
 * The counters are the whole dataset on purpose (see the Event model), so every
 * metric here is a sum over hour buckets. Times are bucketed in WIB, which has no
 * daylight saving, so a fixed +7h offset is exact.
 */
import type { EventKind, Tally } from "@/lib/store";

const WIB_MS = 7 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;

/** YYYY-MM-DD of an instant, in WIB. */
export const wibDay = (ms: number) => new Date(ms + WIB_MS).toISOString().slice(0, 10);
/** 0-23 hour of an instant, in WIB. */
export const wibHour = (ms: number) => new Date(ms + WIB_MS).getUTCHours();

/** A supporter ends up with a finished photo by downloading it or sharing it. */
const isOutput = (k: EventKind) => k === "DOWNLOAD" || k === "SHARE";

export type Bar = { key: string; label: string; value: number; tip: string };

export function computeStats(rows: Tally[], createdAt: string | Date, now = Date.now()) {
  const sum = (pred: (r: Tally) => boolean) =>
    rows.filter(pred).reduce((a, r) => a + r.count, 0);
  const t = (k: EventKind) => sum((r) => r.kind === k);

  const views = t("VIEW");
  const picked = t("PHOTO_PICKED");
  const downloads = t("DOWNLOAD");
  const shares = t("SHARE");
  const outputs = downloads + shares;

  // Visits were counted from a later date than downloads on older campaigns, so the
  // funnel only uses hours on or after the first recorded visit.
  const first = (pred: (r: Tally) => boolean) =>
    rows.filter(pred).map((r) => r.hour).sort()[0] as string | undefined;
  const viewStart = first((r) => r.kind === "VIEW");
  const partialViews = !!viewStart && (first(() => true) ?? viewStart) < viewStart;
  const since = (k: (r: Tally) => boolean) =>
    viewStart ? sum((r) => k(r) && r.hour >= viewStart) : 0;
  const funnel = {
    views: since((r) => r.kind === "VIEW"),
    picked: since((r) => r.kind === "PHOTO_PICKED"),
    outputs: since((r) => isOutput(r.kind)),
  };

  const lastOutput = rows
    .filter((r) => isOutput(r.kind))
    .map((r) => r.hour)
    .sort()
    .at(-1);
  const lastAny = rows.map((r) => r.hour).sort().at(-1);

  // ---- activity over time: hourly for the first 3 days, daily after that ----
  const created = new Date(createdAt).getTime();
  const outRows = rows.filter((r) => isOutput(r.kind));
  const ageDays = (now - created) / (24 * HOUR_MS);
  let activity: { unit: "jam" | "hari"; bars: Bar[] };
  if (ageDays <= 3) {
    // A fixed window, not clamped to creation: a campaign a few hours old would
    // otherwise get four page-wide columns that read as a different chart.
    const start = now - (ageDays <= 1 ? 23 : 47) * HOUR_MS;
    const startHour = Math.floor(start / HOUR_MS) * HOUR_MS;
    const bars: Bar[] = [];
    for (let h = startHour; h <= now; h += HOUR_MS) {
      const iso = new Date(h).toISOString();
      const value = outRows
        .filter((r) => new Date(r.hour).getTime() === h)
        .reduce((a, r) => a + r.count, 0);
      const hh = String(wibHour(h)).padStart(2, "0");
      bars.push({
        key: iso,
        label: `${hh}`,
        value,
        tip: `${fmtDayShort(h)}, ${hh}.00–${String((wibHour(h) + 1) % 24).padStart(2, "0")}.00 WIB`,
      });
    }
    activity = { unit: "jam", bars };
  } else {
    const days = Math.min(30, Math.ceil(ageDays));
    const bars: Bar[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const ms = now - i * 24 * HOUR_MS;
      const day = wibDay(ms);
      const value = outRows
        .filter((r) => wibDay(new Date(r.hour).getTime()) === day)
        .reduce((a, r) => a + r.count, 0);
      bars.push({ key: day, label: day.slice(8), value, tip: fmtDayShort(ms) });
    }
    activity = { unit: "hari", bars };
  }

  // ---- today vs yesterday, in WIB days ----
  const today = wibDay(now);
  const yesterday = wibDay(now - 24 * HOUR_MS);
  const onDay = (d: string) =>
    outRows.filter((r) => wibDay(new Date(r.hour).getTime()) === d).reduce((a, r) => a + r.count, 0);

  // ---- busiest hour of day across the whole campaign ----
  const byHour = new Array(24).fill(0) as number[];
  for (const r of outRows) byHour[wibHour(new Date(r.hour).getTime())] += r.count;
  const peakValue = Math.max(...byHour);
  const peakHour = peakValue > 0 ? byHour.indexOf(peakValue) : null;

  // ---- busiest single day ----
  const byDay = new Map<string, number>();
  for (const r of outRows) {
    const d = wibDay(new Date(r.hour).getTime());
    byDay.set(d, (byDay.get(d) ?? 0) + r.count);
  }
  const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const activeHours = new Set(outRows.filter((r) => r.count > 0).map((r) => r.hour)).size;

  return {
    views,
    picked,
    downloads,
    shares,
    outputs,
    viewStart,
    partialViews,
    funnel,
    lastOutput,
    lastAny,
    activity,
    today: onDay(today),
    yesterday: onDay(yesterday),
    peakHour,
    peakValue,
    byHour,
    bestDay,
    activeDays: byDay.size,
    activeHours,
  };
}

const fmtDayShort = (ms: number) =>
  new Date(ms).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
