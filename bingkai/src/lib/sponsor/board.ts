import "server-only";
import { USING_DB, db } from "@/lib/store";
import { BID_WINDOW_DAYS, MIN_TOTAL_USD, SLOT_COUNT } from "./constants";

export type Slot = {
  rank: number;
  id: string;
  name: string;
  tagline: string;
  url: string;
  /** Same-origin path, cache-busted by the logo hash. */
  logo: string;
  totalUsd: number;
};

type Row = { id: string; name: string; tagline: string; url: string; logo_hash: string; total: number };

const windowStart = () => new Date(Date.now() - BID_WINDOW_DAYS * 86400_000);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Live leaderboard: bids from the last 30 days, at least $5, top 5, earliest tie wins. */
export async function getBoard(): Promise<Slot[]> {
  if (!USING_DB) return [];
  const p = await db();
  const rows = await p.$queryRaw<Row[]>`
    select s.id, s.name, s.tagline, s.url, s.logo_hash, sum(b.usd) as total
    from sponsors s
    join sponsor_bids b on b.sponsor_id = s.id and b.kind = 'bid' and b.created_at > ${windowStart()}
    where not s.hidden
    group by s.id
    having sum(b.usd) >= ${MIN_TOTAL_USD}
    order by total desc, min(b.created_at) asc
    limit ${SLOT_COUNT}`;
  return rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    url: r.url,
    logo: `/api/sponsor/logo/${r.id}?v=${r.logo_hash}`,
    totalUsd: round2(Number(r.total)),
  }));
}

let cached: { at: number; board: Promise<Slot[]> } | null = null;

/**
 * For pages that render on every request (campaign pages): one board query per
 * minute per server instance. Failures show no ads rather than breaking the page.
 */
export function getBoardCached(): Promise<Slot[]> {
  if (!cached || Date.now() - cached.at > 60_000) {
    const board = getBoard().catch((e) => {
      console.error("[sponsor] board failed", e);
      cached = null;
      return [] as Slot[];
    });
    cached = { at: Date.now(), board };
  }
  return cached.board;
}

/** What it takes to get onto the board right now. */
export function priceToEnter(board: Slot[]): number {
  if (board.length < SLOT_COUNT) return MIN_TOTAL_USD;
  return Math.ceil(board[board.length - 1].totalUsd + 1);
}

export type SponsorStatus = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  logo: string;
  hidden: boolean;
  totalUsd: number;
  rank: number | null;
  bids: { amount: number; mint: string; at: string }[];
};

export async function getSponsorStatus(id: string): Promise<SponsorStatus | null> {
  if (!USING_DB) return null;
  const p = await db();
  const rows = await p.$queryRaw<(Omit<Row, "total"> & { hidden: boolean })[]>`
    select id, name, tagline, url, logo_hash, hidden from sponsors where id = ${id}`;
  const s = rows[0];
  if (!s) return null;
  const bids = await p.$queryRaw<{ amount: number; mint: string; created_at: Date }[]>`
    select amount, mint, created_at from sponsor_bids
    where sponsor_id = ${id} and kind = 'bid' and created_at > ${windowStart()}
    order by created_at desc limit 50`;
  const board = await getBoard();
  return {
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    url: s.url,
    logo: `/api/sponsor/logo/${s.id}?v=${s.logo_hash}`,
    hidden: s.hidden,
    totalUsd: round2(bids.reduce((a, b) => a + Number(b.amount), 0)),
    rank: board.find((b) => b.id === id)?.rank ?? null,
    bids: bids.map((b) => ({ amount: Number(b.amount), mint: b.mint, at: new Date(b.created_at).toISOString() })),
  };
}
