import { db, uid, now } from '../database/db';
import type { Party, Product, Invoice, InvoiceItem, Payment, Supplier, Purchase, PurchaseItem, StockMovement, Expense, Category, Brand } from '../types';
import { addStockMovement } from './stockService';
import { seedDefaultMetadata, DEFAULT_PRODUCT_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_BRANDS, DEFAULT_COLORS, DEFAULT_SIZES } from './settingsService';
import { getSettings } from './settingsService';

export async function seedDemoData(): Promise<void> {
  await seedDefaultMetadata();

  const existingParties = await db.parties.count();
  if (existingParties > 0) return;

  const settings = await getSettings();
  const t = now();
  const day = 86400000;

  // Parties
  const parties: Party[] = [
    { id: uid(), name: 'ABC Garments', mobile: '9876543210', address: 'Shop 12, Market Road', city: 'Surat', openingBalance: 10000, creditLimit: 50000, notes: 'Regular customer', active: true, createdAt: t - 30 * day, updatedAt: t - 30 * day },
    { id: uid(), name: 'XYZ Store', mobile: '9876501234', address: 'Main Bazaar', city: 'Ahmedabad', openingBalance: 5000, creditLimit: 30000, notes: '', active: true, createdAt: t - 25 * day, updatedAt: t - 25 * day },
    { id: uid(), name: 'R.K. Garments', mobile: '9123456780', address: 'Gandhi Road', city: 'Rajkot', openingBalance: 0, creditLimit: 75000, notes: 'VIP customer', active: true, createdAt: t - 20 * day, updatedAt: t - 20 * day },
    { id: uid(), name: 'Shree Lakshmi Textiles', mobile: '9988776655', address: 'Cloth Market', city: 'Vadodara', openingBalance: 25000, creditLimit: 100000, notes: '', active: true, createdAt: t - 15 * day, updatedAt: t - 15 * day },
    { id: uid(), name: 'Fashion Hub', mobile: '9000111222', address: 'Station Road', city: 'Bhavnagar', openingBalance: 0, creditLimit: 40000, notes: '', active: true, createdAt: t - 10 * day, updatedAt: t - 10 * day },
  ];
  await db.parties.bulkPut(parties);

  // Suppliers
  const suppliers: Supplier[] = [
    { id: uid(), name: 'Krishna Hosiery', mobile: '8800554433', address: 'Industrial Area', city: 'Tirupur', gstNumber: '33AABCK1234L1Z5', openingBalance: 15000, creditTerms: '30 days', notes: 'Main bra supplier', active: true, createdAt: t - 28 * day, updatedAt: t - 28 * day },
    { id: uid(), name: 'Sri Balaji Textiles', mobile: '8900112233', address: 'Textile Hub', city: 'Erode', gstNumber: '33AABCS5678M1Z2', openingBalance: 0, creditTerms: '15 days', notes: '', active: true, createdAt: t - 22 * day, updatedAt: t - 22 * day },
  ];
  await db.suppliers.bulkPut(suppliers);

  // Products
  const productDefs = [
    { cat: 'Bra', brand: 'Brand A', design: '105', size: '34', color: 'Black', pr: 180, wr: 220, mrp: 250, stock: 50, min: 10 },
    { cat: 'Bra', brand: 'Brand A', design: '105', size: '36', color: 'Black', pr: 180, wr: 220, mrp: 250, stock: 40, min: 10 },
    { cat: 'Bra', brand: 'Brand A', design: '108', size: '34', color: 'Skin', pr: 190, wr: 230, mrp: 260, stock: 30, min: 10 },
    { cat: 'Bra', brand: 'Jockey', design: 'J21', size: '36', color: 'White', pr: 250, wr: 300, mrp: 350, stock: 25, min: 8 },
    { cat: 'Panty', brand: 'Brand B', design: 'P50', size: 'M', color: 'Black', pr: 80, wr: 110, mrp: 140, stock: 100, min: 20 },
    { cat: 'Panty', brand: 'Brand B', design: 'P50', size: 'L', color: 'Skin', pr: 80, wr: 110, mrp: 140, stock: 80, min: 20 },
    { cat: 'Panty', brand: 'Enamor', design: 'E12', size: 'L', color: 'Pink', pr: 120, wr: 160, mrp: 200, stock: 60, min: 15 },
    { cat: 'Camisole', brand: 'Brand C', design: 'C30', size: 'Free', color: 'White', pr: 150, wr: 200, mrp: 250, stock: 40, min: 10 },
    { cat: 'Camisole', brand: 'Brand C', design: 'C30', size: 'Free', color: 'Grey', pr: 150, wr: 200, mrp: 250, stock: 5, min: 10 },
    { cat: 'Shapewear', brand: 'Zivame', design: 'Z05', size: 'L', color: 'Beige', pr: 400, wr: 550, mrp: 700, stock: 15, min: 5 },
    { cat: 'Nightwear', brand: 'Brand A', design: 'N88', size: 'Free', color: 'Red', pr: 350, wr: 450, mrp: 600, stock: 20, min: 5 },
    { cat: 'Lingerie Set', brand: 'Jockey', design: 'LS01', size: '36', color: 'Black', pr: 500, wr: 700, mrp: 999, stock: 10, min: 5 },
  ];

  const products: Product[] = [];
  for (let i = 0; i < productDefs.length; i++) {
    const d = productDefs[i];
    const id = uid();
    const product: Product = {
      id,
      code: `${d.cat.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      category: d.cat,
      brand: d.brand,
      design: d.design,
      size: d.size,
      color: d.color,
      unit: 'Piece',
      purchaseRate: d.pr,
      wholesaleRate: d.wr,
      mrp: d.mrp,
      openingStock: d.stock,
      minStock: d.min,
      description: '',
      active: true,
      createdAt: t - 28 * day + i * 1000,
      updatedAt: t - 28 * day + i * 1000,
    };
    products.push(product);
    await db.products.put(product);
    await addStockMovement(id, 'OpeningStock', d.stock, true, 'Opening Stock', null, 'Demo opening stock', t - 28 * day);
  }

  // Invoices
  const inv1Date = t - 18 * day;
  const inv1Items = products.slice(0, 2);
  const inv1: Invoice = {
    id: uid(),
    invoiceNo: 'INV001',
    date: inv1Date,
    partyId: parties[0].id,
    partyName: parties[0].name,
    subtotal: 10 * inv1Items[0].wholesaleRate + 5 * inv1Items[1].wholesaleRate,
    discountAmount: 0,
    taxAmount: 0,
    roundOff: 0,
    grandTotal: 10 * inv1Items[0].wholesaleRate + 5 * inv1Items[1].wholesaleRate,
    paymentReceived: 1000,
    outstanding: 10 * inv1Items[0].wholesaleRate + 5 * inv1Items[1].wholesaleRate - 1000,
    status: 'Partial',
    notes: '',
    paymentMode: 'Cash',
    paymentRef: '',
    cancelled: false,
    createdAt: inv1Date,
    updatedAt: inv1Date,
  };
  await db.invoices.put(inv1);
  const inv1ItemRecords: InvoiceItem[] = [
    { id: uid(), invoiceId: inv1.id, productId: inv1Items[0].id, productCode: inv1Items[0].code, productDesc: `${inv1Items[0].category} ${inv1Items[0].brand} ${inv1Items[0].design} ${inv1Items[0].size} ${inv1Items[0].color}`, category: inv1Items[0].category, brand: inv1Items[0].brand, size: inv1Items[0].size, color: inv1Items[0].color, unit: 'Piece', qty: 10, rate: inv1Items[0].wholesaleRate, discount: 0, amount: 10 * inv1Items[0].wholesaleRate, createdAt: inv1Date, updatedAt: inv1Date },
    { id: uid(), invoiceId: inv1.id, productId: inv1Items[1].id, productCode: inv1Items[1].code, productDesc: `${inv1Items[1].category} ${inv1Items[1].brand} ${inv1Items[1].design} ${inv1Items[1].size} ${inv1Items[1].color}`, category: inv1Items[1].category, brand: inv1Items[1].brand, size: inv1Items[1].size, color: inv1Items[1].color, unit: 'Piece', qty: 5, rate: inv1Items[1].wholesaleRate, discount: 0, amount: 5 * inv1Items[1].wholesaleRate, createdAt: inv1Date, updatedAt: inv1Date },
  ];
  await db.invoiceItems.bulkPut(inv1ItemRecords);
  for (const item of inv1ItemRecords) {
    await addStockMovement(item.productId, 'Sale', item.qty, false, inv1.invoiceNo, inv1.id, `Sale to ${parties[0].name}`, inv1Date);
  }
  const inv1Payment: Payment = {
    id: uid(), receiptNo: 'RCP001', date: inv1Date, partyId: parties[0].id, partyName: parties[0].name, amount: 1000, mode: 'Cash', reference: '', notes: `Payment for ${inv1.invoiceNo}`, invoiceId: inv1.id, invoiceNo: inv1.invoiceNo, isAdvance: false, cancelled: false, createdAt: inv1Date, updatedAt: inv1Date,
  };
  await db.payments.put(inv1Payment);

  // Invoice 2 - fully paid
  const inv2Date = t - 10 * day;
  const inv2Prod = products[4];
  const inv2Total = 20 * inv2Prod.wholesaleRate;
  const inv2: Invoice = {
    id: uid(), invoiceNo: 'INV002', date: inv2Date, partyId: parties[1].id, partyName: parties[1].name, subtotal: inv2Total, discountAmount: 0, taxAmount: 0, roundOff: 0, grandTotal: inv2Total, paymentReceived: inv2Total, outstanding: 0, status: 'Paid', notes: '', paymentMode: 'UPI', paymentRef: 'UPI123456', cancelled: false, createdAt: inv2Date, updatedAt: inv2Date,
  };
  await db.invoices.put(inv2);
  const inv2Item: InvoiceItem = { id: uid(), invoiceId: inv2.id, productId: inv2Prod.id, productCode: inv2Prod.code, productDesc: `${inv2Prod.category} ${inv2Prod.brand} ${inv2Prod.design} ${inv2Prod.size} ${inv2Prod.color}`, category: inv2Prod.category, brand: inv2Prod.brand, size: inv2Prod.size, color: inv2Prod.color, unit: 'Piece', qty: 20, rate: inv2Prod.wholesaleRate, discount: 0, amount: inv2Total, createdAt: inv2Date, updatedAt: inv2Date };
  await db.invoiceItems.put(inv2Item);
  await addStockMovement(inv2Prod.id, 'Sale', 20, false, inv2.invoiceNo, inv2.id, `Sale to ${parties[1].name}`, inv2Date);
  const inv2Payment: Payment = { id: uid(), receiptNo: 'RCP002', date: inv2Date, partyId: parties[1].id, partyName: parties[1].name, amount: inv2Total, mode: 'UPI', reference: 'UPI123456', notes: `Payment for ${inv2.invoiceNo}`, invoiceId: inv2.id, invoiceNo: inv2.invoiceNo, isAdvance: false, cancelled: false, createdAt: inv2Date, updatedAt: inv2Date };
  await db.payments.put(inv2Payment);

  // Invoice 3 - due
  const inv3Date = t - 5 * day;
  const inv3Prod = products[8];
  const inv3Total = 30 * inv3Prod.wholesaleRate;
  const inv3: Invoice = {
    id: uid(), invoiceNo: 'INV003', date: inv3Date, partyId: parties[2].id, partyName: parties[2].name, subtotal: inv3Total, discountAmount: 0, taxAmount: 0, roundOff: 0, grandTotal: inv3Total, paymentReceived: 0, outstanding: inv3Total, status: 'Due', notes: '', paymentMode: '', paymentRef: '', cancelled: false, createdAt: inv3Date, updatedAt: inv3Date,
  };
  await db.invoices.put(inv3);
  const inv3Item: InvoiceItem = { id: uid(), invoiceId: inv3.id, productId: inv3Prod.id, productCode: inv3Prod.code, productDesc: `${inv3Prod.category} ${inv3Prod.brand} ${inv3Prod.design} ${inv3Prod.size} ${inv3Prod.color}`, category: inv3Prod.category, brand: inv3Prod.brand, size: inv3Prod.size, color: inv3Prod.color, unit: 'Piece', qty: 30, rate: inv3Prod.wholesaleRate, discount: 0, amount: inv3Total, createdAt: inv3Date, updatedAt: inv3Date };
  await db.invoiceItems.put(inv3Item);
  await addStockMovement(inv3Prod.id, 'Sale', 30, false, inv3.invoiceNo, inv3.id, `Sale to ${parties[2].name}`, inv3Date);

  // Invoice 4 - today
  const inv4Date = t;
  const inv4Prod = products[2];
  const inv4Total = 15 * inv4Prod.wholesaleRate;
  const inv4PaymentAmt = 2000;
  const inv4: Invoice = {
    id: uid(), invoiceNo: 'INV004', date: inv4Date, partyId: parties[3].id, partyName: parties[3].name, subtotal: inv4Total, discountAmount: 0, taxAmount: 0, roundOff: 0, grandTotal: inv4Total, paymentReceived: inv4PaymentAmt, outstanding: inv4Total - inv4PaymentAmt, status: 'Partial', notes: '', paymentMode: 'Cash', paymentRef: '', cancelled: false, createdAt: inv4Date, updatedAt: inv4Date,
  };
  await db.invoices.put(inv4);
  const inv4Item: InvoiceItem = { id: uid(), invoiceId: inv4.id, productId: inv4Prod.id, productCode: inv4Prod.code, productDesc: `${inv4Prod.category} ${inv4Prod.brand} ${inv4Prod.design} ${inv4Prod.size} ${inv4Prod.color}`, category: inv4Prod.category, brand: inv4Prod.brand, size: inv4Prod.size, color: inv4Prod.color, unit: 'Piece', qty: 15, rate: inv4Prod.wholesaleRate, discount: 0, amount: inv4Total, createdAt: inv4Date, updatedAt: inv4Date };
  await db.invoiceItems.put(inv4Item);
  await addStockMovement(inv4Prod.id, 'Sale', 15, false, inv4.invoiceNo, inv4.id, `Sale to ${parties[3].name}`, inv4Date);
  const inv4Payment: Payment = { id: uid(), receiptNo: 'RCP003', date: inv4Date, partyId: parties[3].id, partyName: parties[3].name, amount: inv4PaymentAmt, mode: 'Cash', reference: '', notes: `Payment for ${inv4.invoiceNo}`, invoiceId: inv4.id, invoiceNo: inv4.invoiceNo, isAdvance: false, cancelled: false, createdAt: inv4Date, updatedAt: inv4Date };
  await db.payments.put(inv4Payment);

  // Purchases
  const pur1Date = t - 12 * day;
  const pur1Prod = products[3];
  const pur1Total = 20 * pur1Prod.purchaseRate;
  const pur1: Purchase = {
    id: uid(), billNo: 'PUR001', date: pur1Date, supplierId: suppliers[0].id, supplierName: suppliers[0].name, subtotal: pur1Total, discountAmount: 0, taxAmount: 0, roundOff: 0, grandTotal: pur1Total, paymentMade: pur1Total, outstanding: 0, status: 'Paid', notes: '', paymentMode: 'Bank Transfer', paymentRef: 'BT001', cancelled: false, createdAt: pur1Date, updatedAt: pur1Date,
  };
  await db.purchases.put(pur1);
  const pur1Item: PurchaseItem = { id: uid(), purchaseId: pur1.id, productId: pur1Prod.id, productCode: pur1Prod.code, productDesc: `${pur1Prod.category} ${pur1Prod.brand} ${pur1Prod.design} ${pur1Prod.size} ${pur1Prod.color}`, category: pur1Prod.category, brand: pur1Prod.brand, size: pur1Prod.size, color: pur1Prod.color, unit: 'Piece', qty: 20, rate: pur1Prod.purchaseRate, mrp: pur1Prod.mrp, purchaseRate: pur1Prod.purchaseRate, saleRate: pur1Prod.wholesaleRate, discount: 0, amount: pur1Total, createdAt: pur1Date, updatedAt: pur1Date };
  await db.purchaseItems.put(pur1Item);
  await addStockMovement(pur1Prod.id, 'Purchase', 20, true, pur1.billNo, pur1.id, `Purchase from ${suppliers[0].name}`, pur1Date);

  // Expenses
  const expenses: Expense[] = [
    { id: uid(), expenseNo: 'EXP001', date: t - 15 * day, category: 'Rent', amount: 15000, mode: 'Cash', description: 'Shop rent', notes: '', cancelled: false, createdAt: t - 15 * day, updatedAt: t - 15 * day },
    { id: uid(), expenseNo: 'EXP002', date: t - 8 * day, category: 'Salary', amount: 20000, mode: 'Bank Transfer', description: 'Staff salary', notes: '', cancelled: false, createdAt: t - 8 * day, updatedAt: t - 8 * day },
    { id: uid(), expenseNo: 'EXP003', date: t - 3 * day, category: 'Transport', amount: 2500, mode: 'Cash', description: 'Goods transport', notes: '', cancelled: false, createdAt: t - 3 * day, updatedAt: t - 3 * day },
    { id: uid(), expenseNo: 'EXP004', date: t, category: 'Electricity', amount: 3200, mode: 'UPI', description: 'Electricity bill', notes: '', cancelled: false, createdAt: t, updatedAt: t },
  ];
  await db.expenses.bulkPut(expenses);
}
