import Link from "next/link";
import { requireRole, isSoleOwner } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { InviteCreateForm } from "./InviteCreateForm";
import { InviteRowActions } from "./InviteRowActions";
import { MemberRowActions } from "./MemberRowActions";

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace, user } = await requireRole(slug, ["OWNER", "ADMIN"]);

  const now = new Date();
  const [members, invites] = await Promise.all([
    db.membership.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: { id: "asc" },
    }),
    db.workspaceInvite.findMany({
      where: {
        workspaceId: workspace.id,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const soleOwnerFlags = await Promise.all(
    members.map((m) => isSoleOwner(workspace.id, m.id)),
  );

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
          Members
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          Invite teammates with a one-time link and manage their roles. Owners
          and admins can manage membership.
        </p>
      </header>

      <InviteCreateForm slug={slug} />

      <div className="flex flex-col gap-3">
        <Eyebrow>Pending invites</Eyebrow>
        {invites.length === 0 ? (
          <div className="mb-card px-4 py-6 text-center text-gray-3 text-sm">
            No pending invites.
          </div>
        ) : (
          <div className="mb-card">
            <div className="hidden md:grid grid-cols-[1.4fr_100px_160px_1fr] px-4 py-3 border-b border-line">
              {["Email", "Role", "Expires", ""].map((h) => (
                <span
                  key={h}
                  className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
                >
                  {h}
                </span>
              ))}
            </div>
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="border-b border-line last:border-b-0 px-4 py-3 grid grid-cols-1 md:grid-cols-[1.4fr_100px_160px_1fr] gap-2 md:items-center"
              >
                <span className="font-sans text-sm text-white break-all">
                  {inv.email ?? (
                    <span className="text-gray-3">Anyone with the link</span>
                  )}
                </span>
                <span className="font-mono text-xs text-gold">{inv.role}</span>
                <span className="font-mono text-xs text-gray-2">
                  {inv.expiresAt.toISOString().slice(0, 10)}
                </span>
                <InviteRowActions slug={slug} id={inv.id} token={inv.token} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Eyebrow>Members</Eyebrow>
        {members.length === 0 ? (
          <BunEmpty title="No members" description="Invite your first teammate above." />
        ) : (
          <div className="mb-card">
            <div className="hidden md:grid grid-cols-[1.6fr_1.2fr_220px] px-4 py-3 border-b border-line">
              {["Member", "Email", "Role"].map((h) => (
                <span
                  key={h}
                  className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3"
                >
                  {h}
                </span>
              ))}
            </div>
            {members.map((m, i) => (
              <div
                key={m.id}
                className="border-b border-line last:border-b-0 px-4 py-3 grid grid-cols-1 md:grid-cols-[1.6fr_1.2fr_220px] gap-2 md:items-center"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {m.user.image ? (
                    <img
                      src={m.user.image}
                      alt={m.user.name ?? "Member avatar"}
                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-line"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-surface shrink-0 border border-line flex items-center justify-center font-mono text-xs text-gray-3 uppercase">
                      {(m.user.name || m.user.email || "U").charAt(0)}
                    </div>
                  )}
                  <span className="font-sans text-sm text-white truncate">
                    {m.user.name ?? "—"}
                    {m.userId === user.id && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 shrink-0">
                        you
                      </span>
                    )}
                  </span>
                </div>
                <span className="font-mono text-xs text-gray-2 break-all">
                  {m.user.email}
                </span>
                <MemberRowActions
                  slug={slug}
                  membershipId={m.id}
                  role={m.role}
                  locked={soleOwnerFlags[i]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
