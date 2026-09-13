import "server-only";
import { USING_DB, db } from "@/lib/store";
import { MEMO_PROGRAMS, STABLES, USDC_ATA, USDC_MINT, WALLET } from "./constants";
import { parseMemo } from "./memo";
import { getParsedTransaction, getSignatures, getTokenAccounts, type SignatureInfo } from "./solana";
import { incomingStables, memoOf } from "./transfers";

/* Ported from Portabase Sponsors. Same wallet, different memo prefix: only
   transactions whose memo mentions BINGKAI are ever fetched or credited. */

const MIN_INTERVAL_MS = 45_000;
const MAX_PAGES = 5;

/** Wallet + its USDC/USDT token accounts; the USDC account is hard-watched as a fallback. */
async function watchedAccounts(): Promise<Map<string, string>> {
  const accounts = new Map<string, string>([[USDC_ATA, USDC_MINT]]);
  await Promise.all(
    Object.keys(STABLES).map(async (mint) => {
      try {
        for (const acc of await getTokenAccounts(WALLET, mint)) accounts.set(acc, mint);
      } catch {
        /* keep the fallback */
      }
    }),
  );
  return accounts;
}

/**
 * New signatures for one address since the last scan. Pages back with `before` until
 * it reaches the saved cursor, so a busy shared wallet can't scroll a payment out of view.
 */
async function newSignatures(address: string, cursor: string | undefined) {
  const sigs: SignatureInfo[] = [];
  let before: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await getSignatures(address, { limit: 100, until: cursor, before });
    sigs.push(...batch);
    if (batch.length < 100 || !cursor) break; // first run: newest page only
    before = batch[batch.length - 1].signature;
  }
  return { sigs, newest: sigs[0]?.signature ?? cursor };
}

export type ScanResult = { skipped?: boolean; checked: number; credited: number; error?: string };

/** Throttled, single-flight scan. Safe to call from any request. */
export async function maybeScan(force = false): Promise<ScanResult> {
  if (!USING_DB) return { skipped: true, checked: 0, credited: 0 };
  const p = await db();
  // Claim the scan atomically: only one instance wins per interval.
  const cutoff = new Date(Date.now() - (force ? 5_000 : MIN_INTERVAL_MS));
  const claimed = await p.$queryRaw<unknown[]>`
    insert into scan_state (key, value, updated_at) values ('lock', 'scan', now())
    on conflict (key) do update set updated_at = now()
    where scan_state.updated_at < ${cutoff}
    returning key`;
  if (claimed.length === 0) return { skipped: true, checked: 0, credited: 0 };

  let checked = 0;
  let credited = 0;
  try {
    const accounts = await watchedAccounts();
    const addresses = [WALLET, ...accounts.keys()];
    const rows = await p.$queryRaw<{ key: string; value: string }[]>`
      select key, value from scan_state where key like 'cursor:%'`;
    const cursors = new Map(rows.map((r) => [r.key.slice(7), r.value]));

    const candidates = new Map<string, SignatureInfo>();
    for (const address of addresses) {
      const { sigs, newest } = await newSignatures(address, cursors.get(address));
      for (const s of sigs) {
        // getSignaturesForAddress returns the memo, so only memo'd Bingkai
        // transactions are fetched in full.
        if (!s.err && /BINGKAI/i.test(s.memo ?? "")) candidates.set(s.signature, s);
      }
      if (newest && newest !== cursors.get(address)) {
        await p.$executeRaw`insert into scan_state (key, value) values (${"cursor:" + address}, ${newest})
          on conflict (key) do update set value = excluded.value, updated_at = now()`;
      }
    }

    for (const info of candidates.values()) {
      checked++;
      const tx = await getParsedTransaction(info.signature);
      if (!tx || tx.meta?.err) continue;
      const target = parseMemo(memoOf(tx, MEMO_PROGRAMS, info.memo));
      if (!target) continue;
      const createdAt = new Date((info.blockTime ?? tx.blockTime ?? Date.now() / 1000) * 1000);
      for (const inc of incomingStables(tx, WALLET, accounts)) {
        let sponsorId: string | null = null;
        if (target.kind === "bid") {
          const exists = await p.$queryRaw<unknown[]>`select 1 from sponsors where id = ${target.sponsorId}`;
          sponsorId = exists.length ? target.sponsorId : null;
        }
        const kind = target.kind === "tip" ? "tip" : sponsorId ? "bid" : "bid_unknown_sponsor";
        credited += await p.$executeRaw`
          insert into sponsor_bids (signature, kind, sponsor_id, from_wallet, mint, amount, usd, created_at)
          values (${info.signature + ":" + inc.mint}, ${kind}, ${sponsorId}, ${inc.from}, ${inc.mint},
                  ${inc.amount}, ${inc.amount}, ${createdAt})
          on conflict (signature) do nothing`;
      }
    }

    // Sponsors that never paid are removed after a week so abandoned forms don't pile up.
    await p.$executeRaw`delete from sponsors s where s.created_at < now() - interval '7 days'
      and not exists (select 1 from sponsor_bids b where b.sponsor_id = s.id)`;
    return { checked, credited };
  } catch (err) {
    console.error("[scan] failed", err);
    return { checked, credited, error: err instanceof Error ? err.message : String(err) };
  }
}
