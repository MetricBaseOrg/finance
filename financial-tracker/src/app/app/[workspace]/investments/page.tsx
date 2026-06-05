import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { Money } from "@/components/mb/Money";
import { TradeForm } from "./TradeForm";
import { aggregatePosition } from "@/lib/positions";

export default async function InvestmentsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);

  const [accounts, positions] = await Promise.all([
    db.finAccount.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    db.position.findMany({
      where: { workspaceId: workspace.id },
      include: {
        finAccount: true,
        lots: {
          orderBy: { acquiredDate: "asc" },
        },
      },
      orderBy: { finAccount: { name: "asc" } },
    }),
  ]);

  const brokerageAccounts = accounts.filter((a) =>
    ["BROKERAGE", "CRYPTO"].includes(a.type),
  );

  if (brokerageAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
        <header>
          <Eyebrow>Investments</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Positions
          </h1>
        </header>
        <BunEmpty
          title="Add a brokerage account first"
          description="You need a BROKERAGE or CRYPTO account before you can track investment positions."
          action={
            <Link
              href={`/app/${slug}/accounts`}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright"
            >
              → Go to Accounts
            </Link>
          }
        />
      </div>
    );
  }

  const aggregatedPositions = positions.map((pos) =>
    aggregatePosition(pos, pos.lots),
  );

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <Link
        href={`/app/${slug}/transactions`}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors self-start"
      >
        ← Back to transactions
      </Link>

      <header>
        <Eyebrow>Investments</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Positions
        </h1>
      </header>

      <TradeForm
        slug={slug}
        accounts={accounts.map((a) => ({ ...a, openingBalance: a.openingBalance.toString() }))}
      />

      {aggregatedPositions.length === 0 ? (
        <div className="mb-card p-6 text-center">
          <p className="text-gray-2">No positions yet.</p>
        </div>
      ) : (
        <div className="mb-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Symbol
                </th>
                <th className="text-left px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Account
                </th>
                <th className="text-left px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Unit kind
                </th>
                <th className="text-right px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Quantity
                </th>
                <th className="text-right px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Avg cost
                </th>
                <th className="text-right px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Cost basis
                </th>
                <th className="text-right px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                  Realized P&L
                </th>
              </tr>
            </thead>
            <tbody>
              {aggregatedPositions.map((agg) => {
                const fmt = new Intl.NumberFormat("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                });
                return (
                  <tr
                    key={agg.position.id}
                    className="border-b border-line last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    <td className="px-6 py-3 font-mono font-semibold text-white">
                      {agg.position.symbol}
                    </td>
                    <td className="px-6 py-3 text-gray-2 text-xs">
                      {agg.position.finAccount?.name}
                    </td>
                    <td className="px-6 py-3 text-gray-2 text-xs">
                      {agg.position.unitKind.charAt(0) +
                        agg.position.unitKind.slice(1).toLowerCase()}
                    </td>
                    <td className="px-6 py-3 text-right text-white font-mono text-xs">
                      {fmt.format(agg.quantity.toNumber())}
                    </td>
                    <td className="px-6 py-3 text-right text-white font-mono text-xs">
                      {fmt.format(agg.avgCostPerUnit.toNumber())}{" "}
                      {agg.position.finAccount?.currency}
                    </td>
                    <td className="px-6 py-3 text-right text-white font-mono text-xs">
                      {fmt.format(agg.totalCostBasis.toNumber())}{" "}
                      {agg.position.finAccount?.currency}
                    </td>
                    <td
                      className={`px-6 py-3 text-right font-mono text-xs ${
                        agg.realizedPnL.isNegative() ? "text-[var(--color-down)]" : "text-[var(--color-up)]"
                      }`}
                    >
                      {agg.realizedPnL.isNegative() ? "−" : "+"}
                      {fmt.format(agg.realizedPnL.abs().toNumber())}{" "}
                      {agg.position.finAccount?.currency}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
