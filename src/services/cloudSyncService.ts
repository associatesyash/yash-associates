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
  supplierPayments: 'supplier_payments', stockMovements: 'stock_movements', auditLogs: 'audit_logs',
};

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

export async function syncLocalData(session: Session): Promise<{ uploaded: number; downloaded: number }> {
  if (!supabase || !session.user) return { uploaded: 0, downloaded: 0 };
  let uploaded = 0;
  let downloaded = 0;

  for (const localTable of TABLES) {
    const cloudTable = TABLE_NAMES[localTable] || localTable;
    const localRows = await (db as unknown as Record<string, { toArray: () => Promise<Record<string, unknown>[]> }>)[localTable].toArray();
    const { data: cloudRows, error: readError } = await supabase.from(cloudTable).select('*');
    if (readError) throw readError;

    const localIds = new Set(localRows.map((row) => row.id));
    const remoteIds = new Set((cloudRows || []).map((row) => row.id));
    const rowsToUpload = localRows.filter((row) => !remoteIds.has(row.id) || Number(row.updatedAt || 0) >= Number(new Date(cloudRows?.find((remote) => remote.id === row.id)?.updated_at || 0)));

    if (rowsToUpload.length > 0) {
      const { error } = await supabase.from(cloudTable).upsert(rowsToUpload.map((row) => toCloudRow(row, session.user.id)));
      if (error) throw error;
      uploaded += rowsToUpload.length;
    }

    const rowsToDownload = (cloudRows || []).filter((row) => !localIds.has(row.id) || Number(new Date(row.updated_at)) > Number(localRows.find((local) => local.id === row.id)?.updatedAt || 0));
    if (rowsToDownload.length > 0) {
      await (db as unknown as Record<string, { bulkPut: (rows: Record<string, unknown>[]) => Promise<unknown> }>)[localTable].bulkPut(rowsToDownload.map(toLocalRow));
      downloaded += rowsToDownload.length;
    }
  }

  return { uploaded, downloaded };
}
