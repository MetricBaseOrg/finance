import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user;
}

export async function getCurrentUserWorkspaces() {
  const user = await requireUser();
  return db.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { workspace: { createdAt: "asc" } },
  });
}

export async function requireMembership(
  slug: string,
  requiredRole?: "ADMIN" | "MEMBER",
) {
  const user = await requireUser();
  const workspace = await db.workspace.findUnique({ where: { slug } });
  if (!workspace) redirect("/app");

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
  });
  if (!membership) redirect("/app");

  if (requiredRole && membership.role !== requiredRole) {
    redirect("/app");
  }

  return { user, workspace, membership };
}

// Phase 2 deliberately gates ONLY member/invite/audit management to
// OWNER/ADMIN. A full RBAC sweep across accounts/transactions/etc. is
// intentionally out of scope for this phase.
export async function requireRole(slug: string, allowed: Role[]) {
  const ctx = await requireMembership(slug);
  if (!allowed.includes(ctx.membership.role)) {
    redirect(`/app/${slug}/dashboard`);
  }
  return ctx;
}

// Returns true when the given membership is the workspace's only OWNER, so
// callers can block role downgrades / removals that would orphan it.
export async function isSoleOwner(
  workspaceId: string,
  membershipId: string,
): Promise<boolean> {
  const m = await db.membership.findUnique({ where: { id: membershipId } });
  if (!m || m.workspaceId !== workspaceId || m.role !== "OWNER") return false;
  const ownerCount = await db.membership.count({
    where: { workspaceId, role: "OWNER" },
  });
  return ownerCount <= 1;
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}
