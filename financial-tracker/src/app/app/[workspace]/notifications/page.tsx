import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { buildAlerts } from "@/server/analytics";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { Money } from "@/components/mb/Money";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);
  const alerts = await buildAlerts(workspace.id);

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header>
        <Eyebrow>Notifications</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Alerts
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          {alerts.length} active {alerts.length === 1 ? "alert" : "alerts"} ·
          Computed live from this month&apos;s spend.
        </p>
      </header>

      {alerts.length === 0 ? (
        <BunEmpty
          title="All clear"
          description="No categories are over budget this month."
        />
      ) : (
        <div className="mb-card">
          <div className="hidden md:grid grid-cols-[1fr_140px_140px_140px] px-4 py-3 border-b border-line">
            {["Category", "Spent MTD", "Budget", "Over by"].map((h) => (
              <span
                key={h}
                className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
              >
                {h}
              </span>
            ))}
          </div>
          {alerts.map((a) => (
            <Link
              key={a.categoryId}
              href={`/app/${slug}/budgets`}
              className="block border-b border-line last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <div className="hidden md:grid grid-cols-[1fr_140px_140px_140px] px-4 py-3 items-center">
                <span className="font-sans text-sm text-white">{a.name}</span>
                <span className="mono text-sm text-white">
                  <Money value={a.actual} currency={workspace.baseCurrency} />
                </span>
                <span className="mono text-sm text-gray-2">
                  <Money value={a.budget} currency={workspace.baseCurrency} />
                </span>
                <span className="mono text-sm text-[var(--color-down)]">
                  <Money value={a.overBy} currency={workspace.baseCurrency} />
                </span>
              </div>
              <div className="md:hidden px-4 py-4 flex justify-between items-center gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="font-sans text-white font-semibold truncate">
                    {a.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3 mt-1">
                    Over by{" "}
                    <span className="text-[var(--color-down)]">
                      <Money value={a.overBy} currency={workspace.baseCurrency} />
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
