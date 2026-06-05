import Link from "next/link";
import { AuditAction, AuditEntityType, Prisma } from "@prisma/client";
import { requireRole } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { AuditFilters } from "./AuditFilters";

const PAGE_SIZE = 50;

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{
    action?: string;
    entity?: string;
    member?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;
  const { workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);

  const members = await db.membership.findMany({
    where: { workspaceId: workspace.id },
    include: { user: true },
    orderBy: { id: "asc" },
  });

  const where: Prisma.AuditLogWhereInput = { workspaceId: workspace.id };
  if (sp.action && sp.action in AuditAction) {
    where.action = sp.action as AuditAction;
  }
  if (sp.entity && sp.entity in AuditEntityType) {
    where.entityType = sp.entity as AuditEntityType;
  }
  if (sp.member) where.userId = sp.member;
  if (sp.from || sp.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (sp.from) createdAt.gte = new Date(sp.from);
    if (sp.to) createdAt.lte = new Date(`${sp.to}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <Link
        href={`/app/${slug}/dashboard`}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors self-start"
      >
        ← Back to dashboard
      </Link>
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Activity
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          {total} {total === 1 ? "event" : "events"} · Audit trail of changes in
          this workspace.
        </p>
      </header>

      <AuditFilters
        actions={Object.values(AuditAction)}
        entities={Object.values(AuditEntityType)}
        members={members.map((m) => ({
          id: m.userId,
          email: m.user.email,
        }))}
      />

      {logs.length === 0 ? (
        <BunEmpty
          title="No activity matches"
          description="Try widening the filters, or perform an action to see it logged here."
        />
      ) : (
        <div className="mb-card">
          <div className="hidden md:grid grid-cols-[150px_140px_200px_1fr] px-4 py-3 border-b border-line">
            {["When", "Action", "Member", "Summary"].map((h) => (
              <span
                key={h}
                className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
              >
                {h}
              </span>
            ))}
          </div>
          {logs.map((l) => (
            <div
              key={l.id}
              className="border-b border-line last:border-b-0 hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <div className="hidden md:grid grid-cols-[150px_140px_200px_1fr] px-4 py-3 items-center gap-2">
                <span className="font-mono text-xs text-gray-2">
                  {l.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
                <span className="font-mono text-[11px] text-gold">
                  {l.action}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  {l.user ? (
                    l.user.image ? (
                      <img
                        src={l.user.image}
                        alt="Avatar"
                        className="w-5 h-5 rounded-full object-cover shrink-0 border border-line"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-surface shrink-0 border border-line flex items-center justify-center font-mono text-[10px] text-gray-3 uppercase">
                        {(l.user.name || l.user.email || "U").charAt(0)}
                      </div>
                    )
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-surface shrink-0 border border-line flex items-center justify-center font-mono text-[10px] text-gray-3 uppercase">
                      S
                    </div>
                  )}
                  <span className="font-mono text-xs text-gray-2 truncate">
                    {l.user?.email ?? "system"}
                  </span>
                </div>
                <span className="font-sans text-sm text-white">
                  {l.summary}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-gray-3">
                    {l.entityType}
                  </span>
                </span>
              </div>
              <div className="md:hidden px-4 py-4 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-3">
                  <span className="font-sans text-sm text-white">
                    {l.summary}
                  </span>
                  <span className="font-mono text-[10px] text-gold shrink-0">
                    {l.action}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-3 uppercase tracking-[0.18em]">
                  <span>{l.createdAt.toISOString().slice(0, 16).replace("T", " ")} ·</span>
                  {l.user ? (
                    l.user.image ? (
                      <img
                        src={l.user.image}
                        alt="Avatar"
                        className="w-3.5 h-3.5 rounded-full object-cover shrink-0 border border-line"
                      />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-surface shrink-0 border border-line flex items-center justify-center text-[8px]">
                        {(l.user.name || l.user.email || "U").charAt(0)}
                      </div>
                    )
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-surface shrink-0 border border-line flex items-center justify-center text-[8px]">
                      S
                    </div>
                  )}
                  <span className="truncate">{l.user?.email ?? "system"}</span>
                </div>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="px-4 py-3 flex justify-between items-center border-t border-line">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <PageLink slug={slug} sp={sp} page={page - 1} disabled={page <= 1}>
                  ← Prev
                </PageLink>
                <PageLink
                  slug={slug}
                  sp={sp}
                  page={page + 1}
                  disabled={page >= totalPages}
                >
                  Next →
                </PageLink>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageLink({
  slug,
  sp,
  page,
  disabled,
  children,
}: {
  slug: string;
  sp: Record<string, string | undefined>;
  page: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-4 px-3 py-1.5 border border-line">
        {children}
      </span>
    );
  }
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue;
    if (v) qp.set(k, v);
  }
  qp.set("page", String(page));
  return (
    <Link
      href={`/app/${slug}/settings/activity?${qp.toString()}`}
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:text-gold-bright px-3 py-1.5 border border-line hover:border-gold transition-colors"
    >
      {children}
    </Link>
  );
}
