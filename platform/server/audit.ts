import 'server-only'
import { db } from '@/server/db'

// Finance audit shim. Ported finance code calls logAudit with string action /
// entityType values (e.g. "CREATE" / "ACCOUNT"). These are written into the
// platform's generic AuditLog (module = "finance"). The cross-cutting audit
// model is unified here rather than keeping a finance-specific table.
//
// NOTE: callers were rekeyed workspaceId → organizationId by the port, so the
// input field is `organizationId`.
type LogAuditInput = {
  organizationId: string
  userId?: string | null
  action: string
  entityType: string
  entityId: string
  summary: string
  metadata?: unknown
}

// Best-effort: an audit write must never break the mutation it records.
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.userId ?? null,
        module: 'finance',
        action: input.action,
        entity: input.entityType,
        entityId: input.entityId,
        // Summary folded into the metadata JSON alongside any structured detail.
        metadata: JSON.stringify({
          summary: input.summary,
          ...(input.metadata && typeof input.metadata === 'object'
            ? (input.metadata as Record<string, unknown>)
            : input.metadata !== undefined
              ? { detail: input.metadata }
              : {}),
        }),
      },
    })
  } catch (e) {
    console.error('audit log failed', e)
  }
}
