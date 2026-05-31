"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { agentCreateSchema, agentUpdateSchema } from "@/lib/schemas";
import { normalizeAvatarUrl } from "@/lib/avatar";

export type AgentActionState = { error?: string; ok?: boolean };

function parseScopes(formData: FormData): string[] {
  return formData.getAll("scopes").map((s) => String(s));
}

export async function createAgent(
  slug: string,
  _prev: AgentActionState | undefined,
  formData: FormData,
): Promise<AgentActionState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const parsed = agentCreateSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    model: formData.get("model") ?? "",
    instructions: formData.get("instructions") ?? "",
    scopes: parseScopes(formData),
    avatarUrl: formData.get("avatarUrl") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Synthetic, unroutable email — agents never receive mail or sign in.
  const email = `agent+${randomUUID()}@agents.metricbase.local`;
  const image = normalizeAvatarUrl(parsed.data.avatarUrl);

  try {
    const agent = await db.$transaction(async (tx) => {
      const botUser = await tx.user.create({
        data: { name: parsed.data.name, email, kind: "AGENT", image },
      });
      await tx.membership.create({
        data: {
          userId: botUser.id,
          organizationId: workspace.id,
          role: parsed.data.role,
        },
      });
      return tx.agent.create({
        data: {
          organizationId: workspace.id,
          userId: botUser.id,
          name: parsed.data.name,
          instructions: parsed.data.instructions,
          model: parsed.data.model,
          scopes: parsed.data.scopes,
          createdById: user.id,
        },
      });
    });

    await logAudit({
      organizationId: workspace.id,
      userId: user.id,
      action: "AGENT_CREATE",
      entityType: "AGENT",
      entityId: agent.id,
      summary: `Created AI agent "${parsed.data.name}" (${parsed.data.role})`,
      metadata: { role: parsed.data.role, scopes: parsed.data.scopes },
    });
  } catch (e) {
    console.error("createAgent failed", e);
    return { error: "Could not create the agent." };
  }

  revalidatePath("/settings/agents");
  return { ok: true };
}

export async function updateAgent(
  slug: string,
  _prev: AgentActionState | undefined,
  formData: FormData,
): Promise<AgentActionState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const agentId = String(formData.get("agentId") ?? "");
  if (!agentId) return { error: "Agent ID is required." };
  const parsed = agentUpdateSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    model: formData.get("model") ?? "",
    instructions: formData.get("instructions") ?? "",
    scopes: parseScopes(formData),
    enabled: formData.get("enabled") ?? "false",
    avatarUrl: formData.get("avatarUrl") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const agent = await db.agent.findFirst({
    where: { id: agentId, organizationId: workspace.id },
  });
  if (!agent) return { error: "Agent not found." };

  const image = normalizeAvatarUrl(parsed.data.avatarUrl);
  await db.$transaction([
    db.agent.update({
      where: { id: agent.id },
      data: {
        name: parsed.data.name,
        instructions: parsed.data.instructions,
        model: parsed.data.model,
        scopes: parsed.data.scopes,
        enabled: parsed.data.enabled,
      },
    }),
    db.user.update({ where: { id: agent.userId }, data: { name: parsed.data.name, image } }),
    db.membership.update({
      where: { userId_organizationId: { userId: agent.userId, organizationId: workspace.id } },
      data: { role: parsed.data.role },
    }),
  ]);

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "AGENT_UPDATE",
    entityType: "AGENT",
    entityId: agent.id,
    summary: `Updated AI agent "${parsed.data.name}"`,
    metadata: { role: parsed.data.role, scopes: parsed.data.scopes, enabled: parsed.data.enabled },
  });

  revalidatePath("/settings/agents");
  return { ok: true };
}

export async function deleteAgent(slug: string, agentId: string): Promise<AgentActionState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const agent = await db.agent.findFirst({
    where: { id: agentId, organizationId: workspace.id },
  });
  if (!agent) return { error: "Agent not found." };

  // Deleting the backing user cascades to the membership and the agent row.
  await db.user.delete({ where: { id: agent.userId } });

  await logAudit({
    organizationId: workspace.id,
    userId: user.id,
    action: "AGENT_DELETE",
    entityType: "AGENT",
    entityId: agent.id,
    summary: `Deleted AI agent "${agent.name}"`,
  });

  revalidatePath("/settings/agents");
  return { ok: true };
}
