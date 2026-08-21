import Dexie, { Table } from 'dexie';
import type {
  Party,
  Product,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAllocation,
  Supplier,
  Purchase,
  PurchaseItem,
  SupplierPayment,
  Return,
  ReturnItem,
  StockMovement,
  Expense,
  Category,
  Brand,
  Setting,
  AuditLog,
  BackupMetadata,
} from '../types';

export class YashDatabase extends Dexie {
  parties!: Table<Party, string>;
  products!: Table<Product, string>;
  invoices!: Table<Invoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  payments!: Table<Payment, string>;
  paymentAllocations!: Table<PaymentAllocation, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  purchaseItems!: Table<PurchaseItem, string>;
  supplierPayments!: Table<SupplierPayment, string>;
  returns!: Table<Return, string>;
  returnItems!: Table<ReturnItem, string>;
  stockMovements!: Table<StockMovement, string>;
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  brands!: Table<Brand, string>;
  settings!: Table<Setting, string>;
  auditLogs!: Table<AuditLog, string>;
  backupMetadata!: Table<BackupMetadata, string>;

  constructor() {
    super('yash_associates_db');
    this.version(1).stores({
      parties: 'id, name, mobile, city, active, createdAt',
      products: 'id, code, category, brand, design, size, color, active, createdAt',
      invoices: 'id, invoiceNo, date, partyId, status, cancelled, createdAt',
      invoiceItems: 'id, invoiceId, productId, createdAt',
      payments: 'id, receiptNo, date, partyId, invoiceId, isAdvance, cancelled, createdAt',
      paymentAllocations: 'id, paymentId, invoiceId, createdAt',
      suppliers: 'id, name, mobile, city, active, createdAt',
      purchases: 'id, billNo, date, supplierId, status, cancelled, createdAt',
      purchaseItems: 'id, purchaseId, productId, createdAt',
      supplierPayments: 'id, receiptNo, date, supplierId, purchaseId, cancelled, createdAt',
      returns: 'id, returnNo, date, type, partyId, supplierId, cancelled, createdAt',
      returnItems: 'id, returnId, productId, createdAt',
      stockMovements: 'id, date, productId, type, refId, createdAt',
      expenses: 'id, expenseNo, date, category, cancelled, createdAt',
      categories: 'id, name, type, createdAt',
      brands: 'id, name, createdAt',
      settings: 'id, key, createdAt',
      auditLogs: 'id, action, entity, entityId, createdAt',
      backupMetadata: 'id, createdAt',
    });
  }
}

export const db = new YashDatabase();

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function now(): number {
  return Date.now();
}
