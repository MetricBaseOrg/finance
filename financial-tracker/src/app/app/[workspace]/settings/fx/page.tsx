import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { FxOverrideForm } from "./FxOverrideForm";
import { FxRowActions } from "./FxRowActions";

export default async function FxSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  await requireMembership(slug);
  const rates = await db.fxRate.findMany({
    orderBy: { date: "desc" },
    take: 60,
  });

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          FX Rates
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          Daily snapshots are fetched from Frankfurter (ECB-backed) on demand.
          Override any specific date if you need a different rate.
        </p>
      </header>

      <FxOverrideForm slug={slug} />

      <div className="mb-card">
        <div className="hidden md:grid grid-cols-[110px_100px_100px_1fr_120px_100px] px-4 py-3 border-b border-line">
          {["Date", "Base", "Quote", "Rate", "Source", ""].map((h) => (
            <span
              key={h}
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
            >
              {h}
            </span>
          ))}
        </div>
        {rates.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-3 text-sm">
            No rates yet. Record a cross-currency transaction or hit the FX
            cron to seed the cache.
          </div>
        ) : (
          rates.map((r) => (
            <div
              key={r.id}
              className="border-b border-line last:border-b-0"
            >
              <div className="hidden md:grid grid-cols-[110px_100px_100px_1fr_120px_100px] px-4 py-3 items-center">
                <span className="font-mono text-xs text-gray-2">
                  {r.date.toISOString().slice(0, 10)}
                </span>
                <span className="font-mono text-xs text-gold">{r.base}</span>
                <span className="font-mono text-xs text-gold">{r.quote}</span>
                <span className="mono text-sm text-white">
                  {parseFloat(r.rate.toString()).toLocaleString("en-US", {
                    maximumFractionDigits: 8,
                  })}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                    r.source === "manual" ? "text-gold" : "text-gray-3"
                  }`}
                >
                  {r.source}
                </span>
                {r.source === "manual" ? (
                  <FxRowActions slug={slug} id={r.id} />
                ) : (
                  <span />
                )}
              </div>
              <div className="md:hidden px-4 py-4 flex flex-col gap-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-gray-2">
                      {r.date.toISOString().slice(0, 10)}
                    </span>
                    <span className="font-mono text-[11px] mt-1">
                      <span className="text-gold">{r.base}</span>
                      <span className="text-gray-3"> → </span>
                      <span className="text-gold">{r.quote}</span>
                    </span>
                  </div>
                  <span className="mono text-sm text-white shrink-0">
                    {parseFloat(r.rate.toString()).toLocaleString("en-US", {
                      maximumFractionDigits: 8,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                      r.source === "manual" ? "text-gold" : "text-gray-3"
                    }`}
                  >
                    {r.source}
                  </span>
                  {r.source === "manual" && (
                    <FxRowActions slug={slug} id={r.id} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
