import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { Eyebrow } from "@/components/mb/Eyebrow";

export default async function ReportsIndex({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  await requireMembership(slug);
  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header>
        <Eyebrow>Reports</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Reports
        </h1>
      </header>
      <div className="grid md:grid-cols-2 gap-px bg-[var(--color-line)]">
        <Link
          href={`/app/${slug}/reports/pnl`}
          className="mb-card p-8 flex flex-col gap-3"
        >
          <Eyebrow>Income statement</Eyebrow>
          <h2 className="font-sans text-2xl font-bold text-white">P&amp;L</h2>
          <p className="text-gray-2 text-sm">
            Revenue and expenses by category over a date range.
          </p>
        </Link>
        <Link
          href={`/app/${slug}/reports/balance-sheet`}
          className="mb-card p-8 flex flex-col gap-3"
        >
          <Eyebrow>Position</Eyebrow>
          <h2 className="font-sans text-2xl font-bold text-white">
            Balance sheet
          </h2>
          <p className="text-gray-2 text-sm">
            Account balances as of a point in time.
          </p>
        </Link>
      </div>
    </div>
  );
}
