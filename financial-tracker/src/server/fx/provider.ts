import "server-only";
import Decimal from "decimal.js";
import { db } from "@/server/db";

const FX_PROVIDER_URL =
  process.env.FX_PROVIDER_URL ?? "https://api.frankfurter.app";

/**
 * Returns the rate `1 base = X quote` for `on` date.
 * Looks up cached FxRate row first; falls back to Frankfurter API and
 * upserts the result so we never hit the network twice for the same date.
 *
 * Same-currency (base === quote) short-circuits to 1.
 */
export async function getFxRate(
  base: string,
  quote: string,
  on: Date,
): Promise<Decimal> {
  if (base === quote) return new Decimal(1);

  const dayStart = new Date(
    Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()),
  );

  // 1. Cached row?
  const cached = await db.fxRate.findUnique({
    where: { base_quote_date: { base, quote, date: dayStart } },
  });
  if (cached) return new Decimal(cached.rate.toString());

  // 2. Fetch from Frankfurter. Frankfurter accepts ISO dates and yields:
  //    { date, base, rates: { QUOTE: number } }
  //    Future dates fall back to "latest".
  const isPast = dayStart < startOfToday();
  const path = isPast ? dayStart.toISOString().slice(0, 10) : "latest";
  const url = `${FX_PROVIDER_URL}/${path}?from=${base}&to=${quote}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`FX lookup failed: ${base}->${quote} on ${path} (${res.status})`);
  }
  const json = (await res.json()) as {
    date: string;
    rates: Record<string, number>;
  };
  const value = json.rates?.[quote];
  if (typeof value !== "number") {
    throw new Error(`FX response missing rate for ${quote}: ${JSON.stringify(json)}`);
  }
  const rate = new Decimal(value);

  // 3. Upsert snapshot
  await db.fxRate.upsert({
    where: { base_quote_date: { base, quote, date: dayStart } },
    create: {
      base,
      quote,
      rate: rate.toString(),
      date: dayStart,
      source: "frankfurter",
    },
    update: {},
  });

  return rate;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
