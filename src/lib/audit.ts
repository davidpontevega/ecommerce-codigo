import type { Transaction } from "@/server/db";
import { auditLogs, auditSeverity } from "@/server/db/schema";

type AuditSeverity = (typeof auditSeverity.enumValues)[number];

type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Solo campos que cambiaron. Nunca PII sensible ni secretos. */
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
  actorId?: string | null;
};

/**
 * Escribe la bitácora dentro de la transacción de la mutación auditada: si la
 * mutación revierte, el log también.
 */
export async function logAudit(
  tx: Transaction,
  entry: AuditEntry,
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    changes: entry.changes ?? null,
    metadata: entry.metadata ?? null,
    severity: entry.severity ?? "info",
  });
}
