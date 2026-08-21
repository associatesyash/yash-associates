import { useEffect, useState, useCallback } from 'react';
import { getProducts, deleteProduct, toggleProductActive } from '@/services/productService';
import { getCurrentStock } from '@/services/stockService';
import { getCategories, getBrands, DEFAULT_SIZES, DEFAULT_COLORS } from '@/services/settingsService';
import { formatCurrency } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Package, Plus, Search, Pencil, Trash2, Power, Boxes } from 'lucide-react';
import { ProductFormDialog } from './ProductFormDialog';
import { StockHistoryDialog } from './StockHistoryDialog';
import { toast } from 'sonner';
import type { Product } from '@/types';

const PAGE_SIZE = 10;

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPageState] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Product | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [all, cats, brs] = await Promise.all([getProducts(), getCategories('product'), getBrands()]);
    setProducts(all);
    setCategories(cats);
    setBrands(brs);
    const sMap = new Map<string, number>();
    for (const p of all) {
      const stock = await getCurrentStock(p.id);
      sMap.set(p.id, stock);
    }
    setStockMap(sMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.code.toLowerCase().includes(q) || p.design.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    const matchBrand = filterBrand === 'all' || p.brand === filterBrand;
    const matchSize = filterSize === 'all' || p.size === filterSize;
    const matchColor = filterColor === 'all' || p.color === filterColor;
    const stock = stockMap.get(p.id) || 0;
    const matchLow = !lowStockOnly || stock <= p.minStock;
    return matchSearch && matchCat && matchBrand && matchSize && matchColor && matchLow;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      toast.success('Product deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (product: Product) => {
    try {
      await toggleProductActive(product.id);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog with variants"
        icon={Package}
        actions={[{ label: 'Add Product', onClick: () => { setEditProduct(null); setFormOpen(true); }, icon: Plus }]}
      />

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by code, design, category, brand..." value={search} onChange={(e) => { setSearch(e.target.value); setPageState(0); }} className="pl-9 max-w-md" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPageState(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterBrand} onValueChange={(v) => { setFilterBrand(v); setPageState(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Brands</SelectItem>{brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterSize} onValueChange={(v) => { setFilterSize(v); setPageState(0); }}>
              <SelectTrigger className="w-[100px]"><SelectValue placeholder="Size" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Sizes</SelectItem>{DEFAULT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterColor} onValueChange={(v) => { setFilterColor(v); setPageState(0); }}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Color" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Colors</SelectItem>{DEFAULT_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant={lowStockOnly ? 'default' : 'outline'} size="sm" onClick={() => { setLowStockOnly(!lowStockOnly); setPageState(0); }}>
              Low Stock Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading products...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Package} title="No Products Found" description="Add your first product to start managing inventory." action={{ label: 'Add Product', onClick: () => { setEditProduct(null); setFormOpen(true); } }} /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Brand</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Design</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Size</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Color</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">W-Rate</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Stock</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {pageItems.map((p) => {
                    const stock = stockMap.get(p.id) || 0;
                    const isLow = stock <= p.minStock;
                    return (
                      <tr key={p.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{p.code}</td>
                        <td className="p-3">{p.category}</td>
                        <td className="p-3">{p.brand}</td>
                        <td className="p-3">{p.design}</td>
                        <td className="p-3">{p.size || '-'}</td>
                        <td className="p-3">{p.color || '-'}</td>
                        <td className="p-3 text-right">{formatCurrency(p.wholesaleRate)}</td>
                        <td className={`p-3 text-right font-semibold ${isLow ? 'text-destructive' : 'text-foreground'}`}>{stock} {p.unit}</td>
                        <td className="p-3 text-center">{p.active ? <Badge className="bg-success/10 text-success border-0">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setHistoryTarget(p)} title="Stock History"><Boxes className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditProduct(p); setFormOpen(true); }} title="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggle(p)} title={p.active ? 'Deactivate' : 'Activate'}><Power className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages} ({filtered.length} products)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPageState(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPageState(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editProduct} onSaved={load} />
      <StockHistoryDialog open={!!historyTarget} onOpenChange={(v) => !v && setHistoryTarget(null)} product={historyTarget} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)} title="Delete Product" description={`Delete "${deleteTarget?.code}"? This cannot be undone.`} confirmLabel="Delete" variant="destructive" onConfirm={handleDelete} />
    </div>
  );
}
