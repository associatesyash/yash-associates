import { db, uid, now } from '../database/db';
import type { Expense } from '../types';
import { logAudit } from './auditService';
import { getSettings } from './settingsService';

export async function generateExpenseNo(): Promise<string> {
  const settings = await getSettings();
  const count = await db.expenses.count();
  return `${settings.expensePrefix}${String(count + 1).padStart(3, '0')}`;
}

export async function createExpense(
  date: number,
  category: string,
  amount: number,
  mode: string,
  description: string,
  notes: string
): Promise<string> {
  if (!category) throw new Error('Please select a category');
  if (amount <= 0) throw new Error('Amount must be greater than zero');

  const id = uid();
  const expenseNo = await generateExpenseNo();
  const expense: Expense = {
    id,
    expenseNo,
    date,
    category,
    amount,
    mode,
    description,
    notes,
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.expenses.put(expense);
  await logAudit('Expense Created', 'Expense', id, `Expense ${expenseNo}: ${category} - ${amount}`);
  return id;
}

export async function cancelExpense(id: string): Promise<void> {
  const expense = await db.expenses.get(id);
  if (!expense) return;
  await db.expenses.put({ ...expense, cancelled: true, updatedAt: now() });
  await logAudit('Expense Cancelled', 'Expense', id, `Cancelled expense ${expense.expenseNo}`);
}

export async function getExpenses(limit?: number): Promise<Expense[]> {
  const all = await db.expenses.orderBy('createdAt').reverse().toArray();
  const filtered = all.filter((e) => !e.cancelled);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getExpensesByDateRange(from: number, to: number): Promise<Expense[]> {
  const all = await db.expenses.toArray();
  return all.filter((e) => !e.cancelled && e.date >= from && e.date <= to).sort((a, b) => b.date - a.date);
}
