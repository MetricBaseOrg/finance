import "server-only";
import Decimal from "decimal.js";
import { db } from "@/server/db";
import { getFxRate } from "@/server/fx/provider";

export type PositionMetrics = {
  id: string;
  symbol: string;
  name: string | null;
  currency: string;
  accountName: string;
  closed: boolean;
  lastPrice: string | null;
  lastPriceAt: Date | null;
  openQty: string;
  avgCost: string; // per unit, position currency
  costBasis: string; // position currency
  marketValue: string | null; // position currency
  unrealizedPl: string | null; // position currency
  realizedPl: string; // position currency
  dividendsYtd: string; // position currency
  // Converted to workspace base currency (null when FX unavailable)
  marketValueBase: number | null;
  unrealizedPlBase: number | null;
  realizedPlBase: number | null;
  dividendsYtdBase: number | null;
  lots: {
    id: string;
    quantity: string;
    remainingQuantity: string;
    costPerUnit: string;
    fees: string | null;
    acquiredAt: Date;
  }[];
  dividends: { id: string; totalAmount: string; payDate: Date }[];
};

export type Portfolio = {
  positions: PositionMetrics[];
  totals: {
    marketValueBase: number;
    unrealizedPlBase: number;
    realizedPlBase: number;
    dividendsYtdBase: number;
  };
  fxAvailable: boolean;
};

export async function buildPortfolio(
  workspaceId: string,
  baseCurrency: string,
): Promise<Portfolio> {
  const positions = await db.investmentPosition.findMany({
    where: { workspaceId },
    include: {
      finAccount: true,
      lots: { orderBy: [{ acquiredAt: "asc" }, { createdAt: "asc" }] },
      dividends: { orderBy: { payDate: "desc" } },
    },
    orderBy: [{ closedAt: "asc" }, { createdAt: "asc" }],
  });

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  let fxAvailable = true;
  const totals = {
    marketValueBase: 0,
    unrealizedPlBase: 0,
    realizedPlBase: 0,
    dividendsYtdBase: 0,
  };

  const result: PositionMetrics[] = [];
  for (const p of positions) {
    let openQty = new Decimal(0);
    let costBasis = new Decimal(0);
    for (const lot of p.lots) {
      const rem = new Decimal(lot.remainingQuantity.toString());
      openQty = openQty.plus(rem);
      costBasis = costBasis.plus(rem.times(new Decimal(lot.costPerUnit.toString())));
    }
    const avgCost = openQty.gt(0) ? costBasis.div(openQty) : new Decimal(0);
    const lastPrice = p.lastPrice != null ? new Decimal(p.lastPrice.toString()) : null;
    const marketValue = lastPrice != null ? openQty.times(lastPrice) : null;
    const unrealizedPl =
      marketValue != null ? marketValue.minus(costBasis) : null;
    const realizedPl = new Decimal(p.realizedPl.toString());
    const dividendsYtd = p.dividends.reduce(
      (acc, d) =>
        d.payDate >= yearStart
          ? acc.plus(new Decimal(d.totalAmount.toString()))
          : acc,
      new Decimal(0),
    );

    let rate: Decimal | null = null;
    try {
      rate = await getFxRate(p.currency, baseCurrency, now);
    } catch {
      fxAvailable = false;
      rate = null;
    }

    const toBase = (v: Decimal | null): number | null =>
      v != null && rate != null ? v.times(rate).toNumber() : null;

    const marketValueBase = toBase(marketValue);
    const unrealizedPlBase = toBase(unrealizedPl);
    const realizedPlBase = toBase(realizedPl);
    const dividendsYtdBase = toBase(dividendsYtd);

    if (marketValueBase != null) totals.marketValueBase += marketValueBase;
    if (unrealizedPlBase != null) totals.unrealizedPlBase += unrealizedPlBase;
    if (realizedPlBase != null) totals.realizedPlBase += realizedPlBase;
    if (dividendsYtdBase != null) totals.dividendsYtdBase += dividendsYtdBase;

    result.push({
      id: p.id,
      symbol: p.symbol,
      name: p.name,
      currency: p.currency,
      accountName: p.finAccount.name,
      closed: p.closedAt != null,
      lastPrice: lastPrice != null ? lastPrice.toString() : null,
      lastPriceAt: p.lastPriceAt,
      openQty: openQty.toString(),
      avgCost: avgCost.toString(),
      costBasis: costBasis.toString(),
      marketValue: marketValue != null ? marketValue.toString() : null,
      unrealizedPl: unrealizedPl != null ? unrealizedPl.toString() : null,
      realizedPl: realizedPl.toString(),
      dividendsYtd: dividendsYtd.toString(),
      marketValueBase,
      unrealizedPlBase,
      realizedPlBase,
      dividendsYtdBase,
      lots: p.lots.map((l) => ({
        id: l.id,
        quantity: l.quantity.toString(),
        remainingQuantity: l.remainingQuantity.toString(),
        costPerUnit: l.costPerUnit.toString(),
        fees: l.fees != null ? l.fees.toString() : null,
        acquiredAt: l.acquiredAt,
      })),
      dividends: p.dividends.map((d) => ({
        id: d.id,
        totalAmount: d.totalAmount.toString(),
        payDate: d.payDate,
      })),
    });
  }

  return { positions: result, totals, fxAvailable };
}
