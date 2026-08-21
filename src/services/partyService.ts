import { db, uid, now } from '../database/db';
import type { Party, Invoice, Payment, Return, InvoiceItem, Product } from '../types';
import { logAudit } from './auditService';

export async function getParties(): Promise<Party[]> {
  return db.parties.orderBy('createdAt').reverse().toArray();
}

export async function getParty(id: string): Promise<Party | undefined> {
  return db.parties.get(id);
}

export async function saveParty(party: Omit<Party, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
  if (party.id) {
    const existing = await db.parties.get(party.id);
    if (!existing) throw new Error('Party not found');
    await db.parties.put({
      ...existing,
      ...party,
      id: party.id,
      updatedAt: now(),
    });
    await logAudit('Party Updated', 'Party', party.id, `Updated party: ${party.name}`);
    return party.id;
  }
  const id = uid();
  const newParty: Party = {
    ...party,
    id,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.parties.put(newParty);
  await logAudit('Party Created', 'Party', id, `Created party: ${party.name}`);
  return id;
}

export async function deleteParty(id: string): Promise<void> {
  const party = await db.parties.get(id);
  if (!party) return;
  const invoices = await db.invoices.where('partyId').equals(id).toArray();
  if (invoices.length > 0) {
    throw new Error('Cannot delete party with existing invoices. Deactivate instead.');
  }
  await db.parties.delete(id);
  await logAudit('Party Deleted', 'Party', id, `Deleted party: ${party.name}`);
}

export async function togglePartyActive(id: string): Promise<void> {
  const party = await db.parties.get(id);
  if (!party) return;
  await db.parties.put({ ...party, active: !party.active, updatedAt: now() });
  await logAudit('Party Updated', 'Party', id, `${party.active ? 'Deactivated' : 'Activated'} party: ${party.name}`);
}

export interface PartyLedgerEntry {
  date: number;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: string;
}

export async function getPartyLedger(partyId: string): Promise<PartyLedgerEntry[]> {
  const party = await db.parties.get(partyId);
  if (!party) return [];
  const entries: PartyLedgerEntry[] = [];

  if (party.openingBalance !== 0) {
    entries.push({
      date: party.createdAt,
      reference: 'Opening',
      description: 'Opening Balance',
      debit: party.openingBalance > 0 ? party.openingBalance : 0,
      credit: party.openingBalance < 0 ? Math.abs(party.openingBalance) : 0,
      balance: party.openingBalance,
      type: 'Opening',
    });
  }

  const invoices = await db.invoices.where('partyId').equals(partyId).toArray();
  const activeInvoices = invoices.filter((i) => !i.cancelled);
  for (const inv of activeInvoices) {
    entries.push({
      date: inv.date,
      reference: inv.invoiceNo,
      description: 'Sales Invoice',
      debit: inv.grandTotal,
      credit: 0,
      balance: 0,
      type: 'Invoice',
    });
  }

  const payments = await db.payments.where('partyId').equals(partyId).toArray();
  const activePayments = payments.filter((p) => !p.cancelled);
  for (const pmt of activePayments) {
    entries.push({
      date: pmt.date,
      reference: pmt.receiptNo,
      description: pmt.isAdvance ? 'Advance Payment' : 'Payment Received',
      debit: 0,
      credit: pmt.amount,
      balance: 0,
      type: 'Payment',
    });
  }

  const returns = await db.returns.where('partyId').equals(partyId).toArray();
  const activeReturns = returns.filter((r) => !r.cancelled && r.type === 'SalesReturn');
  for (const ret of activeReturns) {
    entries.push({
      date: ret.date,
      reference: ret.returnNo,
      description: 'Sales Return',
      debit: 0,
      credit: ret.amount,
      balance: 0,
      type: 'Return',
    });
  }

  entries.sort((a, b) => a.date - b.date);

  let runningBalance = party.openingBalance;
  for (const e of entries) {
    if (e.type === 'Opening') {
      e.balance = runningBalance;
    } else {
      runningBalance += e.debit - e.credit;
      e.balance = runningBalance;
    }
  }

  return entries;
}

export async function getPartyOutstanding(partyId: string): Promise<number> {
  const party = await db.parties.get(partyId);
  if (!party) return 0;
  let outstanding = party.openingBalance;

  const invoices = await db.invoices.where('partyId').equals(partyId).toArray();
  for (const inv of invoices) {
    if (!inv.cancelled) outstanding += inv.outstanding;
  }

  const payments = await db.payments.where('partyId').equals(partyId).toArray();
  for (const pmt of payments) {
    if (!pmt.cancelled && pmt.isAdvance) {
      outstanding -= pmt.amount;
    }
  }

  return outstanding;
}

export async function getPartyOutstandingBatch(partyIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const id of partyIds) result.set(id, 0);

  const parties = await db.parties.bulkGet(partyIds);
  for (const party of parties) {
    if (party) result.set(party.id, party.openingBalance);
  }

  const invoices = await db.invoices.toArray();
  for (const inv of invoices) {
    if (!inv.cancelled && result.has(inv.partyId)) {
      result.set(inv.partyId, (result.get(inv.partyId) || 0) + inv.outstanding);
    }
  }

  const payments = await db.payments.toArray();
  for (const pmt of payments) {
    if (!pmt.cancelled && pmt.isAdvance && result.has(pmt.partyId)) {
      result.set(pmt.partyId, (result.get(pmt.partyId) || 0) - pmt.amount);
    }
  }

  return result;
}

export interface PartyAnalytics {
  totalSales: number;
  totalPayments: number;
  outstanding: number;
  totalOrders: number;
  lastPurchaseDate: number | null;
  avgOrderValue: number;
  categoryWise: { category: string; amount: number }[];
  brandWise: { brand: string; amount: number }[];
  productWise: { productDesc: string; qty: number; amount: number }[];
}

export async function getPartyAnalytics(partyId: string): Promise<PartyAnalytics> {
  const invoices = await db.invoices.where('partyId').equals(partyId).toArray();
  const activeInvoices = invoices.filter((i) => !i.cancelled);
  const invoiceIds = activeInvoices.map((i) => i.id);

  const allItems = await db.invoiceItems.toArray();
  const items = allItems.filter((it) => invoiceIds.includes(it.invoiceId));

  const payments = await db.payments.where('partyId').equals(partyId).toArray();
  const activePayments = payments.filter((p) => !p.cancelled);

  const totalSales = activeInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalPayments = activePayments.reduce((s, p) => s + p.amount, 0);
  const totalOrders = activeInvoices.length;
  const lastPurchaseDate = activeInvoices.length > 0 ? Math.max(...activeInvoices.map((i) => i.date)) : null;

  const catMap = new Map<string, number>();
  const brandMap = new Map<string, number>();
  const productMap = new Map<string, { qty: number; amount: number }>();

  for (const item of items) {
    catMap.set(item.category, (catMap.get(item.category) || 0) + item.amount);
    brandMap.set(item.brand, (brandMap.get(item.brand) || 0) + item.amount);
    const key = `${item.productDesc}`;
    const existing = productMap.get(key) || { qty: 0, amount: 0 };
    productMap.set(key, { qty: existing.qty + item.qty, amount: existing.amount + item.amount });
  }

  const outstanding = await getPartyOutstanding(partyId);

  return {
    totalSales,
    totalPayments,
    outstanding,
    totalOrders,
    lastPurchaseDate,
    avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    categoryWise: Array.from(catMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    brandWise: Array.from(brandMap.entries()).map(([brand, amount]) => ({ brand, amount })).sort((a, b) => b.amount - a.amount),
    productWise: Array.from(productMap.entries()).map(([productDesc, v]) => ({ productDesc, ...v })).sort((a, b) => b.amount - a.amount),
  };
}

export async function getPartyInvoices(partyId: string): Promise<Invoice[]> {
  const invoices = await db.invoices.where('partyId').equals(partyId).toArray();
  return invoices.filter((i) => !i.cancelled).sort((a, b) => b.date - a.date);
}

export async function getPartyPayments(partyId: string): Promise<Payment[]> {
  const payments = await db.payments.where('partyId').equals(partyId).toArray();
  return payments.filter((p) => !p.cancelled).sort((a, b) => b.date - a.date);
}

export async function getPartyReturns(partyId: string): Promise<Return[]> {
  const returns = await db.returns.where('partyId').equals(partyId).toArray();
  return returns.filter((r) => !r.cancelled).sort((a, b) => b.date - a.date);
}
