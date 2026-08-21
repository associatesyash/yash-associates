import { db, uid, now } from '../database/db';
import type { Product } from '../types';
import { addStockMovement } from './stockService';
import { logAudit } from './auditService';

export async function getProducts(): Promise<Product[]> {
  return db.products.orderBy('createdAt').reverse().toArray();
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function saveProduct(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  if (product.id) {
    const existing = await db.products.get(product.id);
    if (!existing) throw new Error('Product not found');
    await db.products.put({
      ...existing,
      ...product,
      id: product.id,
      updatedAt: now(),
    });
    await logAudit('Product Updated', 'Product', product.id, `Updated product: ${product.code}`);
    return product.id;
  }

  const dupes = await db.products
    .where('code')
    .equals(product.code)
    .toArray();
  const isDuplicate = dupes.some(
    (p) =>
      p.category === product.category &&
      p.brand === product.brand &&
      p.design === product.design &&
      p.size === product.size &&
      p.color === product.color
  );
  if (isDuplicate) {
    throw new Error('A product with the same code, category, brand, design, size, and color already exists.');
  }

  const id = uid();
  const newProduct: Product = {
    ...product,
    id,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.products.put(newProduct);

  if (product.openingStock > 0) {
    await addStockMovement(
      id,
      'OpeningStock',
      product.openingStock,
      true,
      'Opening Stock',
      null,
      'Initial opening stock',
      now()
    );
  }

  await logAudit('Product Created', 'Product', id, `Created product: ${product.code}`);
  return id;
}

export async function deleteProduct(id: string): Promise<void> {
  const product = await db.products.get(id);
  if (!product) return;
  const invoiceItems = await db.invoiceItems.where('productId').equals(id).toArray();
  if (invoiceItems.length > 0) {
    throw new Error('Cannot delete product with existing sales. Deactivate instead.');
  }
  await db.products.delete(id);
  await logAudit('Product Deleted', 'Product', id, `Deleted product: ${product.code}`);
}

export async function toggleProductActive(id: string): Promise<void> {
  const product = await db.products.get(id);
  if (!product) return;
  await db.products.put({ ...product, active: !product.active, updatedAt: now() });
  await logAudit('Product Updated', 'Product', id, `${product.active ? 'Deactivated' : 'Activated'} product: ${product.code}`);
}

export function getProductDesc(p: Product): string {
  return `${p.category} ${p.brand} ${p.design} ${p.size} ${p.color}`.trim();
}
