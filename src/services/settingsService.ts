import { db, uid, now } from '../database/db';
import type { Setting, Settings, Category, Brand } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const SETTINGS_ID = 'app-settings';

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) {
    const initial: Setting = {
      id: SETTINGS_ID,
      key: 'settings',
      value: DEFAULT_SETTINGS,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.settings.put(initial);
    return { ...DEFAULT_SETTINGS };
  }

  const saved = { ...DEFAULT_SETTINGS, ...(row.value as Partial<Settings>) };
  const needsBusinessRepair = !saved.gstNumber || saved.gstNumber === '24AABCU9603R1ZX' || saved.address.includes('Main Market') || saved.address.includes('Near Main Market') || saved.address.includes('Market Road');

  if (needsBusinessRepair) {
    const repaired = {
      ...saved,
      address: DEFAULT_SETTINGS.address,
      gstNumber: DEFAULT_SETTINGS.gstNumber,
      businessName: DEFAULT_SETTINGS.businessName,
    };
    await db.settings.put({ ...row, value: repaired, updatedAt: now() });
    return repaired;
  }

  return saved;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({
    id: SETTINGS_ID,
    key: 'settings',
    value: settings,
    createdAt: now(),
    updatedAt: now(),
  });
}

export async function getCategories(type?: 'product' | 'expense'): Promise<string[]> {
  const cats = await db.categories.toArray();
  const filtered = type ? cats.filter((c) => c.type === type) : cats;
  return filtered.map((c) => c.name).sort();
}

export async function addCategory(name: string, type: 'product' | 'expense'): Promise<void> {
  const existing = await db.categories.where('name').equals(name).toArray();
  if (existing.some((c) => c.type === type)) return;
  await db.categories.put({
    id: uid(),
    name,
    type,
    createdAt: now(),
    updatedAt: now(),
  });
}

export async function getBrands(): Promise<string[]> {
  const brands = await db.brands.toArray();
  return brands.map((b) => b.name).sort();
}

export async function addBrand(name: string): Promise<void> {
  const existing = await db.brands.where('name').equals(name).toArray();
  if (existing.length > 0) return;
  await db.brands.put({
    id: uid(),
    name,
    createdAt: now(),
    updatedAt: now(),
  });
}

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Bra',
  'Panty',
  'Camisole',
  'Shapewear',
  'Nightwear',
  'Lingerie Set',
  'Thermal Wear',
  'Other',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Salary',
  'Electricity',
  'Transport',
  'Loading and Unloading',
  'Packaging',
  'Telephone',
  'Repair',
  'Travel',
  'Other Expenses',
];

export const DEFAULT_BRANDS = ['Brand A', 'Brand B', 'Brand C', 'Jockey', 'Enamor', 'Zivame'];

export const DEFAULT_SIZES = ['28', '30', '32', '34', '36', '38', '40', '42', '44', 'M', 'L', 'XL', 'XXL'];

export const DEFAULT_COLORS = ['Black', 'White', 'Skin', 'Red', 'Blue', 'Pink', 'Grey', 'Beige'];

export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Credit', 'Cheque'];

export const RETURN_REASONS = [
  'Damaged Goods',
  'Wrong Size',
  'Wrong Product',
  'Defective Product',
  'Customer Return',
  'Supplier Return',
];

export async function seedDefaultMetadata(): Promise<void> {
  const cats = await db.categories.toArray();
  if (cats.length === 0) {
    const catRecords: Category[] = [
      ...DEFAULT_PRODUCT_CATEGORIES.map((name) => ({
        id: uid(),
        name,
        type: 'product' as const,
        createdAt: now(),
        updatedAt: now(),
      })),
      ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
        id: uid(),
        name,
        type: 'expense' as const,
        createdAt: now(),
        updatedAt: now(),
      })),
    ];
    await db.categories.bulkPut(catRecords);
  }
  const brands = await db.brands.toArray();
  if (brands.length === 0) {
    const brandRecords: Brand[] = DEFAULT_BRANDS.map((name) => ({
      id: uid(),
      name,
      createdAt: now(),
      updatedAt: now(),
    }));
    await db.brands.bulkPut(brandRecords);
  }
  await getSettings();
}
