import type { Session } from '@supabase/supabase-js';
import { db } from '@/database/db';
import { supabase } from '@/lib/supabase';

const TABLES = [
  'parties', 'products', 'suppliers', 'categories', 'brands', 'invoices', 'invoiceItems',
  'payments', 'paymentAllocations', 'purchases', 'purchaseItems', 'supplierPayments',
  'returns', 'returnItems', 'stockMovements', 'expenses', 'settings', 'auditLogs',
] as const;

const TABLE_NAMES: Record<string, string> = {
  invoiceItems: 'invoice_items', paymentAllocations: 'payment_allocations', purchaseItems: 'purchase_items',
  supplierPayments: 'supplier_payments', returnItems: 'return_items', stockMovements: 'stock_movements', auditLogs: 'audit_logs',
};

let activeSync: Promise<{ uploaded: number; downloaded: number }> | null = null;
let lastSyncAt = 0;
const SYNC_COOLDOWN_MS = 10000;

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toCloudRow(row: Record<string, unknown>, ownerId: string) {
  const result: Record<string, unknown> = { owner_id: ownerId };
  for (const [key, value] of Object.entries(row)) {
    if (key === 'owner_id') continue;
    const cloudKey = toSnakeCase(key);
    result[cloudKey] = ['date', 'created_at', 'updated_at'].includes(cloudKey) && typeof value === 'number'
      ? new Date(value).toISOString()
      : value;
  }
  return result;
}

function toLocalRow(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'owner_id') continue;
    const localKey = toCamelCase(key);
    result[localKey] = ['date', 'createdAt', 'updatedAt'].includes(localKey) && typeof value === 'string'
      ? new Date(value).getTime()
      : value;
  }
  return result;
}

function getNaturalKey(table: string, row: Record<string, unknown>): string | null {
  if (table === 'categories') return `${row.name}|${row.type}`;
  if (table === 'brands') return String(row.name);
  if (table === 'invoices') return String(row.invoice_no);
  if (table === 'purchases') return String(row.bill_no);
  if (table === 'payments') return String(row.receipt_no);
  if (table === 'supplier_payments') return String(row.receipt_no);
  if (table === 'returns') return String(row.return_no);
  return null;
}

export async function syncLocalData(session: Session): Promise<{ uploaded: number; downloaded: number }> {
  if (!supabase || !session.user) return { uploaded: 0, downloaded: 0 };
  if (activeSync) return activeSync;
  if (Date.now() - lastSyncAt < SYNC_COOLDOWN_MS) return { uploaded: 0, downloaded: 0 };

  activeSync = runSync(session);
  try {
    return await activeSync;
  } finally {
    lastSyncAt = Date.now();
    activeSync = null;
  }
}

async function runSync(session: Session): Promise<{ uploaded: number; downloaded: number }> {
  const client = supabase;
  if (!client || !session.user) return { uploaded: 0, downloaded: 0 };
  let uploaded = 0;
  let downloaded = 0;

  for (const localTable of TABLES) {
    const cloudTable = TABLE_NAMES[localTable] || localTable;
    const localRows = await (db as unknown as Record<string, { toArray: () => Promise<Record<string, unknown>[]> }>)[localTable].toArray();
    const { data: cloudRows, error: readError } = await client.from(cloudTable).select('*');
    if (readError) {
      // Allow the rest of the ERP to sync if an optional table has not been migrated yet.
      if (readError.code === 'PGRST205') continue;
      throw readError;
    }

    const localIds = new Set(localRows.map((row) => row.id));
    const remoteIds = new Set((cloudRows || []).map((row) => row.id));
    const rowsToUpload = localRows.filter((row) => !remoteIds.has(row.id) || Number(row.updatedAt || 0) >= Number(new Date(cloudRows?.find((remote) => remote.id === row.id)?.updated_at || 0)));
    const naturalKeys = new Set<string>();
    const deduplicatedRows = rowsToUpload.filter((row) => {
      const key = getNaturalKey(cloudTable, row);
      if (!key) return true;
      if (naturalKeys.has(key)) return false;
      naturalKeys.add(key);
      return !(cloudRows || []).some((remote) => getNaturalKey(cloudTable, remote) === key && remote.id !== row.id);
    });

    if (deduplicatedRows.length > 0) {
      const { error } = await client.from(cloudTable).upsert(deduplicatedRows.map((row) => toCloudRow(row, session.user.id)));
      if (error) {
        if (error.code === 'PGRST205') continue;
        throw error;
      }
      uploaded += deduplicatedRows.length;
    }

    const rowsToDownload = (cloudRows || []).filter((row) => !localIds.has(row.id) || Number(new Date(row.updated_at)) > Number(localRows.find((local) => local.id === row.id)?.updatedAt || 0));
    if (rowsToDownload.length > 0) {
      await (db as unknown as Record<string, { bulkPut: (rows: Record<string, unknown>[]) => Promise<unknown> }>)[localTable].bulkPut(rowsToDownload.map(toLocalRow));
      downloaded += rowsToDownload.length;
    }
  }

  return { uploaded, downloaded };
}
