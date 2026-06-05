"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/workspace";
import { logAudit } from "@/server/audit";

export type AcceptInviteState = { error?: string };

export async function acceptInvite(
  token: string,
  _prev?: AcceptInviteState,
): Promise<AcceptInviteState> {
  const user = await requireUser();
  const invite = await db.workspaceInvite.findUnique({
    where: { token },
    include: { workspace: true },
  });
  if (!invite) return { error: "This invite link is invalid." };
  if (invite.expiresAt.getTime() <= Date.now()) {
    return { error: "This invite has expired. Ask an admin for a new link." };
  }
  if (
    invite.email &&
    invite.email !== (user.email ?? "").toLowerCase()
  ) {
    return {
      error: `This invite was issued for ${invite.email}. Sign in with that email to accept it.`,
    };
  }

  const existing = await db.membership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId },
    },
  });

  if (!existing) {
    if (invite.acceptedAt) {
      return { error: "This invite has already been used." };
    }
    try {
      await db.$transaction([
        db.membership.create({
          data: {
            userId: user.id,
            workspaceId: invite.workspaceId,
            role: invite.role,
          },
        }),
        db.workspaceInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), acceptedByUserId: user.id },
        }),
      ]);
      await logAudit({
        workspaceId: invite.workspaceId,
        userId: user.id,
        action: "INVITE_ACCEPT",
        entityType: "MEMBERSHIP",
        entityId: invite.id,
        summary: `${user.email} joined as ${invite.role}`,
      });
    } catch (e) {
      // Idempotent: a concurrent accept already created the membership.
      if (
        !(
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        )
      ) {
        throw e;
      }
    }
  }

  revalidatePath("/app");
  redirect(`/app/${invite.workspace.slug}/dashboard`);
}
