import Link from "next/link";
import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { WorkspaceEditForm } from "./WorkspaceEditForm";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);
  const txnCount = await db.transaction.count({
    where: { workspaceId: workspace.id },
  });
  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">
      <Link
        href={`/app/${slug}/dashboard`}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors self-start"
      >
        ← Back to dashboard
      </Link>
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Workspace
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          Rename your workspace or switch its type. The slug stays the same so
          your existing links keep working.
        </p>
      </header>

      <WorkspaceEditForm
        slug={slug}
        initial={{
          name: workspace.name,
          type: workspace.type,
          baseCurrency: workspace.baseCurrency,
        }}
        currencyLocked={txnCount > 0}
        txnCount={txnCount}
      />

      <div className="mb-card p-6 flex flex-col gap-3">
        <Eyebrow>Identifiers</Eyebrow>
        <div className="flex justify-between gap-3 border-b border-line pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
            Slug
          </span>
          <span className="font-mono text-sm text-gold break-all text-right">
            {workspace.slug}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
            ID
          </span>
          <span className="font-mono text-[11px] text-gray-3 break-all text-right">
            {workspace.id}
          </span>
        </div>
      </div>
    </div>
  );
}
