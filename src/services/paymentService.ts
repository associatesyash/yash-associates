import { db, uid, now } from '../database/db';
import type { Payment, PaymentAllocation, Invoice } from '../types';
import { logAudit } from './auditService';
import { generateReceiptNo } from './invoiceService';

export interface PaymentDraft {
  date: number;
  partyId: string;
  partyName: string;
  amount: number;
  mode: string;
  reference: string;
  notes: string;
  allocations: { invoiceId: string; invoiceNo: string; amount: number }[];
  isAdvance: boolean;
}

export async function receivePayment(draft: PaymentDraft): Promise<string> {
  if (!draft.partyId) throw new Error('Please select a party');
  if (draft.amount <= 0) throw new Error('Payment amount must be greater than zero');
  if (draft.allocations.some((allocation) => allocation.amount <= 0)) {
    throw new Error('Allocated payment amounts must be greater than zero');
  }

  const totalAllocated = draft.allocations.reduce((s, a) => s + a.amount, 0);
  if (totalAllocated > draft.amount + 0.01) {
    throw new Error('Allocated amount exceeds payment amount');
  }

  for (const allocation of draft.allocations) {
    const invoice = await db.invoices.get(allocation.invoiceId);
    if (!invoice || invoice.cancelled || invoice.partyId !== draft.partyId) {
      throw new Error('Every allocated invoice must belong to the selected party');
    }
    if (allocation.amount > invoice.outstanding + 0.01) {
      throw new Error(`Payment exceeds outstanding for ${invoice.invoiceNo}`);
    }
  }

  const paymentId = uid();
  const receiptNo = await generateReceiptNo();
  const isAdvance = draft.isAdvance || totalAllocated < draft.amount;

  const payment: Payment = {
    id: paymentId,
    receiptNo,
    date: draft.date,
    partyId: draft.partyId,
    partyName: draft.partyName,
    amount: draft.amount,
    mode: draft.mode,
    reference: draft.reference,
    notes: draft.notes,
    invoiceId: draft.allocations.length === 1 ? draft.allocations[0].invoiceId : null,
    invoiceNo: draft.allocations.length === 1 ? draft.allocations[0].invoiceNo : null,
    isAdvance,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };

  await db.transaction('rw', db.payments, db.paymentAllocations, db.invoices, db.auditLogs, async () => {
    await db.payments.put(payment);

    for (const alloc of draft.allocations) {
      if (alloc.amount <= 0) continue;
      const allocation: PaymentAllocation = {
        id: uid(),
        paymentId,
        invoiceId: alloc.invoiceId,
        invoiceNo: alloc.invoiceNo,
        amount: alloc.amount,
        createdAt: now(),
        updatedAt: now(),
      };
      await db.paymentAllocations.put(allocation);

      const invoice = await db.invoices.get(alloc.invoiceId);
      if (invoice && !invoice.cancelled) {
        const newPaymentReceived = invoice.paymentReceived + alloc.amount;
        const newOutstanding = invoice.grandTotal - newPaymentReceived;
        const newStatus: 'Paid' | 'Partial' | 'Due' =
          newOutstanding <= 0 ? 'Paid' : newPaymentReceived > 0 ? 'Partial' : 'Due';
        await db.invoices.put({
          ...invoice,
          paymentReceived: newPaymentReceived,
          outstanding: newOutstanding,
          status: newStatus,
          updatedAt: now(),
        });
      }
    }

    await logAudit('Payment Received', 'Payment', paymentId, `Received ${draft.amount} from ${draft.partyName} - ${receiptNo}`);
  });

  return paymentId;
}

export async function cancelPayment(id: string): Promise<void> {
  const payment = await db.payments.get(id);
  if (!payment) return;
  if (payment.cancelled) return;

  await db.transaction('rw', db.payments, db.paymentAllocations, db.invoices, db.auditLogs, async () => {
    await db.payments.put({ ...payment, cancelled: true, updatedAt: now() });

    const allocations = await db.paymentAllocations.where('paymentId').equals(id).toArray();
    for (const alloc of allocations) {
      const invoice = await db.invoices.get(alloc.invoiceId);
      if (invoice && !invoice.cancelled) {
        const newPaymentReceived = invoice.paymentReceived - alloc.amount;
        const newOutstanding = invoice.grandTotal - newPaymentReceived;
        const newStatus: 'Paid' | 'Partial' | 'Due' =
          newOutstanding <= 0 ? 'Paid' : newPaymentReceived > 0 ? 'Partial' : 'Due';
        await db.invoices.put({
          ...invoice,
          paymentReceived: newPaymentReceived,
          outstanding: newOutstanding,
          status: newStatus,
          updatedAt: now(),
        });
      }
    }

    await logAudit('Payment Reversed', 'Payment', id, `Reversed payment ${payment.receiptNo}`);
  });
}

export async function getPayments(limit?: number): Promise<Payment[]> {
  const all = await db.payments.orderBy('createdAt').reverse().toArray();
  const filtered = all.filter((p) => !p.cancelled);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getPayment(id: string): Promise<Payment | undefined> {
  return db.payments.get(id);
}

export async function getPaymentsByParty(partyId: string): Promise<Payment[]> {
  const payments = await db.payments.where('partyId').equals(partyId).toArray();
  return payments.filter((p) => !p.cancelled).sort((a, b) => b.date - a.date);
}
