import { db, uid, now } from '../database/db';
import type { Return, ReturnItem, InvoiceItem, PurchaseItem, Invoice, Purchase } from '../types';
import { addStockMovement } from './stockService';
import { logAudit } from './auditService';
import { getSettings } from './settingsService';

export async function generateReturnNo(): Promise<string> {
  const settings = await getSettings();
  const count = await db.returns.count();
  return `${settings.returnPrefix}${String(count + 1).padStart(3, '0')}`;
}

export interface SalesReturnDraft {
  date: number;
  invoiceId: string;
  partyId: string;
  partyName: string;
  items: { productId: string; productCode: string; productDesc: string; qty: number; rate: number; amount: number }[];
  reason: string;
  notes: string;
}

export async function createSalesReturn(draft: SalesReturnDraft): Promise<string> {
  if (draft.items.length === 0) throw new Error('Please add at least one return item');
  if (draft.items.some((item) => item.qty <= 0 || item.rate < 0 || item.amount < 0)) {
    throw new Error('Return quantities must be greater than zero and amounts cannot be negative');
  }

  const invoice = await db.invoices.get(draft.invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const invoiceItems = await db.invoiceItems.where('invoiceId').equals(draft.invoiceId).toArray();

  for (const retItem of draft.items) {
    const invItem = invoiceItems.find((it) => it.productId === retItem.productId);
    if (!invItem) throw new Error('Return item not found in invoice');
    const alreadyReturned = await getReturnedQtyForInvoice(draft.invoiceId, retItem.productId);
    if (retItem.qty > invItem.qty - alreadyReturned) {
      throw new Error(`Return quantity exceeds sold quantity for ${retItem.productDesc}`);
    }
  }

  const returnId = uid();
  const returnNo = await generateReturnNo();
  const totalAmount = draft.items.reduce((s, i) => s + i.amount, 0);

  const ret: Return = {
    id: returnId,
    returnNo,
    date: draft.date,
    type: 'SalesReturn',
    refInvoiceId: draft.invoiceId,
    refInvoiceNo: invoice.invoiceNo,
    partyId: draft.partyId,
    partyName: draft.partyName,
    supplierId: null,
    supplierName: '',
    refPurchaseId: null,
    refPurchaseNo: null,
    amount: totalAmount,
    reason: draft.reason,
    notes: draft.notes,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };

  const returnItems: ReturnItem[] = draft.items.map((item) => ({
    id: uid(),
    returnId,
    productId: item.productId,
    productCode: item.productCode,
    productDesc: item.productDesc,
    qty: item.qty,
    rate: item.rate,
    amount: item.amount,
    createdAt: now(),
    updatedAt: now(),
  }));

  await db.transaction('rw', [db.returns, db.returnItems, db.stockMovements, db.products, db.invoices, db.auditLogs], async () => {
    await db.returns.put(ret);
    await db.returnItems.bulkPut(returnItems);

    for (const item of draft.items) {
      await addStockMovement(
        item.productId,
        'SalesReturn',
        item.qty,
        true,
        returnNo,
        returnId,
        `Sales return from ${draft.partyName}`,
        draft.date
      );
    }

    const newOutstanding = invoice.outstanding - totalAmount;
    await db.invoices.put({
      ...invoice,
      outstanding: Math.max(0, newOutstanding),
      status: newOutstanding <= 0 ? 'Paid' : invoice.paymentReceived > 0 ? 'Partial' : 'Due',
      updatedAt: now(),
    });

    await logAudit('Sales Return', 'Return', returnId, `Sales return ${returnNo} for ${draft.partyName} - ${totalAmount}`);
  });

  return returnId;
}

export interface PurchaseReturnDraft {
  date: number;
  purchaseId: string;
  supplierId: string;
  supplierName: string;
  items: { productId: string; productCode: string; productDesc: string; qty: number; rate: number; amount: number }[];
  reason: string;
  notes: string;
}

export async function createPurchaseReturn(draft: PurchaseReturnDraft): Promise<string> {
  if (draft.items.length === 0) throw new Error('Please add at least one return item');
  if (draft.items.some((item) => item.qty <= 0 || item.rate < 0 || item.amount < 0)) {
    throw new Error('Return quantities must be greater than zero and amounts cannot be negative');
  }

  const purchase = await db.purchases.get(draft.purchaseId);
  if (!purchase) throw new Error('Purchase not found');

  const purchaseItems = await db.purchaseItems.where('purchaseId').equals(draft.purchaseId).toArray();

  for (const retItem of draft.items) {
    const purItem = purchaseItems.find((it) => it.productId === retItem.productId);
    if (!purItem) throw new Error('Return item not found in purchase');
    const alreadyReturned = await getReturnedQtyForPurchase(draft.purchaseId, retItem.productId);
    if (retItem.qty > purItem.qty - alreadyReturned) {
      throw new Error(`Return quantity exceeds purchased quantity for ${retItem.productDesc}`);
    }
  }

  const returnId = uid();
  const returnNo = await generateReturnNo();
  const totalAmount = draft.items.reduce((s, i) => s + i.amount, 0);

  const ret: Return = {
    id: returnId,
    returnNo,
    date: draft.date,
    type: 'PurchaseReturn',
    refInvoiceId: null,
    refInvoiceNo: null,
    refPurchaseId: draft.purchaseId,
    refPurchaseNo: purchase.billNo,
    partyId: null,
    partyName: '',
    supplierId: draft.supplierId,
    supplierName: draft.supplierName,
    amount: totalAmount,
    reason: draft.reason,
    notes: draft.notes,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };

  const returnItems: ReturnItem[] = draft.items.map((item) => ({
    id: uid(),
    returnId,
    productId: item.productId,
    productCode: item.productCode,
    productDesc: item.productDesc,
    qty: item.qty,
    rate: item.rate,
    amount: item.amount,
    createdAt: now(),
    updatedAt: now(),
  }));

  await db.transaction('rw', [db.returns, db.returnItems, db.stockMovements, db.products, db.purchases, db.auditLogs], async () => {
    await db.returns.put(ret);
    await db.returnItems.bulkPut(returnItems);

    for (const item of draft.items) {
      await addStockMovement(
        item.productId,
        'PurchaseReturn',
        item.qty,
        false,
        returnNo,
        returnId,
        `Purchase return to ${draft.supplierName}`,
        draft.date
      );
    }

    const newOutstanding = purchase.outstanding - totalAmount;
    await db.purchases.put({
      ...purchase,
      outstanding: Math.max(0, newOutstanding),
      status: newOutstanding <= 0 ? 'Paid' : purchase.paymentMade > 0 ? 'Partial' : 'Due',
      updatedAt: now(),
    });

    await logAudit('Purchase Return', 'Return', returnId, `Purchase return ${returnNo} to ${draft.supplierName} - ${totalAmount}`);
  });

  return returnId;
}

async function getReturnedQtyForInvoice(invoiceId: string, productId: string): Promise<number> {
  const returns = await db.returns.where('refInvoiceId').equals(invoiceId).toArray();
  const activeReturns = returns.filter((r) => !r.cancelled);
  let total = 0;
  for (const r of activeReturns) {
    const items = await db.returnItems.where('returnId').equals(r.id).toArray();
    for (const item of items) {
      if (item.productId === productId) total += item.qty;
    }
  }
  return total;
}

async function getReturnedQtyForPurchase(purchaseId: string, productId: string): Promise<number> {
  const returns = await db.returns.where('refPurchaseId').equals(purchaseId).toArray();
  const activeReturns = returns.filter((r) => !r.cancelled);
  let total = 0;
  for (const r of activeReturns) {
    const items = await db.returnItems.where('returnId').equals(r.id).toArray();
    for (const item of items) {
      if (item.productId === productId) total += item.qty;
    }
  }
  return total;
}

export async function getReturns(limit?: number): Promise<Return[]> {
  const all = await db.returns.orderBy('createdAt').reverse().toArray();
  const filtered = all.filter((r) => !r.cancelled);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getReturnItems(returnId: string): Promise<ReturnItem[]> {
  return db.returnItems.where('returnId').equals(returnId).toArray();
}

export async function cancelReturn(id: string): Promise<void> {
  const ret = await db.returns.get(id);
  if (!ret) return;
  if (ret.cancelled) return;

  const items = await db.returnItems.where('returnId').equals(id).toArray();

  await db.transaction('rw', [db.returns, db.returnItems, db.stockMovements, db.products, db.invoices, db.purchases, db.auditLogs], async () => {
    await db.returns.put({ ...ret, cancelled: true, updatedAt: now() });

    for (const item of items) {
      const isIn = ret.type === 'SalesReturn';
      await addStockMovement(
        item.productId,
        'Correction',
        item.qty,
        !isIn,
        `Cancelled ${ret.returnNo}`,
        id,
        'Stock adjusted from cancelled return',
        now()
      );
    }

    if (ret.type === 'SalesReturn' && ret.refInvoiceId) {
      const invoice = await db.invoices.get(ret.refInvoiceId);
      if (invoice && !invoice.cancelled) {
        const outstanding = invoice.outstanding + ret.amount;
        const paymentReceived = invoice.paymentReceived;
        await db.invoices.put({
          ...invoice,
          outstanding,
          status: outstanding <= 0 ? 'Paid' : paymentReceived > 0 ? 'Partial' : 'Due',
          updatedAt: now(),
        });
      }
    }

    if (ret.type === 'PurchaseReturn' && ret.refPurchaseId) {
      const purchase = await db.purchases.get(ret.refPurchaseId);
      if (purchase && !purchase.cancelled) {
        const outstanding = purchase.outstanding + ret.amount;
        const paymentMade = purchase.paymentMade;
        await db.purchases.put({
          ...purchase,
          outstanding,
          status: outstanding <= 0 ? 'Paid' : paymentMade > 0 ? 'Partial' : 'Due',
          updatedAt: now(),
        });
      }
    }

    await logAudit('Return Cancelled', 'Return', id, `Cancelled return ${ret.returnNo}`);
  });
}
