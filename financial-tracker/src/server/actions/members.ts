"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole, isSoleOwner } from "@/server/workspace";
import { logAudit } from "@/server/audit";
import { inviteCreateSchema, memberRoleSchema } from "@/lib/schemas";
import { INVITE_TTL_DAYS } from "@/lib/constants";

export type InviteActionState = { error?: string; token?: string };
export type MemberActionState = { error?: string };

export async function createInvite(
  slug: string,
  _prev: InviteActionState | undefined,
  formData: FormData,
): Promise<InviteActionState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const parsed = inviteCreateSchema.safeParse({
    role: formData.get("role"),
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const invite = await db.workspaceInvite.create({
    data: {
      workspaceId: workspace.id,
      role: parsed.data.role,
      email: parsed.data.email,
      createdByUserId: user.id,
      expiresAt,
    },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "INVITE_CREATE",
    entityType: "INVITE",
    entityId: invite.id,
    summary: `Invited ${parsed.data.email ?? "a teammate"} as ${parsed.data.role}`,
    metadata: { role: parsed.data.role, email: parsed.data.email },
  });
  revalidatePath(`/app/${slug}/settings/members`);
  return { token: invite.token };
}

export async function revokeInvite(slug: string, inviteId: string) {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const invite = await db.workspaceInvite.findFirst({
    where: { id: inviteId, workspaceId: workspace.id },
  });
  if (!invite) return;
  await db.workspaceInvite.delete({ where: { id: invite.id } });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "INVITE_REVOKE",
    entityType: "INVITE",
    entityId: invite.id,
    summary: `Revoked invite for ${invite.email ?? "a teammate"}`,
  });
  revalidatePath(`/app/${slug}/settings/members`);
}

export async function changeMemberRole(
  slug: string,
  _prev: MemberActionState | undefined,
  formData: FormData,
): Promise<MemberActionState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const parsed = memberRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const membership = await db.membership.findFirst({
    where: { id: parsed.data.membershipId, workspaceId: workspace.id },
    include: { user: true },
  });
  if (!membership) return { error: "Member not found." };
  if (membership.role === parsed.data.role) return {};
  if (
    membership.role === "OWNER" &&
    parsed.data.role !== "OWNER" &&
    (await isSoleOwner(workspace.id, membership.id))
  ) {
    return { error: "The workspace must keep at least one owner." };
  }
  await db.membership.update({
    where: { id: membership.id },
    data: { role: parsed.data.role },
  });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "MEMBER_ROLE_CHANGE",
    entityType: "MEMBERSHIP",
    entityId: membership.id,
    summary: `Changed ${membership.user.email}'s role ${membership.role} → ${parsed.data.role}`,
    metadata: { from: membership.role, to: parsed.data.role },
  });
  revalidatePath(`/app/${slug}/settings/members`);
  return {};
}

export async function removeMember(
  slug: string,
  membershipId: string,
): Promise<MemberActionState> {
  const { user, workspace } = await requireRole(slug, ["OWNER", "ADMIN"]);
  const membership = await db.membership.findFirst({
    where: { id: membershipId, workspaceId: workspace.id },
    include: { user: true },
  });
  if (!membership) return { error: "Member not found." };
  if (await isSoleOwner(workspace.id, membership.id)) {
    return { error: "You can't remove the only owner of the workspace." };
  }
  await db.membership.delete({ where: { id: membership.id } });
  await logAudit({
    workspaceId: workspace.id,
    userId: user.id,
    action: "MEMBER_REMOVE",
    entityType: "MEMBERSHIP",
    entityId: membership.id,
    summary: `Removed ${membership.user.email} from the workspace`,
  });
  revalidatePath(`/app/${slug}/settings/members`);
  return {};
}
