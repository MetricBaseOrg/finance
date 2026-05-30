import Link from "next/link";
import { getOrgContext } from "@/lib/org";
import { db } from "@/server/db";
import { isAIConfigured } from "@/lib/anthropic";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { AgentCreateForm } from "./AgentCreateForm";
import { AgentRowActions } from "./AgentRowActions";

export const dynamic = "force-dynamic";

export default async function AgentsSettingsPage() {
  const { activeOrg } = await getOrgContext();
  const canManage = activeOrg.role === "OWNER" || activeOrg.role === "ADMIN";

  const agents = await db.agent.findMany({
    where: { organizationId: activeOrg.id },
    include: {
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
      user: { select: { image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const memberships = await db.membership.findMany({
    where: { organizationId: activeOrg.id, userId: { in: agents.map((a) => a.userId) } },
    select: { userId: true, role: true },
  });
  const roleByUser = new Map(memberships.map((m) => [m.userId, m.role]));

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto px-6 py-8">
      <Link
        href="/settings"
        className="font-mono rounded-lg text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors self-start"
      >
        ← Back to settings
      </Link>
      <header>
        <Eyebrow>Workspace · {activeOrg.name}</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          AI Agents
        </h1>
        <p className="text-gray-2 text-sm mt-2 max-w-2xl">
          Agents are AI members of this workspace. Assign one a task or
          <span className="text-gold"> @mention</span> it in a comment or chat and it acts
          with the role you give it. Its actions are attributed to the agent in the activity log.
        </p>
      </header>

      {!isAIConfigured() && (
        <div className="mb-card px-4 py-3 border border-[var(--border-str)]">
          <p className="font-mono text-xs text-[var(--color-down)]">
            AI is not configured (ANTHROPIC_API_KEY missing). Agents can be created but won&apos;t run
            until the key is set.
          </p>
        </div>
      )}

      {!canManage ? (
        <div className="mb-card px-4 py-6 text-center text-gray-3 text-sm">
          Only workspace owners and admins can manage agents.
        </div>
      ) : (
        <AgentCreateForm slug={activeOrg.slug} />
      )}

      <div className="flex flex-col gap-3">
        <Eyebrow>Agents</Eyebrow>
        {agents.length === 0 ? (
          <BunEmpty title="No agents yet" description={canManage ? "Create your first AI agent above." : "No agents have been created for this workspace."} />
        ) : (
          <div className="mb-card">
            <div className="hidden md:grid grid-cols-[1.4fr_0.7fr_1fr_1fr] px-4 py-3 border-b border-line">
              {["Agent", "Role", "Scopes", "Last run"].map((h) => (
                <span key={h} className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
                  {h}
                </span>
              ))}
            </div>
            {agents.map((a) => {
              const role = roleByUser.get(a.userId) ?? "VIEWER";
              const lastRun = a.runs[0];
              return (
                <div
                  key={a.id}
                  className="border-b border-line last:border-b-0 px-4 py-3 grid grid-cols-1 md:grid-cols-[1.4fr_0.7fr_1fr_1fr] gap-3 md:items-start"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {a.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.user.image} alt="" className="w-7 h-7 shrink-0 border border-[var(--border-str)] object-cover" />
                    ) : (
                      <div className="w-7 h-7 bg-surface shrink-0 border border-[var(--border-str)] flex items-center justify-center font-mono text-xs text-gold uppercase">
                        {a.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-sm text-white truncate">{a.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-black bg-gold px-1.5 py-0.5">
                          Agent
                        </span>
                        {!a.enabled && (
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-3 border border-line px-1.5 py-0.5">
                            Off
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-gray-3 break-all">
                        {a.model ?? "default model"}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-gold self-center">{role}</span>
                  <span className="font-mono text-[11px] text-gray-2 self-center">
                    {a.scopes.join(", ")}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[11px] text-gray-3 self-center">
                      {lastRun ? `${lastRun.status} · ${lastRun.trigger}` : "—"}
                    </span>
                    {canManage && (
                      <AgentRowActions
                        slug={activeOrg.slug}
                        agent={{
                          id: a.id,
                          name: a.name,
                          role,
                          model: a.model,
                          image: a.user.image,
                          instructions: a.instructions,
                          scopes: a.scopes,
                          enabled: a.enabled,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
