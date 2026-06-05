import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { AccountCreateForm } from "./AccountCreateForm";
import { AccountRow } from "./AccountRow";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace, membership } = await requireMembership(slug);
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";

  const [accounts, projects] = await Promise.all([
    db.finAccount.findMany({
      where: { organizationId: workspace.id },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({
      where: { organizationId: workspace.id, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const active = accounts.filter((a) => !a.archivedAt);
  const archived = accounts.filter((a) => a.archivedAt);

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header className="flex items-end justify-between">
        <div>
          <Eyebrow>Accounts</Eyebrow>
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Financial Accounts
          </h1>
          <p className="text-gray-2 text-sm mt-2">
            Bank, cash, crypto, brokerage. Set a currency and opening balance
            per account.
          </p>
        </div>
      </header>

      {canManage ? (
        <AccountCreateForm slug={slug} workspaceBase={workspace.baseCurrency} projects={projects} />
      ) : (
        <div className="mb-card px-4 py-3 font-mono text-[11px] text-gray-3">
          Only owners and admins can add or edit accounts. You can record transactions for approval.
        </div>
      )}

      {active.length === 0 ? (
        <BunEmpty
          title="No accounts yet"
          description="Add your first account above. Bun will use it as the starting point for your books."
        />
      ) : (
        <div className="mb-card">
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_160px_120px] px-4 py-3 border-b border-line">
            {["Name", "Type", "Currency", "Opening Balance", ""].map((h) => (
              <span
                key={h}
                className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
              >
                {h}
              </span>
            ))}
          </div>
          {active.map((a) => (
            <AccountRow key={a.id} account={{ ...a, openingBalance: a.openingBalance.toString() }} slug={slug} projects={projects} canManage={canManage} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-3">
          <Eyebrow>Archived</Eyebrow>
          <div className="mb-card opacity-60">
            {archived.map((a) => (
              <AccountRow key={a.id} account={{ ...a, openingBalance: a.openingBalance.toString() }} slug={slug} projects={projects} canManage={canManage} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
