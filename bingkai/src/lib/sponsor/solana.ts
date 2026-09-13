import "server-only";

/* Minimal Solana JSON-RPC client, ported from PumpBid: public RPC fallbacks and a
   User-Agent header, because several public RPCs silently drop requests without one. */

const FALLBACK_RPCS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
  "https://solana.drpc.org",
  "https://rpc.ankr.com/solana",
];

function rpcUrls(): string[] {
  const extra = [process.env.SOLANA_RPC_URL].filter((u): u is string => Boolean(u && u.startsWith("http")));
  return [...new Set([...extra, ...FALLBACK_RPCS])];
}

const HEADERS = {
  "content-type": "application/json",
  accept: "application/json",
  "user-agent": "BingkaiSponsors/1.0 (https://bingkai.metricbase.org)",
};

async function rpc<T>(method: string, params: unknown[], opts: { distrustEmpty?: boolean } = {}): Promise<T> {
  let lastErr: Error | null = null;
  let empty: T | null = null;
  for (const url of rpcUrls()) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`rpc ${res.status}`);
      const json = (await res.json()) as { result?: T; error?: { message?: string } };
      if (json.error) throw new Error(json.error.message ?? "rpc error");
      // Some public RPCs answer history queries with an empty list instead of an
      // error (publicnode did for this wallet), which would silently hide every
      // payment. Only believe "empty" once every RPC agrees.
      if (opts.distrustEmpty && Array.isArray(json.result) && json.result.length === 0) {
        empty = json.result as T;
        continue;
      }
      return json.result as T;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  if (empty !== null) return empty;
  throw lastErr ?? new Error("rpc failed");
}

export type SignatureInfo = { signature: string; blockTime: number | null; err: unknown; memo: string | null };

export async function getSignatures(address: string, opts: { limit?: number; until?: string; before?: string } = {}) {
  const rows = await rpc<Array<{ signature: string; blockTime?: number | null; err: unknown; memo?: string | null }>>(
    "getSignaturesForAddress",
    [address, { limit: opts.limit ?? 100, until: opts.until, before: opts.before, commitment: "confirmed" }],
    // With a cursor, "nothing new" is the normal answer; without one it's suspicious.
    { distrustEmpty: !opts.until },
  );
  return (rows ?? []).map<SignatureInfo>((r) => ({
    signature: r.signature,
    blockTime: r.blockTime ?? null,
    err: r.err,
    memo: r.memo ?? null,
  }));
}

type TokenAccountList = {
  value: Array<{ pubkey: string; account: { data: { parsed: { info: { mint: string; tokenAmount: { decimals: number } } } } } }>;
};

/** Token accounts of `owner` for `mint`. SPL transfers name these, never the owner. */
export async function getTokenAccounts(owner: string, mint: string): Promise<string[]> {
  const list = await rpc<TokenAccountList>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return (list?.value ?? []).map((a) => a.pubkey);
}

export type ParsedIx = { program?: string; programId?: string; parsed?: unknown };
export type TokenBal = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { uiAmount: number | null; decimals: number; uiAmountString?: string };
};
export type ParsedTx = {
  blockTime?: number | null;
  meta?: {
    err: unknown;
    preTokenBalances?: TokenBal[];
    postTokenBalances?: TokenBal[];
    innerInstructions?: Array<{ instructions: ParsedIx[] }>;
    logMessages?: string[];
  };
  transaction?: { message?: { accountKeys?: Array<string | { pubkey: string; signer?: boolean }>; instructions?: ParsedIx[] } };
};

export async function getParsedTransaction(signature: string): Promise<ParsedTx | null> {
  try {
    return await rpc<ParsedTx | null>("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
    ]);
  } catch {
    return null;
  }
}

export function pubkeyOf(key: string | { pubkey: string } | undefined): string {
  if (!key) return "";
  return typeof key === "string" ? key : key.pubkey;
}
