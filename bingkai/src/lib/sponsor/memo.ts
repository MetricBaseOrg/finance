/** Memo parsing, kept pure so it can be tested without a database or RPC. */

export type MemoTarget = { kind: "bid"; sponsorId: string } | { kind: "tip" } | null;

const SPONSOR_ID = /^bsp_[0-9a-f]{16}$/;

/**
 * Accepts `BINGKAI bsp_<16 hex>` and `BINGKAI TIP`, case-insensitive, with the `[len]`
 * prefix that getSignaturesForAddress puts in front of memos. Anything else, including
 * Portabase's `PORTABASE …` and PumpBid's `BID …` memos, returns null.
 */
export function parseMemo(memo: string | null | undefined): MemoTarget {
  if (!memo) return null;
  const text = memo.replace(/^\s*\[\d+\]\s*/, "").trim();
  // "+" too: a wallet that form-decodes the Solana Pay link can write it literally.
  const m = text.match(/^BINGKAI[\s:+]+([^\s+]+)\s*$/i);
  if (!m) return null;
  const arg = m[1].toLowerCase();
  if (arg === "tip") return { kind: "tip" };
  if (SPONSOR_ID.test(arg)) return { kind: "bid", sponsorId: arg };
  return null;
}

export function isSponsorId(id: string): boolean {
  return SPONSOR_ID.test(id);
}

export function newSponsorId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "bsp_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
