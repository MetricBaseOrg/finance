import { requireMembership } from "@/server/workspace";
import { buildBalanceSheet } from "@/server/reports";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { Money } from "@/components/mb/Money";

export default async function BalanceSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ asOf?: string }>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;
  const { workspace } = await requireMembership(slug);

  const asOf = sp.asOf
    ? new Date(sp.asOf + "T23:59:59Z")
    : new Date();

  const report = await buildBalanceSheet(workspace.id, asOf);

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header className="flex flex-col gap-2">
        <Eyebrow>Reports · Balance sheet</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
          Balance sheet
        </h1>
        <p className="text-gray-2 text-sm">
          As of {asOf.toISOString().slice(0, 10)} · Base{" "}
          <span className="text-gold mono">{workspace.baseCurrency}</span>
        </p>
      </header>

      <form className="mb-card p-4 flex gap-3 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            As of
          </span>
          <input
            type="date"
            name="asOf"
            defaultValue={asOf.toISOString().slice(0, 10)}
            className="mb-input mono"
          />
        </label>
        <button
          type="submit"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-black bg-gold hover:bg-gold-bright px-4 py-2.5"
        >
          Apply
        </button>
      </form>

      <div className="mb-card p-6">
        <Eyebrow>Total assets · base</Eyebrow>
        <div className="mt-3 mono text-3xl font-extrabold text-white">
          <Money
            value={report.totalAssetsBase}
            currency={workspace.baseCurrency}
          />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3 mt-2">
          Opening balances treated as native + movements in base.
        </p>
      </div>

      <div className="mb-card">
        <div className="hidden md:grid grid-cols-[1fr_120px_160px_160px_180px] px-4 py-3 border-b border-line">
          {[
            "Account",
            "Currency",
            "Opening",
            "Movements (base)",
            "Balance (base)",
          ].map((h) => (
            <span
              key={h}
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
            >
              {h}
            </span>
          ))}
        </div>
        {report.accounts.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-3 text-sm">
            No accounts
          </div>
        ) : (
          report.accounts.map((a) => (
            <div
              key={a.id}
              className="border-b border-line last:border-b-0"
            >
              <div className="hidden md:grid grid-cols-[1fr_120px_160px_160px_180px] px-4 py-3 items-center">
                <span className="font-sans text-white text-sm">{a.name}</span>
                <span className="font-mono text-xs text-gold">{a.currency}</span>
                <span className="mono text-sm text-gray-2">
                  <Money value={a.openingBalance} currency={a.currency} />
                </span>
                <span
                  className={`mono text-sm ${
                    a.movements >= 0
                      ? "text-[var(--color-up)]"
                      : "text-[var(--color-down)]"
                  }`}
                >
                  <Money value={a.movements} currency={workspace.baseCurrency} />
                </span>
                <span className="mono text-sm text-white text-right">
                  <Money value={a.balanceBase} currency={workspace.baseCurrency} />
                </span>
              </div>
              <div className="md:hidden px-4 py-4 flex flex-col gap-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="font-sans text-white font-semibold truncate">
                      {a.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold mt-1">
                      {a.currency}
                    </span>
                  </div>
                  <span className="mono text-base font-bold text-white shrink-0">
                    <Money value={a.balanceBase} currency={workspace.baseCurrency} />
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                      Opening
                    </span>
                    <span className="mono text-gray-2 mt-0.5">
                      <Money value={a.openingBalance} currency={a.currency} />
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                      Movements
                    </span>
                    <span
                      className={`mono mt-0.5 ${
                        a.movements >= 0
                          ? "text-[var(--color-up)]"
                          : "text-[var(--color-down)]"
                      }`}
                    >
                      <Money value={a.movements} currency={workspace.baseCurrency} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
