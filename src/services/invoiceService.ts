import { db, uid, now } from '../database/db';
import type { Invoice, InvoiceItem, Payment, Settings } from '../types';
import { addStockMovement, getCurrentStock } from './stockService';
import { logAudit } from './auditService';
import { getSettings } from './settingsService';

export interface InvoiceDraft {
  id?: string;
  date: number;
  partyId: string;
  partyName: string;
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
    discount: number;
    discountRate?: number;
    amount: number;
  }[];
  discountAmount: number;
  billDiscountRate?: number;
  notes: string;
  salesperson?: string;
  paymentReceived: number;
  paymentMode: string;
  paymentRef: string;
}

export async function generateInvoiceNo(): Promise<string> {
  const settings = await getSettings();
  const count = await db.invoices.count();
  return `${settings.invoicePrefix}${String(count + 1).padStart(3, '0')}`;
}

export async function generateReceiptNo(): Promise<string> {
  const settings = await getSettings();
  const count = await db.payments.count();
  return `${settings.receiptPrefix}${String(count + 1).padStart(3, '0')}`;
}

function calcInvoiceTotals(draft: InvoiceDraft, settings: Settings) {
  const subtotal = draft.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const itemDiscounts = draft.items.reduce((s, i) => s + i.discount, 0);
  const afterItemDiscount = subtotal - itemDiscounts;
  const billDiscount = draft.discountAmount || 0;
  const taxableAmount = afterItemDiscount - billDiscount;
  const taxAmount = settings.taxEnabled ? Math.round(taxableAmount * settings.taxRate) / 100 : 0;
  const beforeRound = taxableAmount + taxAmount;
  const grandTotal = Math.round(beforeRound);
  const roundOff = grandTotal - beforeRound;
  const paymentReceived = draft.paymentReceived || 0;
  const outstanding = grandTotal - paymentReceived;
  const status: 'Paid' | 'Partial' | 'Due' =
    outstanding <= 0 ? 'Paid' : paymentReceived > 0 ? 'Partial' : 'Due';
  return { subtotal, itemDiscounts, taxAmount, roundOff, grandTotal, paymentReceived, outstanding, status };
}

export async function createInvoice(draft: InvoiceDraft): Promise<string> {
  if (!draft.partyId) throw new Error('Please select a party');
  if (draft.items.length === 0) throw new Error('Please add at least one item');
  if (draft.items.some((item) => item.qty <= 0 || item.rate < 0 || item.discount < 0)) {
    throw new Error('Quantity must be greater than zero and rates or discounts cannot be negative');
  }

  for (const item of draft.items) {
    const stock = await getCurrentStock(item.productId);
    if (item.qty > stock) {
      throw new Error(`Insufficient stock for ${item.productDesc}. Available: ${stock}`);
    }
  }

  const settings = await getSettings();
  const totals = calcInvoiceTotals(draft, settings);
  if (totals.paymentReceived < 0 || totals.paymentReceived > totals.grandTotal) {
    throw new Error('Payment received must be between zero and the invoice total');
  }
  const invoiceId = uid();
  const invoiceNo = await generateInvoiceNo();

  const invoice: Invoice = {
    id: invoiceId,
    invoiceNo,
    date: draft.date,
    partyId: draft.partyId,
    partyName: draft.partyName,
    subtotal: totals.subtotal,
    discountAmount: draft.discountAmount + totals.itemDiscounts,
    billDiscountRate: draft.billDiscountRate,
    taxAmount: totals.taxAmount,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    paymentReceived: totals.paymentReceived,
    outstanding: totals.outstanding,
    status: totals.status,
    notes: draft.notes,
    salesperson: draft.salesperson,
    paymentMode: draft.paymentMode,
    paymentRef: draft.paymentRef,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };

  const itemRecords: InvoiceItem[] = draft.items.map((item) => ({
    id: uid(),
    invoiceId,
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
    discount: item.discount,
    discountRate: item.discountRate,
    amount: item.amount,
    createdAt: now(),
    updatedAt: now(),
  }));

  await db.transaction('rw', [db.invoices, db.invoiceItems, db.stockMovements, db.products, db.payments, db.auditLogs], async () => {
    await db.invoices.put(invoice);
    await db.invoiceItems.bulkPut(itemRecords);

    for (const item of draft.items) {
      await addStockMovement(
        item.productId,
        'Sale',
        item.qty,
        false,
        invoiceNo,
        invoiceId,
        `Sale to ${draft.partyName}`,
        draft.date
      );
    }

    if (totals.paymentReceived > 0) {
      const receiptNo = await generateReceiptNo();
      const payment: Payment = {
        id: uid(),
        receiptNo,
        date: draft.date,
        partyId: draft.partyId,
        partyName: draft.partyName,
        amount: totals.paymentReceived,
        mode: draft.paymentMode,
        reference: draft.paymentRef,
        notes: `Payment for ${invoiceNo}`,
        invoiceId,
        invoiceNo,
        isAdvance: false,
        cancelled: false,
        createdAt: now(),
        updatedAt: now(),
      };
      await db.payments.put(payment);
    }

    await logAudit('Invoice Created', 'Invoice', invoiceId, `Created invoice ${invoiceNo} for ${draft.partyName} - ${totals.grandTotal}`);
  });

  return invoiceId;
}

export async function cancelInvoice(id: string): Promise<void> {
  const invoice = await db.invoices.get(id);
  if (!invoice) return;
  if (invoice.cancelled) return;

  const items = await db.invoiceItems.where('invoiceId').equals(id).toArray();

  await db.transaction('rw', [db.invoices, db.invoiceItems, db.stockMovements, db.products, db.payments, db.paymentAllocations, db.auditLogs], async () => {
    await db.invoices.put({ ...invoice, cancelled: true, updatedAt: now() });

    for (const item of items) {
      await addStockMovement(
        item.productId,
        'Correction',
        item.qty,
        true,
        `Cancelled ${invoice.invoiceNo}`,
        id,
        'Stock restored from cancelled invoice',
        now()
      );
    }

    const payments = await db.payments.where('invoiceId').equals(id).toArray();
    for (const pmt of payments) {
      await db.payments.put({ ...pmt, cancelled: true, updatedAt: now() });
    }

    await logAudit('Invoice Cancelled', 'Invoice', id, `Cancelled invoice ${invoice.invoiceNo}`);
  });
}

export async function getInvoices(limit?: number): Promise<Invoice[]> {
  const all = await db.invoices.orderBy('createdAt').reverse().toArray();
  const filtered = all.filter((i) => !i.cancelled);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  return db.invoices.get(id);
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  return db.invoiceItems.where('invoiceId').equals(invoiceId).toArray();
}

export async function getInvoiceWithItems(invoiceId: string) {
  const invoice = await db.invoices.get(invoiceId);
  if (!invoice) return null;
  const items = await getInvoiceItems(invoiceId);
  return { invoice, items };
}

export async function getOutstandingInvoices(partyId?: string): Promise<Invoice[]> {
  let invoices: Invoice[];
  if (partyId) {
    invoices = await db.invoices.where('partyId').equals(partyId).toArray();
  } else {
    invoices = await db.invoices.toArray();
  }
  return invoices
    .filter((i) => !i.cancelled && i.outstanding > 0)
    .sort((a, b) => a.date - b.date);
}
