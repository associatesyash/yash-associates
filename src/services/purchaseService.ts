import { db, uid, now } from '../database/db';
import type { Supplier, Purchase, PurchaseItem, SupplierPayment } from '../types';
import { addStockMovement } from './stockService';
import { logAudit } from './auditService';
import { getSettings } from './settingsService';

export async function getSuppliers(): Promise<Supplier[]> {
  return db.suppliers.orderBy('createdAt').reverse().toArray();
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  return db.suppliers.get(id);
}

export async function saveSupplier(
  supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  if (supplier.id) {
    const existing = await db.suppliers.get(supplier.id);
    if (!existing) throw new Error('Supplier not found');
    await db.suppliers.put({
      ...existing,
      ...supplier,
      id: supplier.id,
      updatedAt: now(),
    });
    await logAudit('Supplier Updated', 'Supplier', supplier.id, `Updated supplier: ${supplier.name}`);
    return supplier.id;
  }
  const id = uid();
  const newSupplier: Supplier = {
    ...supplier,
    id,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.suppliers.put(newSupplier);
  await logAudit('Supplier Created', 'Supplier', id, `Created supplier: ${supplier.name}`);
  return id;
}

export async function deleteSupplier(id: string): Promise<void> {
  const supplier = await db.suppliers.get(id);
  if (!supplier) return;
  const purchases = await db.purchases.where('supplierId').equals(id).toArray();
  if (purchases.length > 0) {
    throw new Error('Cannot delete supplier with existing purchases. Deactivate instead.');
  }
  await db.suppliers.delete(id);
  await logAudit('Supplier Deleted', 'Supplier', id, `Deleted supplier: ${supplier.name}`);
}

export async function toggleSupplierActive(id: string): Promise<void> {
  const supplier = await db.suppliers.get(id);
  if (!supplier) return;
  await db.suppliers.put({ ...supplier, active: !supplier.active, updatedAt: now() });
  await logAudit('Supplier Updated', 'Supplier', id, `${supplier.active ? 'Deactivated' : 'Activated'} supplier: ${supplier.name}`);
}

export async function generatePurchaseNo(): Promise<string> {
  const settings = await getSettings();
  const count = await db.purchases.count();
  return `${settings.purchasePrefix}${String(count + 1).padStart(3, '0')}`;
}

export async function generateSupplierPaymentNo(): Promise<string> {
  const settings = await getSettings();
  const count = await db.supplierPayments.count();
  return `${settings.receiptPrefix}${String(count + 1).padStart(3, '0')}`;
}

export interface PurchaseDraft {
  date: number;
  supplierId: string;
  supplierName: string;
  items: {
    productId: string;
    productCode: string;
    productDesc: string;
    category: string;
    brand: string;
    size: string;
    color: string;
    unit: string;
    qty: number;
    rate: number;
    mrp: number;
    purchaseRate: number;
    saleRate: number;
    discount: number;
    discountRate?: number;
    extraDiscountRate?: number;
    extraDiscount?: number;
    gstRate?: number;
    gstAmount?: number;
    amount: number;
  }[];
  discountAmount: number;
  billDiscountRate?: number;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: number;
  purchaseType?: string;
  purchaseFrom?: string;
  paymentTerms?: string;
  dueDate?: number;
  notes: string;
  paymentMade: number;
  paymentMode: string;
  paymentRef: string;
}

export async function createPurchase(draft: PurchaseDraft): Promise<string> {
  if (!draft.supplierId) throw new Error('Please select a supplier');
  if (draft.items.length === 0) throw new Error('Please add at least one item');
  if (draft.items.some((item) => item.qty <= 0 || item.mrp <= 0 || item.purchaseRate <= 0 || item.saleRate <= 0 || item.discount < 0)) {
    throw new Error('Quantity and MRP, purchase rate, and sale rate must be greater than zero');
  }

  const subtotal = draft.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const itemDiscounts = draft.items.reduce((s, i) => s + i.discount, 0);
  const extraDiscounts = draft.items.reduce((s, i) => s + (i.extraDiscount || 0), 0);
  const afterItemDiscount = subtotal - itemDiscounts;
  const billDiscount = draft.discountAmount || 0;
  const taxableAmount = afterItemDiscount - extraDiscounts - billDiscount;
  const taxAmount = draft.items.reduce((s, i) => s + ((i.qty * i.rate - i.discount - (i.extraDiscount || 0)) * (i.gstRate || 0) / 100), 0);
  const beforeRound = taxableAmount + taxAmount;
  const grandTotal = Math.round(beforeRound);
  const roundOff = grandTotal - beforeRound;
  const paymentMade = draft.paymentMade || 0;
  if (paymentMade < 0 || paymentMade > grandTotal) {
    throw new Error('Payment made must be between zero and the purchase total');
  }
  const outstanding = grandTotal - paymentMade;
  const status: 'Paid' | 'Partial' | 'Due' =
    outstanding <= 0 ? 'Paid' : paymentMade > 0 ? 'Partial' : 'Due';

  const purchaseId = uid();
  const billNo = await generatePurchaseNo();

  const purchase: Purchase = {
    id: purchaseId,
    billNo,
    date: draft.date,
    supplierId: draft.supplierId,
    supplierName: draft.supplierName,
    subtotal,
    discountAmount: draft.discountAmount + itemDiscounts + extraDiscounts,
    billDiscountRate: draft.billDiscountRate,
    supplierInvoiceNo: draft.supplierInvoiceNo,
    supplierInvoiceDate: draft.supplierInvoiceDate,
    purchaseType: draft.purchaseType,
    purchaseFrom: draft.purchaseFrom,
    paymentTerms: draft.paymentTerms,
    dueDate: draft.dueDate,
    taxAmount,
    roundOff,
    grandTotal,
    paymentMade,
    outstanding,
    status,
    notes: draft.notes,
    paymentMode: draft.paymentMode,
    paymentRef: draft.paymentRef,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };

  const itemRecords: PurchaseItem[] = draft.items.map((item) => ({
    id: uid(),
    purchaseId,
    productId: item.productId,
    productCode: item.productCode,
    productDesc: item.productDesc,
    category: item.category,
    brand: item.brand,
    size: item.size,
    color: item.color,
    unit: item.unit,
    qty: item.qty,
    rate: item.rate,
    mrp: item.mrp,
    purchaseRate: item.purchaseRate,
    saleRate: item.saleRate,
    discount: item.discount,
    discountRate: item.discountRate,
    extraDiscountRate: item.extraDiscountRate,
    extraDiscount: item.extraDiscount,
    gstRate: item.gstRate,
    gstAmount: item.gstAmount,
    amount: item.amount,
    createdAt: now(),
    updatedAt: now(),
  }));

  await db.transaction('rw', [db.purchases, db.purchaseItems, db.stockMovements, db.products, db.supplierPayments, db.auditLogs], async () => {
    await db.purchases.put(purchase);
    await db.purchaseItems.bulkPut(itemRecords);

    for (const item of draft.items) {
      await addStockMovement(
        item.productId,
        'Purchase',
        item.qty,
        true,
        billNo,
        purchaseId,
        `Purchase from ${draft.supplierName}`,
        draft.date
      );
    }

    if (paymentMade > 0) {
      const receiptNo = await generateSupplierPaymentNo();
      const sp: SupplierPayment = {
        id: uid(),
        receiptNo,
        date: draft.date,
        supplierId: draft.supplierId,
        supplierName: draft.supplierName,
        amount: paymentMade,
        mode: draft.paymentMode,
        reference: draft.paymentRef,
        notes: `Payment for ${billNo}`,
        purchaseId,
        purchaseNo: billNo,
        cancelled: false,
        createdAt: now(),
        updatedAt: now(),
      };
      await db.supplierPayments.put(sp);
    }

    await logAudit('Purchase Created', 'Purchase', purchaseId, `Created purchase ${billNo} from ${draft.supplierName} - ${grandTotal}`);
  });

  return purchaseId;
}

export async function cancelPurchase(id: string): Promise<void> {
  const purchase = await db.purchases.get(id);
  if (!purchase) return;
  if (purchase.cancelled) return;

  const items = await db.purchaseItems.where('purchaseId').equals(id).toArray();

  await db.transaction('rw', [db.purchases, db.purchaseItems, db.stockMovements, db.products, db.supplierPayments, db.auditLogs], async () => {
    await db.purchases.put({ ...purchase, cancelled: true, updatedAt: now() });

    for (const item of items) {
      await addStockMovement(
        item.productId,
        'Correction',
        item.qty,
        false,
        `Cancelled ${purchase.billNo}`,
        id,
        'Stock removed from cancelled purchase',
        now()
      );
    }

    const sps = await db.supplierPayments.where('purchaseId').equals(id).toArray();
    for (const sp of sps) {
      await db.supplierPayments.put({ ...sp, cancelled: true, updatedAt: now() });
    }

    await logAudit('Purchase Cancelled', 'Purchase', id, `Cancelled purchase ${purchase.billNo}`);
  });
}

export async function getPurchases(limit?: number): Promise<Purchase[]> {
  const all = await db.purchases.orderBy('createdAt').reverse().toArray();
  const filtered = all.filter((p) => !p.cancelled);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  return db.purchaseItems.where('purchaseId').equals(purchaseId).toArray();
}

export async function getSupplierOutstanding(supplierId: string): Promise<number> {
  const supplier = await db.suppliers.get(supplierId);
  if (!supplier) return 0;
  let outstanding = supplier.openingBalance;
  const purchases = await db.purchases.where('supplierId').equals(supplierId).toArray();
  for (const p of purchases) {
    if (!p.cancelled) outstanding += p.outstanding;
  }
  return outstanding;
}

export async function getSupplierLedger(supplierId: string) {
  const supplier = await db.suppliers.get(supplierId);
  if (!supplier) return [];
  const entries: any[] = [];

  if (supplier.openingBalance !== 0) {
    entries.push({
      date: supplier.createdAt,
      reference: 'Opening',
      description: 'Opening Balance',
      credit: supplier.openingBalance > 0 ? supplier.openingBalance : 0,
      debit: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0,
      balance: supplier.openingBalance,
      type: 'Opening',
    });
  }

  const purchases = await db.purchases.where('supplierId').equals(supplierId).toArray();
  for (const p of purchases) {
    if (!p.cancelled) {
      entries.push({
        date: p.date,
        reference: p.billNo,
        description: 'Purchase',
        credit: p.grandTotal,
        debit: 0,
        balance: 0,
        type: 'Purchase',
      });
    }
  }

  const sps = await db.supplierPayments.where('supplierId').equals(supplierId).toArray();
  for (const sp of sps) {
    if (!sp.cancelled) {
      entries.push({
        date: sp.date,
        reference: sp.receiptNo,
        description: 'Payment Made',
        credit: 0,
        debit: sp.amount,
        balance: 0,
        type: 'Payment',
      });
    }
  }

  entries.sort((a, b) => a.date - b.date);
  let running = supplier.openingBalance;
  for (const e of entries) {
    if (e.type === 'Opening') {
      e.balance = running;
    } else {
      running += e.credit - e.debit;
      e.balance = running;
    }
  }
  return entries;
}

export async function getSupplierPayments(supplierId: string): Promise<SupplierPayment[]> {
  const sps = await db.supplierPayments.where('supplierId').equals(supplierId).toArray();
  return sps.filter((s) => !s.cancelled).sort((a, b) => b.date - a.date);
}

export async function paySupplier(
  supplierId: string,
  supplierName: string,
  amount: number,
  mode: string,
  reference: string,
  notes: string,
  date: number,
  purchaseId: string | null = null,
  purchaseNo: string | null = null
): Promise<string> {
  if (amount <= 0) throw new Error('Payment amount must be greater than zero');
  if (purchaseId) {
    const purchase = await db.purchases.get(purchaseId);
    if (!purchase || purchase.cancelled || purchase.supplierId !== supplierId) {
      throw new Error('Selected purchase does not belong to this supplier');
    }
    if (amount > purchase.outstanding) throw new Error('Payment exceeds purchase outstanding');
  }
  const id = uid();
  const receiptNo = await generateSupplierPaymentNo();
  const sp: SupplierPayment = {
    id,
    receiptNo,
    date,
    supplierId,
    supplierName,
    amount,
    mode,
    reference,
    notes,
    purchaseId,
    purchaseNo,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };

  await db.transaction('rw', db.supplierPayments, db.purchases, db.auditLogs, async () => {
    await db.supplierPayments.put(sp);
    if (purchaseId) {
      const purchase = await db.purchases.get(purchaseId);
      if (purchase && !purchase.cancelled) {
        const newPayment = purchase.paymentMade + amount;
        const newOutstanding = purchase.grandTotal - newPayment;
        const newStatus: 'Paid' | 'Partial' | 'Due' =
          newOutstanding <= 0 ? 'Paid' : newPayment > 0 ? 'Partial' : 'Due';
        await db.purchases.put({
          ...purchase,
          paymentMade: newPayment,
          outstanding: newOutstanding,
          status: newStatus,
          updatedAt: now(),
        });
      }
    }
    await logAudit('Supplier Payment', 'SupplierPayment', id, `Paid ${amount} to ${supplierName} - ${receiptNo}`);
  });

  return id;
}
