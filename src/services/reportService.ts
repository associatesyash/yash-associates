import { db } from '../database/db';
import type { Invoice, Payment, Purchase, Expense } from '../types';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from '../utils/format';
import { getCurrentStock } from './stockService';

export async function getDashboardStats(today: number = Date.now()): Promise<{
  totalParties: number;
  totalProducts: number;
  customerOutstanding: number;
  todaySales: number;
  todayPayments: number;
  stockValue: number;
  lowStockCount: number;
  monthlySales: number;
  monthlyExpenses: number;
  monthlyPurchases: number;
}> {
  const parties = await db.parties.toArray();
  const activeParties = parties.filter((p) => p.active);
  const products = await db.products.toArray();
  const activeProducts = products.filter((p) => p.active);

  let customerOutstanding = 0;
  for (const p of parties) {
    customerOutstanding += p.openingBalance;
  }
  const invoices = await db.invoices.toArray();
  for (const inv of invoices) {
    if (!inv.cancelled) customerOutstanding += inv.outstanding;
  }
  const payments = await db.payments.toArray();
  for (const pmt of payments) {
    if (!pmt.cancelled && pmt.isAdvance) customerOutstanding -= pmt.amount;
  }
  const sDay = startOfDay(today);
  const eDay = endOfDay(today);
  const sMonth = startOfMonth(today);
  const eMonth = endOfMonth(today);

  const todaySales = invoices
    .filter((i) => !i.cancelled && i.date >= sDay && i.date <= eDay)
    .reduce((s, i) => s + i.grandTotal, 0);

  const todayPayments = payments
    .filter((p) => !p.cancelled && p.date >= sDay && p.date <= eDay)
    .reduce((s, p) => s + p.amount, 0);

  const monthlySales = invoices
    .filter((i) => !i.cancelled && i.date >= sMonth && i.date <= eMonth)
    .reduce((s, i) => s + i.grandTotal, 0);

  const expenses = await db.expenses.toArray();
  const monthlyExpenses = expenses
    .filter((e) => !e.cancelled && e.date >= sMonth && e.date <= eMonth)
    .reduce((s, e) => s + e.amount, 0);

  const purchases = await db.purchases.toArray();
  const monthlyPurchases = purchases
    .filter((p) => !p.cancelled && p.date >= sMonth && p.date <= eMonth)
    .reduce((s, p) => s + p.grandTotal, 0);

  let stockValue = 0;
  let lowStockCount = 0;
  for (const product of activeProducts) {
    const stock = await getCurrentStock(product.id);
    if (stock > 0) stockValue += stock * product.purchaseRate;
    if (stock <= product.minStock) lowStockCount++;
  }

  return {
    totalParties: activeParties.length,
    totalProducts: activeProducts.length,
    customerOutstanding,
    todaySales,
    todayPayments,
    stockValue,
    lowStockCount,
    monthlySales,
    monthlyExpenses,
    monthlyPurchases,
  };
}

export async function getSalesTrend(days = 30): Promise<{ date: number; value: number }[]> {
  const now = Date.now();
  const from = startOfDay(now - (days - 1) * 86400000);
  const invoices = await db.invoices.toArray();
  const activeInvoices = invoices.filter((i) => !i.cancelled && i.date >= from);

  const map = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const day = startOfDay(from + i * 86400000);
    map.set(day, 0);
  }
  for (const inv of activeInvoices) {
    const day = startOfDay(inv.date);
    map.set(day, (map.get(day) || 0) + inv.grandTotal);
  }
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

export async function getTopCategories(limit = 5): Promise<{ name: string; value: number }[]> {
  const items = await db.invoiceItems.toArray();
  const invoices = await db.invoices.toArray();
  const activeInvoiceIds = new Set(invoices.filter((i) => !i.cancelled).map((i) => i.id));
  const activeItems = items.filter((it) => activeInvoiceIds.has(it.invoiceId));

  const map = new Map<string, number>();
  for (const item of activeItems) {
    map.set(item.category, (map.get(item.category) || 0) + item.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getSalesByDateRange(from: number, to: number): Promise<Invoice[]> {
  const invoices = await db.invoices.toArray();
  return invoices.filter((i) => !i.cancelled && i.date >= from && i.date <= to).sort((a, b) => b.date - a.date);
}

export async function getPaymentsByDateRange(from: number, to: number): Promise<Payment[]> {
  const payments = await db.payments.toArray();
  return payments.filter((p) => !p.cancelled && p.date >= from && p.date <= to).sort((a, b) => b.date - a.date);
}

export async function getPurchasesByDateRange(from: number, to: number): Promise<Purchase[]> {
  const purchases = await db.purchases.toArray();
  return purchases.filter((p) => !p.cancelled && p.date >= from && p.date <= to).sort((a, b) => b.date - a.date);
}

export async function getExpensesByDateRange(from: number, to: number): Promise<Expense[]> {
  const expenses = await db.expenses.toArray();
  return expenses.filter((e) => !e.cancelled && e.date >= from && e.date <= to).sort((a, b) => b.date - a.date);
}

export async function getProductWiseSales(from: number, to: number) {
  const invoices = await db.invoices.toArray();
  const activeInvoiceIds = new Set(invoices.filter((i) => !i.cancelled && i.date >= from && i.date <= to).map((i) => i.id));
  const items = await db.invoiceItems.toArray();
  const filtered = items.filter((it) => activeInvoiceIds.has(it.invoiceId));

  const map = new Map<string, { productDesc: string; qty: number; amount: number }>();
  for (const item of filtered) {
    const existing = map.get(item.productId) || { productDesc: item.productDesc, qty: 0, amount: 0 };
    existing.qty += item.qty;
    existing.amount += item.amount;
    map.set(item.productId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export async function getCustomerWiseSales(from: number, to: number) {
  const invoices = await db.invoices.toArray();
  const filtered = invoices.filter((i) => !i.cancelled && i.date >= from && i.date <= to);
  const map = new Map<string, { partyName: string; count: number; amount: number }>();
  for (const inv of filtered) {
    const existing = map.get(inv.partyId) || { partyName: inv.partyName, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += inv.grandTotal;
    map.set(inv.partyId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export async function getBrandWiseSales(from: number, to: number) {
  const invoices = await db.invoices.toArray();
  const activeInvoiceIds = new Set(invoices.filter((i) => !i.cancelled && i.date >= from && i.date <= to).map((i) => i.id));
  const items = await db.invoiceItems.toArray();
  const filtered = items.filter((it) => activeInvoiceIds.has(it.invoiceId));
  const map = new Map<string, number>();
  for (const item of filtered) {
    map.set(item.brand, (map.get(item.brand) || 0) + item.amount);
  }
  return Array.from(map.entries()).map(([brand, amount]) => ({ brand, amount })).sort((a, b) => b.amount - a.amount);
}

export async function getCategoryWiseSales(from: number, to: number) {
  const invoices = await db.invoices.toArray();
  const activeInvoiceIds = new Set(invoices.filter((i) => !i.cancelled && i.date >= from && i.date <= to).map((i) => i.id));
  const items = await db.invoiceItems.toArray();
  const filtered = items.filter((it) => activeInvoiceIds.has(it.invoiceId));
  const map = new Map<string, number>();
  for (const item of filtered) {
    map.set(item.category, (map.get(item.category) || 0) + item.amount);
  }
  return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export async function getPartyAging() {
  const parties = await db.parties.toArray();
  const invoices = await db.invoices.toArray();
  const activeInvoices = invoices.filter((i) => !i.cancelled && i.outstanding > 0);

  const result: { partyId: string; partyName: string; current: number; overdue30: number; overdue60: number; overdue90: number; total: number }[] = [];

  const now = Date.now();
  for (const party of parties) {
    let current = party.openingBalance;
    let overdue30 = 0, overdue60 = 0, overdue90 = 0;
    for (const inv of activeInvoices.filter((i) => i.partyId === party.id)) {
      const daysOld = Math.floor((now - inv.date) / 86400000);
      if (daysOld <= 30) current += inv.outstanding;
      else if (daysOld <= 60) overdue30 += inv.outstanding;
      else if (daysOld <= 90) overdue60 += inv.outstanding;
      else overdue90 += inv.outstanding;
    }
    const total = current + overdue30 + overdue60 + overdue90;
    if (total > 0) {
      result.push({ partyId: party.id, partyName: party.name, current, overdue30, overdue60, overdue90, total });
    }
  }
  return result.sort((a, b) => b.total - a.total);
}
