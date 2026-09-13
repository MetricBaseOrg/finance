import "server-only";
import QRCode from "qrcode";
import { USDC_MINT, WALLET } from "./constants";

/** Solana Pay transfer request: Phantom, Solflare and Backpack prefill token, amount and memo. */
export function solanaPayUrl(opts: { amount?: number; memo: string; label: string; message?: string }): string {
  // Percent-encode (spaces as %20), per the Solana Pay spec. URLSearchParams writes
  // spaces as "+", which some wallets copy into the on-chain memo literally.
  const parts: [string, string][] = [];
  if (opts.amount && opts.amount > 0) parts.push(["amount", String(opts.amount)]);
  parts.push(["spl-token", USDC_MINT], ["memo", opts.memo], ["label", opts.label]);
  if (opts.message) parts.push(["message", opts.message]);
  return `solana:${WALLET}?${parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
