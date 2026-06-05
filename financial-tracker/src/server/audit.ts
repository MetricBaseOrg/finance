import "server-only";
import { Prisma, type AuditAction, type AuditEntityType } from "@prisma/client";
import { db } from "@/server/db";

type LogAuditInput = {
  workspaceId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

// Best-effort: an audit write must never break the mutation it records.
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata ?? Prisma.DbNull,
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
