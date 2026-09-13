/* Incoming stablecoin transfers in a parsed transaction. Pure, so it is unit tested.

   Ported from PumpBid's hard-won fix: an SPL transfer instruction names the
   receiving TOKEN ACCOUNT, never the owning wallet, so we match on the wallet's
   known stablecoin accounts and on token-balance deltas owned by the wallet. */
import { STABLES } from "./constants";
import type { ParsedIx, ParsedTx } from "./solana";

export type Incoming = { mint: string; amount: number; from: string };

const pubkeyOf = (k: string | { pubkey: string } | undefined) => (!k ? "" : typeof k === "string" ? k : k.pubkey);

function allInstructions(tx: ParsedTx): ParsedIx[] {
  const top = tx.transaction?.message?.instructions ?? [];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions);
  return [...top, ...inner];
}

function signerOf(tx: ParsedTx, exclude: string): string {
  for (const key of tx.transaction?.message?.accountKeys ?? []) {
    if (typeof key === "object" && key.signer && key.pubkey !== exclude) return key.pubkey;
  }
  return pubkeyOf(tx.transaction?.message?.accountKeys?.[0]) || "unknown";
}

/**
 * @param wallet    receiving wallet
 * @param accounts  the wallet's stablecoin token accounts -> mint
 */
export function incomingStables(tx: ParsedTx, wallet: string, accounts: Map<string, string>): Incoming[] {
  const keys = tx.transaction?.message?.accountKeys ?? [];
  if (pubkeyOf(keys[0]) === wallet) return []; // we paid the fee: an outgoing tx
  const sender = signerOf(tx, wallet);
  const found: Incoming[] = [];

  for (const ix of allInstructions(tx)) {
    if (!ix.parsed || typeof ix.parsed !== "object") continue;
    const rec = ix.parsed as { type?: string; info?: Record<string, unknown> };
    const info = rec.info ?? {};
    const dest = String(info.destination ?? "");
    const mint = accounts.get(dest);
    if (!mint || dest === info.source) continue;
    const stable = STABLES[mint];
    if (rec.type === "transfer" && info.amount != null) {
      const raw = Number(info.amount);
      if (Number.isFinite(raw) && raw > 0) {
        found.push({ mint, amount: raw / 10 ** stable.decimals, from: String(info.authority ?? sender) });
      }
    } else if (rec.type === "transferChecked") {
      const t = info.tokenAmount as { uiAmount?: number; uiAmountString?: string } | undefined;
      const ui = Number(t?.uiAmountString ?? t?.uiAmount ?? 0);
      const m = typeof info.mint === "string" ? info.mint : mint;
      if (ui > 0 && STABLES[m]) found.push({ mint: m, amount: ui, from: String(info.authority ?? sender) });
    }
  }

  // Balance deltas catch transfers routed through programs we don't parse.
  const pre = tx.meta?.preTokenBalances ?? [];
  for (const post of tx.meta?.postTokenBalances ?? []) {
    if (!STABLES[post.mint]) continue;
    const account = pubkeyOf(keys[post.accountIndex]);
    if (post.owner !== wallet && !accounts.has(account)) continue;
    const before = pre.find((p) => p.accountIndex === post.accountIndex && p.mint === post.mint);
    const delta =
      Number(post.uiTokenAmount.uiAmountString ?? post.uiTokenAmount.uiAmount ?? 0) -
      Number(before?.uiTokenAmount.uiAmountString ?? before?.uiTokenAmount.uiAmount ?? 0);
    if (delta > 0) found.push({ mint: post.mint, amount: delta, from: sender });
  }

  // One credit per mint per transaction, keeping the largest reading (instruction and
  // balance delta usually both see the same transfer).
  const byMint = new Map<string, Incoming>();
  for (const f of found) {
    if (!Number.isFinite(f.amount) || f.amount <= 0) continue;
    const prev = byMint.get(f.mint);
    if (!prev || f.amount > prev.amount) byMint.set(f.mint, { ...f, amount: Math.round(f.amount * 1e6) / 1e6 });
  }
  return [...byMint.values()];
}

export function memoOf(tx: ParsedTx, memoPrograms: Set<string>, fallback: string | null): string | null {
  for (const ix of allInstructions(tx)) {
    if (ix.program === "spl-memo" || (ix.programId && memoPrograms.has(ix.programId))) {
      if (typeof ix.parsed === "string") return ix.parsed;
    }
  }
  for (const line of tx.meta?.logMessages ?? []) {
    const m = line.match(/Memo \(len \d+\):\s+"([\s\S]*)"/);
    if (m?.[1]) return m[1];
  }
  return fallback;
}
