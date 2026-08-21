import { db, uid, now } from '../database/db';
import type { BackupMetadata } from '../types';

const TABLES = [
  'parties',
  'products',
  'invoices',
  'invoiceItems',
  'payments',
  'paymentAllocations',
  'suppliers',
  'purchases',
  'purchaseItems',
  'supplierPayments',
  'returns',
  'returnItems',
  'stockMovements',
  'expenses',
  'categories',
  'brands',
  'settings',
  'auditLogs',
] as const;

const BACKUP_VERSION = 1;

export async function createBackup(): Promise<{ filename: string; blob: Blob; recordCount: number }> {
  const data: Record<string, unknown[]> = {};
  let recordCount = 0;
  for (const table of TABLES) {
    const records = await (db as any)[table].toArray();
    data[table] = records;
    recordCount += records.length;
  }

  const backup = {
    version: BACKUP_VERSION,
    timestamp: now(),
    data,
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const date = new Date();
  const filename = `yash-backup-${date.toISOString().slice(0, 10)}-${date.getTime()}.json`;

  const meta: BackupMetadata = {
    id: uid(),
    filename,
    size: blob.size,
    recordCount,
    version: BACKUP_VERSION,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.backupMetadata.put(meta);

  return { filename, blob, recordCount };
}

export async function restoreBackup(file: File): Promise<{ recordCount: number; tableCount: number }> {
  const text = await file.text();
  let backup: any;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('Invalid backup file: not valid JSON');
  }

  if (!backup.version || !backup.data) {
    throw new Error('Invalid backup file: missing required fields');
  }

  if (backup.version > BACKUP_VERSION) {
    throw new Error(`Backup version ${backup.version} is newer than supported version ${BACKUP_VERSION}`);
  }

  for (const table of TABLES) {
    if (!backup.data[table]) {
      throw new Error(`Invalid backup: missing table "${table}"`);
    }
  }

  let recordCount = 0;
  await db.transaction('rw', TABLES.map((t) => (db as any)[t]), async () => {
    for (const table of TABLES) {
      await (db as any)[table].clear();
      const records = backup.data[table];
      if (records.length > 0) {
        await (db as any)[table].bulkPut(records);
      }
      recordCount += records.length;
    }
  });

  return { recordCount, tableCount: TABLES.length };
}

export async function getBackupInfo(): Promise<{ lastBackup: BackupMetadata | null; totalRecords: number }> {
  const metas = await db.backupMetadata.orderBy('createdAt').reverse().toArray();
  const lastBackup = metas[0] || null;

  let totalRecords = 0;
  for (const table of TABLES) {
    totalRecords += await (db as any)[table].count();
  }

  return { lastBackup, totalRecords };
}

export function downloadBackup(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
