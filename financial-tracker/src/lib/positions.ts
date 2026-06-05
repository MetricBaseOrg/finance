import Decimal from "decimal.js";
import { Lot, Position, FinAccount } from "@prisma/client";

export interface AggregatedPosition {
  position: Position & { finAccount: FinAccount | null };
  quantity: Decimal;
  avgCostPerUnit: Decimal;
  totalCostBasis: Decimal;
  realizedPnL: Decimal;
}

export function aggregatePosition(
  position: Position & { finAccount: FinAccount | null },
  lots: Lot[],
): AggregatedPosition {
  const buyLots = lots.filter((l) => l.side === "BUY");
  const sellLots = lots.filter((l) => l.side === "SELL");

  let totalQuantity = new Decimal(0);
  let totalCost = new Decimal(0);

  for (const lot of buyLots) {
    totalQuantity = totalQuantity.add(lot.quantity);
    const costWithFee = lot.quantity.mul(lot.unitCost).add(lot.fee);
    totalCost = totalCost.add(costWithFee);
  }

  const avgCostPerUnit = totalQuantity.isZero()
    ? new Decimal(0)
    : totalCost.div(totalQuantity);

  let realizedPnL = new Decimal(0);
  for (const sellLot of sellLots) {
    const proceeds = sellLot.quantity.mul(sellLot.unitCost);
    const proceedsAfterFee = proceeds.minus(sellLot.fee);

    const costBasis = sellLot.quantity.mul(sellLot.unitCost);

    const pnl = proceedsAfterFee.minus(costBasis);
    realizedPnL = realizedPnL.add(pnl);
  }

  return {
    position,
    quantity: totalQuantity,
    avgCostPerUnit,
    totalCostBasis: totalCost,
    realizedPnL,
  };
}
