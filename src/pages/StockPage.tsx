import { useEffect, useState, useCallback } from 'react';
import { getAllProductStock, getLowStockItems, getStockValue, getStockMovements, adjustStock, recordDamage } from '@/services/stockService';
import { getCategories, getBrands, DEFAULT_SIZES, DEFAULT_COLORS } from '@/services/settingsService';
import { formatCurrency, formatDate } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Boxes, AlertTriangle, History, Wrench, Package, Download } from 'lucide-react';
import { exportToExcel } from '@/services/exportService';
import { toast } from 'sonner';
import type { Product, StockMovement } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  OpeningStock: 'Opening Stock', Purchase: 'Purchase', Sale: 'Sale',
  SalesReturn: 'Sales Return', PurchaseReturn: 'Purchase Return',
  Damage: 'Damage', ManualAdjustment: 'Adjustment', Correction: 'Correction',
};

export function StockPage() {
  const [tab, setTab] = useState('current');
  const [stockItems, setStockItems] = useState<{ product: Product; stock: number }[]>([]);
  const [lowStock, setLowStock] = useState<{ product: Product; stock: number }[]>([]);
  const [stockValue, setStockValue] = useState({ costValue: 0, retailValue: 0 });
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [loading, setLoading] = useState(true);

  // Adjustment form
  const [adjustProduct, setAdjustProduct] = useState('');
  const [adjustQty, setAdjustQty] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');

  // Damage form
  const [damageProduct, setDamageProduct] = useState('');
  const [damageQty, setDamageQty] = useState('0');
  const [damageReason, setDamageReason] = useState('');
  const [damageNotes, setDamageNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [items, low, val, movs, cats, brs] = await Promise.all([
      getAllProductStock(), getLowStockItems(), getStockValue(), getStockMovements(undefined, 100),
      getCategories('product'), getBrands(),
    ]);
    setStockItems(items);
    setLowStock(low);
    setStockValue(val);
    setMovements(movs);
    setCategories(cats);
    setBrands(brs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredStock = stockItems.filter(({ product, stock }) => {
    const q = search.toLowerCase();
    const matchSearch = product.code.toLowerCase().includes(q) || product.design.toLowerCase().includes(q) || product.brand.toLowerCase().includes(q);
    const matchCat = filterCat === 'all' || product.category === filterCat;
    const matchBrand = filterBrand === 'all' || product.brand === filterBrand;
    return matchSearch && matchCat && matchBrand;
  });

  const handleAdjust = async () => {
    if (!adjustProduct) { toast.error('Select a product'); return; }
    try {
      await adjustStock(adjustProduct, Number(adjustQty) || 0, adjustReason);
      toast.success('Stock adjusted');
      setAdjustProduct(''); setAdjustQty('0'); setAdjustReason('');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDamage = async () => {
    if (!damageProduct) { toast.error('Select a product'); return; }
    if (Number(damageQty) <= 0) { toast.error('Quantity must be greater than zero'); return; }
    try {
      await recordDamage(damageProduct, Number(damageQty) || 0, damageReason, damageNotes);
      toast.success('Damaged stock recorded');
      setDamageProduct(''); setDamageQty('0'); setDamageReason(''); setDamageNotes('');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExport = () => {
    const rows = filteredStock.map(({ product, stock }) => ({
      'Code': product.code, 'Category': product.category, 'Brand': product.brand,
      'Design': product.design, 'Size': product.size, 'Color': product.color,
      'Stock': stock, 'Min Stock': product.minStock, 'Unit': product.unit,
      'Cost Value': stock * product.purchaseRate, 'Retail Value': stock * product.wholesaleRate,
    }));
    exportToExcel(rows, 'stock.xlsx', 'Stock');
  };

  return (
    <div>
      <PageHeader
        title="Stock Management"
        description="Current stock, low stock alerts, history, and adjustments"
        icon={Boxes}
        actions={[{ label: 'Export', onClick: handleExport, icon: Download, variant: 'outline' }]}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-xl font-bold">{stockItems.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stock Value (Cost)</p><p className="text-xl font-bold">{formatCurrency(stockValue.costValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stock Value (Retail)</p><p className="text-xl font-bold">{formatCurrency(stockValue.retailValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Low Stock Items</p><p className="text-xl font-bold text-destructive">{lowStock.length}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="current">Current Stock</TabsTrigger>
          <TabsTrigger value="low">Low Stock</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="adjust">Adjustment</TabsTrigger>
          <TabsTrigger value="damage">Damaged</TabsTrigger>
        </TabsList>

        {/* Current Stock */}
        <TabsContent value="current">
          <Card className="mb-4">
            <CardContent className="p-4 flex flex-wrap gap-2">
              <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterBrand} onValueChange={setFilterBrand}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Brand" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Brands</SelectItem>{brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : filteredStock.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={Package} title="No Products" description="No products in stock." /></CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Stock</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Min</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Cost Value</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Retail Value</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {filteredStock.map(({ product, stock }) => (
                      <tr key={product.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{product.code}</td>
                        <td className="p-3">{product.category} {product.brand} {product.design} {product.size} {product.color}</td>
                        <td className={`p-3 text-right font-semibold ${stock <= product.minStock ? 'text-destructive' : ''}`}>{stock} {product.unit}</td>
                        <td className="p-3 text-right">{product.minStock}</td>
                        <td className="p-3 text-right">{formatCurrency(stock * product.purchaseRate)}</td>
                        <td className="p-3 text-right">{formatCurrency(stock * product.wholesaleRate)}</td>
                        <td className="p-3 text-center">{stock <= product.minStock ? <span className="text-xs text-destructive font-semibold">Low</span> : <span className="text-xs text-success font-semibold">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Low Stock */}
        <TabsContent value="low">
          {lowStock.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={AlertTriangle} title="All Stock Levels Healthy" description="No items are running low." /></CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Current</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Min</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Reorder Qty</th>
                  </tr></thead>
                  <tbody>
                    {lowStock.map(({ product, stock }) => (
                      <tr key={product.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{product.code}</td>
                        <td className="p-3">{product.category} {product.brand} {product.design} {product.size} {product.color}</td>
                        <td className="p-3 text-right text-destructive font-semibold">{stock} {product.unit}</td>
                        <td className="p-3 text-right">{product.minStock}</td>
                        <td className="p-3 text-right font-semibold">{Math.max(product.minStock * 2 - stock, product.minStock)} {product.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          {movements.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={History} title="No Stock Movements" description="No stock history yet." /></CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">In</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Out</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Balance</th>
                  </tr></thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">{formatDate(m.date)}</td>
                        <td className="p-3">{m.productDesc}</td>
                        <td className="p-3">{TYPE_LABELS[m.type] || m.type}</td>
                        <td className="p-3">{m.reference}</td>
                        <td className="p-3 text-right text-success">{m.qtyIn > 0 ? `+${m.qtyIn}` : '-'}</td>
                        <td className="p-3 text-right text-destructive">{m.qtyOut > 0 ? `-${m.qtyOut}` : '-'}</td>
                        <td className="p-3 text-right font-semibold">{m.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Adjustment */}
        <TabsContent value="adjust">
          <Card><CardContent className="p-6 space-y-4 max-w-lg">
            <div className="flex items-center gap-2 mb-2"><Wrench className="h-5 w-5 text-primary" /><h3 className="font-semibold">Stock Adjustment</h3></div>
            <div className="grid gap-2"><Label>Product</Label>
              <Select value={adjustProduct} onValueChange={setAdjustProduct}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{stockItems.map(({ product }) => <SelectItem key={product.id} value={product.id}>{product.code} - {product.category} {product.brand} {product.design} {product.size} {product.color}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>New Stock Quantity</Label><Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Reason</Label><Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason for adjustment" /></div>
            <Button onClick={handleAdjust}>Apply Adjustment</Button>
          </CardContent></Card>
        </TabsContent>

        {/* Damage */}
        <TabsContent value="damage">
          <Card><CardContent className="p-6 space-y-4 max-w-lg">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5 text-destructive" /><h3 className="font-semibold">Record Damaged Stock</h3></div>
            <div className="grid gap-2"><Label>Product</Label>
              <Select value={damageProduct} onValueChange={setDamageProduct}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{stockItems.map(({ product }) => <SelectItem key={product.id} value={product.id}>{product.code} - {product.category} {product.brand} {product.design} {product.size} {product.color}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Quantity Damaged</Label><Input type="number" value={damageQty} onChange={(e) => setDamageQty(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Reason</Label>
              <Select value={damageReason} onValueChange={setDamageReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Damaged Goods">Damaged Goods</SelectItem>
                  <SelectItem value="Defective Product">Defective Product</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} rows={2} /></div>
            <Button variant="destructive" onClick={handleDamage}>Record Damage</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
