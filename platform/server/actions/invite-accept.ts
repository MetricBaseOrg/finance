"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/workspace";
import { logAudit } from "@/server/audit";

export type AcceptInviteState = { error?: string };

export async function acceptInvite(
  token: string,
  _prev?: AcceptInviteState,
): Promise<AcceptInviteState> {
  const user = await requireUser();
  const invite = await db.orgInvite.findUnique({
    where: { token },
    include: { organization: true },
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
      userId_organizationId: { userId: user.id, organizationId: invite.organizationId },
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
            organizationId: invite.organizationId,
            role: invite.role,
          },
        }),
        db.orgInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), acceptedById: user.id },
        }),
      ]);
      await logAudit({
        organizationId: invite.organizationId,
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

  revalidatePath("/finance");
  redirect('/finance')
}
