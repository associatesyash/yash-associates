import { db, uid, now } from '../database/db';
import type { StockMovement, StockMovementType, Product } from '../types';

export async function getCurrentStock(productId: string): Promise<number> {
  const movements = await db.stockMovements.where('productId').equals(productId).toArray();
  return movements.reduce((sum, m) => sum + m.qtyIn - m.qtyOut, 0);
}

export async function getCurrentStockBatch(productIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const id of productIds) {
    result.set(id, 0);
  }
  const movements = await db.stockMovements.toArray();
  for (const m of movements) {
    if (result.has(m.productId)) {
      result.set(m.productId, (result.get(m.productId) || 0) + m.qtyIn - m.qtyOut);
    }
  }
  return result;
}

export async function addStockMovement(
  productId: string,
  type: StockMovementType,
  qty: number,
  isIn: boolean,
  reference: string,
  refId: string | null = null,
  notes: string = '',
  txnDate: number = now()
): Promise<void> {
  const product = await db.products.get(productId);
  if (!product) return;

  const currentStock = await getCurrentStock(productId);
  const movement: StockMovement = {
    id: uid(),
    date: txnDate,
    productId,
    productCode: product.code,
    productDesc: `${product.category} ${product.brand} ${product.design} ${product.size} ${product.color}`.trim(),
    type,
    qtyIn: isIn ? qty : 0,
    qtyOut: isIn ? 0 : qty,
    balance: isIn ? currentStock + qty : currentStock - qty,
    reference,
    refId,
    notes,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.stockMovements.put(movement);
}

export async function getStockMovements(productId?: string, limit = 200): Promise<StockMovement[]> {
  let coll;
  if (productId) {
    coll = db.stockMovements.where('productId').equals(productId);
  } else {
    coll = db.stockMovements.orderBy('createdAt');
  }
  return coll.reverse().limit(limit).toArray();
}

export async function getStockMovementsByDateRange(
  from: number,
  to: number,
  productId?: string
): Promise<StockMovement[]> {
  let items: StockMovement[];
  if (productId) {
    items = await db.stockMovements.where('productId').equals(productId).toArray();
  } else {
    items = await db.stockMovements.toArray();
  }
  return items
    .filter((m) => m.date >= from && m.date <= to)
    .sort((a, b) => b.date - a.date);
}

export async function getAllProductStock(): Promise<{ product: Product; stock: number }[]> {
  const products = await db.products.toArray();
  const activeProducts = products.filter((p) => p.active);
  const stockMap = await getCurrentStockBatch(activeProducts.map((p) => p.id));
  return activeProducts.map((p) => ({
    product: p,
    stock: stockMap.get(p.id) || 0,
  }));
}

export async function getStockValue(): Promise<{ costValue: number; retailValue: number }> {
  const all = await getAllProductStock();
  let costValue = 0;
  let retailValue = 0;
  for (const { product, stock } of all) {
    if (stock > 0) {
      costValue += stock * product.purchaseRate;
      retailValue += stock * product.wholesaleRate;
    }
  }
  return { costValue, retailValue };
}

export async function getLowStockItems(): Promise<{ product: Product; stock: number }[]> {
  const all = await getAllProductStock();
  return all.filter(({ product, stock }) => stock <= product.minStock);
}

export async function adjustStock(
  productId: string,
  newQty: number,
  reason: string
): Promise<void> {
  const current = await getCurrentStock(productId);
  const diff = newQty - current;
  if (diff === 0) return;
  const isIn = diff > 0;
  await addStockMovement(
    productId,
    'ManualAdjustment',
    Math.abs(diff),
    isIn,
    'Manual Adjustment',
    null,
    reason
  );
}

export async function recordDamage(
  productId: string,
  qty: number,
  reason: string,
  notes: string,
  txnDate: number = now()
): Promise<void> {
  await addStockMovement(productId, 'Damage', qty, false, 'Damaged Stock', null, `${reason}: ${notes}`, txnDate);
}
