export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Party extends BaseEntity {
  name: string;
  mobile: string;
  address: string;
  city: string;
  openingBalance: number;
  creditLimit: number;
  notes: string;
  active: boolean;
}

export interface Product extends BaseEntity {
  code: string;
  category: string;
  brand: string;
  design: string;
  size: string;
  color: string;
  unit: string;
  purchaseRate: number;
  wholesaleRate: number;
  mrp: number;
  openingStock: number;
  minStock: number;
  description: string;
  active: boolean;
}

export interface Invoice extends BaseEntity {
  invoiceNo: string;
  date: number;
  partyId: string;
  partyName: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
  paymentReceived: number;
  outstanding: number;
  status: 'Paid' | 'Partial' | 'Due';
  notes: string;
  paymentMode: string;
  paymentRef: string;
  cancelled: boolean;
}

export interface InvoiceItem extends BaseEntity {
  invoiceId: string;
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
  amount: number;
}

export interface Payment extends BaseEntity {
  receiptNo: string;
  date: number;
  partyId: string;
  partyName: string;
  amount: number;
  mode: string;
  reference: string;
  notes: string;
  invoiceId: string | null;
  invoiceNo: string | null;
  isAdvance: boolean;
  cancelled: boolean;
}

export interface PaymentAllocation extends BaseEntity {
  paymentId: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
}

export interface Supplier extends BaseEntity {
  name: string;
  mobile: string;
  address: string;
  city: string;
  gstNumber: string;
  openingBalance: number;
  creditTerms: string;
  notes: string;
  active: boolean;
}

export interface Purchase extends BaseEntity {
  billNo: string;
  date: number;
  supplierId: string;
  supplierName: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  roundOff: number;
  grandTotal: number;
  paymentMade: number;
  outstanding: number;
  status: 'Paid' | 'Partial' | 'Due';
  notes: string;
  paymentMode: string;
  paymentRef: string;
  cancelled: boolean;
}

export interface PurchaseItem extends BaseEntity {
  purchaseId: string;
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
  amount: number;
}

export interface SupplierPayment extends BaseEntity {
  receiptNo: string;
  date: number;
  supplierId: string;
  supplierName: string;
  amount: number;
  mode: string;
  reference: string;
  notes: string;
  purchaseId: string | null;
  purchaseNo: string | null;
  cancelled: boolean;
}

export interface Return extends BaseEntity {
  returnNo: string;
  date: number;
  type: 'SalesReturn' | 'PurchaseReturn';
  refInvoiceId: string | null;
  refInvoiceNo: string | null;
  refPurchaseId: string | null;
  refPurchaseNo: string | null;
  partyId: string | null;
  partyName: string;
  supplierId: string | null;
  supplierName: string;
  amount: number;
  reason: string;
  notes: string;
  cancelled: boolean;
}

export interface ReturnItem extends BaseEntity {
  returnId: string;
  productId: string;
  productCode: string;
  productDesc: string;
  qty: number;
  rate: number;
  amount: number;
}

export type StockMovementType =
  | 'OpeningStock'
  | 'Purchase'
  | 'Sale'
  | 'SalesReturn'
  | 'PurchaseReturn'
  | 'Damage'
  | 'ManualAdjustment'
  | 'Correction';

export interface StockMovement extends BaseEntity {
  date: number;
  productId: string;
  productCode: string;
  productDesc: string;
  type: StockMovementType;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  reference: string;
  refId: string | null;
  notes: string;
}

export interface Expense extends BaseEntity {
  expenseNo: string;
  date: number;
  category: string;
  amount: number;
  mode: string;
  description: string;
  notes: string;
  cancelled: boolean;
}

export interface Category extends BaseEntity {
  name: string;
  type: 'product' | 'expense';
}

export interface Brand extends BaseEntity {
  name: string;
}

export interface Setting extends BaseEntity {
  key: string;
  value: unknown;
}

export interface AuditLog extends BaseEntity {
  action: string;
  entity: string;
  entityId: string;
  description: string;
}

export interface BackupMetadata extends BaseEntity {
  filename: string;
  size: number;
  recordCount: number;
  version: number;
}

export interface Settings {
  businessName: string;
  address: string;
  mobile: string;
  email: string;
  gstNumber: string;
  taxEnabled: boolean;
  taxRate: number;
  taxName: string;
  invoicePrefix: string;
  receiptPrefix: string;
  expensePrefix: string;
  purchasePrefix: string;
  returnPrefix: string;
  lowStockAlert: boolean;
  logoText: string;
}

export const DEFAULT_SETTINGS: Settings = {
  businessName: 'YASH ASSOCIATES',
  address: '',
  mobile: '',
  email: '',
  gstNumber: '',
  taxEnabled: false,
  taxRate: 0,
  taxName: 'GST',
  invoicePrefix: 'INV',
  receiptPrefix: 'RCP',
  expensePrefix: 'EXP',
  purchasePrefix: 'PUR',
  returnPrefix: 'RTN',
  lowStockAlert: true,
  logoText: 'YA',
};
