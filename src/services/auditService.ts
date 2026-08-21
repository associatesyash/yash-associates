import { db, uid, now } from '../database/db';
import type { AuditLog } from '../types';

export async function logAudit(
  action: string,
  entity: string,
  entityId: string,
  description: string
): Promise<void> {
  const entry: AuditLog = {
    id: uid(),
    action,
    entity,
    entityId,
    description,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.auditLogs.put(entry);
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  return db.auditLogs.orderBy('createdAt').reverse().limit(limit).toArray();
}
