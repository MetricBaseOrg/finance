import Decimal from "decimal.js";

export type DecimalLike = Decimal | string | number;

export function d(value: DecimalLike): Decimal {
  return new Decimal(value);
}

export function formatMoney(
  value: DecimalLike,
  currency: string,
  opts: { compact?: boolean; sign?: boolean } = {},
): string {
  const num = new Decimal(value).toNumber();
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
    signDisplay: opts.sign ? "always" : "auto",
  });
  return formatter.format(num);
}

export function convertAmount(
  amount: DecimalLike,
  rate: DecimalLike,
): Decimal {
  return new Decimal(amount).times(rate);
}
