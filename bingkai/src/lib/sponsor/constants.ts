/** Receiving wallet, shared with PumpBid and Portabase. Bingkai only ever credits
 *  transfers whose memo is `BINGKAI bsp_…` or `BINGKAI TIP`; Portabase only credits
 *  `PORTABASE …` and PumpBid only `BID …`, so the three ledgers never mix. Public
 *  address only. */
export const WALLET = "9utfHAwb8ZqasYygd9keiFNqyTTB91wzT3dvvJcTbSyP";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
/** Known USDC associated token account of WALLET; watched even if the lookup RPC fails. */
export const USDC_ATA = "dM8HiWPCKd2y3KHSJxV4THFjqSGEBv6x7pCsbntzSyo";

/** Stablecoins credited at face value. SOL and other tokens are not accepted. */
export const STABLES: Record<string, { symbol: string; decimals: number }> = {
  [USDC_MINT]: { symbol: "USDC", decimals: 6 },
  [USDT_MINT]: { symbol: "USDT", decimals: 6 },
};

export const MEMO_PROGRAMS = new Set([
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVxDwQDxFZzx",
  "MemoZ8kJ6aJv4Jvk1rVBZMchtLJmEbWBoaVrqtGC7Yv",
]);

export const SLOT_COUNT = 5;
export const MIN_TOTAL_USD = 5;
export const BID_WINDOW_DAYS = 30;
/** Distinct reporters that hide an ad until the admin reviews it. */
export const REPORT_HIDE_THRESHOLD = 5;
export const TAGLINE_MAX = 60;
export const NAME_MAX = 32;
export const LOGO_MAX_BYTES = 200 * 1024;

export const TIP_MEMO = "BINGKAI TIP";
export const sponsorMemo = (id: string) => `BINGKAI ${id}`;
