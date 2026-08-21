import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getSuppliers, saveSupplier, deleteSupplier, toggleSupplierActive, getSupplierOutstanding, getSupplierLedger, getSupplierPayments, paySupplier } from '@/services/purchaseService';
import { getProducts } from '@/services/productService';
import { getCurrentStock } from '@/services/stockService';
import { getParties } from '@/services/partyService';
import { createPurchase, generatePurchaseNo, getPurchases, getPurchaseItems, cancelPurchase } from '@/services/purchaseService';
import { getSettings, PAYMENT_MODES } from '@/services/settingsService';
import { formatCurrency, formatDate, toDateInput, fromDateInput } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Truck, Plus, Search, Pencil, Trash2, Power, X, Eye, Wallet, Download } from 'lucide-react';
import { exportToExcel } from '@/services/exportService';
import { toast } from 'sonner';
import type { Supplier, Product, Purchase, Settings } from '@/types';

export function PurchasesPage() {
  const [tab, setTab] = useState('purchases');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Supplier form
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [outstandingMap, setOutstandingMap] = useState<Map<string, number>>(new Map());

  // Supplier detail
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [supplierLedger, setSupplierLedger] = useState<any[]>([]);
  const [supplierPmts, setSupplierPmts] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState('0');
  const [payMode, setPayMode] = useState('Cash');
  const [payRef, setPayRef] = useState('');

  // Purchase form
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [billNo, setBillNo] = useState('');
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [pItems, setPItems] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selProductId, setSelProductId] = useState('');
  const [pQty, setPQty] = useState('1');
  const [pRate, setPRate] = useState('0');
  const [pDiscount, setPDiscount] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentMade, setPaymentMade] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [cancelPurchaseTarget, setCancelPurchaseTarget] = useState<Purchase | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sups, prds, purs, sett] = await Promise.all([getSuppliers(), getProducts(), getPurchases(), getSettings()]);
    setSuppliers(sups);
    setProducts(prds.filter((p) => p.active));
    setPurchases(purs);
    setSettings(sett);
    const oMap = new Map<string, number>();
    for (const s of sups) {
      oMap.set(s.id, await getSupplierOutstanding(s.id));
    }
    setOutstandingMap(oMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Supplier form helpers
  const [sName, setSName] = useState('');
  const [sMobile, setSMobile] = useState('');
  const [sAddress, setSAddress] = useState('');
  const [sCity, setSCity] = useState('');
  const [sGst, setSGst] = useState('');
  const [sOpening, setSOpening] = useState('0');
  const [sTerms, setSTerms] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [sActive, setSActive] = useState(true);

  const openSupplierForm = (s: Supplier | null) => {
    setEditSupplier(s);
    if (s) {
      setSName(s.name); setSMobile(s.mobile); setSAddress(s.address); setSCity(s.city);
      setSGst(s.gstNumber); setSOpening(String(s.openingBalance)); setSTerms(s.creditTerms); setSNotes(s.notes); setSActive(s.active);
    } else {
      setSName(''); setSMobile(''); setSAddress(''); setSCity(''); setSGst(''); setSOpening('0'); setSTerms(''); setSNotes(''); setSActive(true);
    }
    setSupplierFormOpen(true);
  };

  const saveSupplierForm = async () => {
    if (!sName.trim()) { toast.error('Supplier name is required'); return; }
    try {
      await saveSupplier({
        id: editSupplier?.id, name: sName.trim(), mobile: sMobile.trim(), address: sAddress.trim(),
        city: sCity.trim(), gstNumber: sGst.trim(), openingBalance: Number(sOpening) || 0,
        creditTerms: sTerms.trim(), notes: sNotes.trim(), active: sActive,
      });
      toast.success(editSupplier ? 'Supplier updated' : 'Supplier created');
      setSupplierFormOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteTarget) return;
    try { await deleteSupplier(deleteTarget.id); toast.success('Supplier deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleViewSupplier = async (s: Supplier) => {
    setViewSupplier(s);
    const [led, pmts] = await Promise.all([getSupplierLedger(s.id), getSupplierPayments(s.id)]);
    setSupplierLedger(led as any);
    setSupplierPmts(pmts as any);
    setPayAmount('0'); setPayMode('Cash'); setPayRef('');
  };

  const handlePaySupplier = async () => {
    if (!viewSupplier) return;
    if (Number(payAmount) <= 0) { toast.error('Amount must be greater than zero'); return; }
    try {
      await paySupplier(viewSupplier.id, viewSupplier.name, Number(payAmount), payMode, payRef, '', Date.now());
      toast.success('Payment recorded');
      handleViewSupplier(viewSupplier);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // Purchase form
  const openPurchaseForm = async () => {
    setShowPurchaseForm(true);
    const no = await generatePurchaseNo();
    setBillNo(no);
    setPItems([]); setDiscountAmount('0'); setPaymentMade('0'); setPaymentRef(''); setPNotes(''); setSelectedSupplier(''); setProductSearch('');
  };

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return p.code.toLowerCase().includes(q) || p.design.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  }).slice(0, 10);

  const handleProductSelect = (p: Product) => {
    setSelProductId(p.id);
    setProductSearch(`${p.code} - ${p.category} ${p.brand} ${p.design} ${p.size} ${p.color}`);
    setPRate(String(p.purchaseRate));
    setShowProductDropdown(false);
  };

  const handleAddItem = () => {
    if (!selProductId) { toast.error('Select a product'); return; }
    const product = products.find((p) => p.id === selProductId);
    if (!product) return;
    const q = Number(pQty) || 0;
    if (q <= 0) { toast.error('Quantity must be > 0'); return; }
    const r = Number(pRate) || 0;
    const d = Number(pDiscount) || 0;
    setPItems([...pItems, {
      productId: product.id, productCode: product.code, productDesc: `${product.category} ${product.brand} ${product.design} ${product.size} ${product.color}`,
      category: product.category, brand: product.brand, size: product.size, color: product.color, unit: product.unit,
      qty: q, rate: r, discount: d, amount: q * r - d,
    }]);
    setSelProductId(''); setProductSearch(''); setPQty('1'); setPRate('0'); setPDiscount('0');
  };

  const subtotal = pItems.reduce((s, i) => s + i.amount, 0);
  const itemDiscounts = pItems.reduce((s, i) => s + i.discount, 0);
  const billDiscount = Number(discountAmount) || 0;
  const taxable = subtotal - itemDiscounts - billDiscount;
  const tax = settings?.taxEnabled ? Math.round(taxable * settings.taxRate) / 100 : 0;
  const beforeRound = taxable + tax;
  const grandTotal = Math.round(beforeRound);
  const outstanding = grandTotal - (Number(paymentMade) || 0);

  const handleSavePurchase = async () => {
    if (!selectedSupplier) { toast.error('Select a supplier'); return; }
    if (pItems.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const supplier = suppliers.find((s) => s.id === selectedSupplier);
      await createPurchase({
        date: fromDateInput(date), supplierId: selectedSupplier, supplierName: supplier?.name || '',
        items: pItems, discountAmount: billDiscount, notes: pNotes,
        paymentMade: Number(paymentMade) || 0, paymentMode, paymentRef,
      });
      toast.success('Purchase created');
      setShowPurchaseForm(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleCancelPurchase = async () => {
    if (!cancelPurchaseTarget) return;
    try { await cancelPurchase(cancelPurchaseTarget.id); toast.success('Purchase cancelled'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleExportPurchases = () => {
    const rows = purchases.map((p) => ({
      'Bill No': p.billNo, 'Date': formatDate(p.date), 'Supplier': p.supplierName,
      'Amount': p.grandTotal, 'Paid': p.paymentMade, 'Outstanding': p.outstanding, 'Status': p.status,
    }));
    exportToExcel(rows, 'purchases.xlsx', 'Purchases');
  };

  const filteredPurchases = purchases.filter((p) => {
    const q = search.toLowerCase();
    return p.billNo.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Manage suppliers, purchase invoices, and payments"
        icon={Truck}
        actions={[{ label: 'New Purchase', onClick: openPurchaseForm, icon: Plus }, { label: 'Add Supplier', onClick: () => openSupplierForm(null), icon: Plus, variant: 'outline' }, { label: 'Export', onClick: handleExportPurchases, icon: Download, variant: 'outline' }]}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        {/* Purchases Tab */}
        <TabsContent value="purchases">
          {showPurchaseForm ? (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">New Purchase</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowPurchaseForm(false)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Bill No</Label><Input value={billNo} disabled className="bg-muted" /></div>
                  <div className="grid gap-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="grid gap-2"><Label>Supplier <span className="text-destructive">*</span></Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Product Entry */}
                <div className="space-y-2">
                  <Label>Add Product</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search products..." value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }} onFocus={() => setShowProductDropdown(true)} className="pl-9" />
                    {showProductDropdown && filteredProducts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProducts.map((p) => (
                          <button key={p.id} className="w-full text-left p-2 hover:bg-muted/50 text-sm border-b last:border-0" onClick={() => handleProductSelect(p)}>
                            <span className="font-medium">{p.code}</span> - {p.category} {p.brand} {p.design} {p.size} {p.color}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selProductId && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                      <div className="grid gap-1"><Label className="text-xs">Rate</Label><Input type="number" value={pRate} onChange={(e) => setPRate(e.target.value)} className="h-9" /></div>
                      <div className="grid gap-1"><Label className="text-xs">Qty</Label><Input type="number" value={pQty} onChange={(e) => setPQty(e.target.value)} className="h-9" /></div>
                      <div className="grid gap-1"><Label className="text-xs">Disc</Label><Input type="number" value={pDiscount} onChange={(e) => setPDiscount(e.target.value)} className="h-9" /></div>
                      <Button onClick={handleAddItem}><Plus className="h-4 w-4 mr-1" />Add</Button>
                    </div>
                  )}
                </div>

                {pItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left p-2">Product</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Rate</th><th className="text-right p-2">Disc</th><th className="text-right p-2">Amount</th><th className="p-2"></th>
                      </tr></thead>
                      <tbody>
                        {pItems.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{item.productDesc}</td><td className="p-2 text-right">{item.qty} {item.unit}</td>
                            <td className="p-2 text-right">{formatCurrency(item.rate)}</td><td className="p-2 text-right">{formatCurrency(item.discount)}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrency(item.amount)}</td>
                            <td className="p-2"><Button variant="ghost" size="icon" onClick={() => setPItems(pItems.filter((_, idx) => idx !== i))}><X className="h-4 w-4 text-destructive" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Bill Discount</Label><Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} /></div>
                  <div className="grid gap-2"><Label>Payment Made</Label><Input type="number" value={paymentMade} onChange={(e) => setPaymentMade(e.target.value)} /></div>
                  <div className="grid gap-2"><Label>Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2"><Label>Reference</Label><Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} /></div>
                <div className="grid gap-2"><Label>Notes</Label><Textarea value={pNotes} onChange={(e) => setPNotes(e.target.value)} rows={2} /></div>

                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div>Subtotal: {formatCurrency(subtotal)}</div>
                    <div>Discount: -{formatCurrency(itemDiscounts + billDiscount)}</div>
                    {tax > 0 && <div>Tax: {formatCurrency(tax)}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">Grand Total: {formatCurrency(grandTotal)}</div>
                    <div className="text-sm text-amber-600">Outstanding: {formatCurrency(outstanding)}</div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowPurchaseForm(false)}>Cancel</Button>
                  <Button onClick={handleSavePurchase} disabled={saving}>{saving ? 'Saving...' : 'Save Purchase'}</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="mb-4"><CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by bill no or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 max-w-md" />
                </div>
              </CardContent></Card>
              {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : filteredPurchases.length === 0 ? (
                <Card><CardContent className="p-0"><EmptyState icon={Truck} title="No Purchases" description="Record your first purchase." action={{ label: 'New Purchase', onClick: openPurchaseForm }} /></CardContent></Card>
              ) : (
                <Card><CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Bill No</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Supplier</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Paid</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                      </tr></thead>
                      <tbody>
                        {filteredPurchases.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{p.billNo}</td>
                            <td className="p-3">{formatDate(p.date)}</td>
                            <td className="p-3">{p.supplierName}</td>
                            <td className="p-3 text-right">{formatCurrency(p.grandTotal)}</td>
                            <td className="p-3 text-right text-success">{formatCurrency(p.paymentMade)}</td>
                            <td className="p-3 text-right text-amber-600">{formatCurrency(p.outstanding)}</td>
                            <td className="p-3 text-center"><StatusBadge status={p.status} /></td>
                            <td className="p-3 text-right"><Button variant="ghost" size="icon" onClick={() => setCancelPurchaseTarget(p)} title="Cancel"><X className="h-4 w-4 text-destructive" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers">
          {viewSupplier ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{viewSupplier.name}</h2>
                    <p className="text-sm text-muted-foreground">{viewSupplier.mobile} - {viewSupplier.city}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Outstanding:</span>
                    <span className="text-lg font-bold text-amber-600">{formatCurrency(outstandingMap.get(viewSupplier.id) || 0)}</span>
                    <Button variant="ghost" size="icon" onClick={() => setViewSupplier(null)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* Pay Supplier */}
                <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/50 rounded-lg">
                  <div className="grid gap-1"><Label className="text-xs">Pay Amount</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-9 w-32" /></div>
                  <div className="grid gap-1"><Label className="text-xs">Mode</Label>
                    <Select value={payMode} onValueChange={setPayMode}><SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="grid gap-1"><Label className="text-xs">Reference</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-9 w-32" /></div>
                  <Button onClick={handlePaySupplier}><Wallet className="h-4 w-4 mr-1" />Pay</Button>
                </div>

                {/* Ledger */}
                <div>
                  <h3 className="font-semibold mb-2">Supplier Ledger</h3>
                  {supplierLedger.length === 0 ? <p className="text-sm text-muted-foreground">No transactions.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/50">
                          <th className="text-left p-2">Date</th><th className="text-left p-2">Reference</th><th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Debit</th><th className="text-right p-2">Credit</th><th className="text-right p-2">Balance</th>
                        </tr></thead>
                        <tbody>
                          {supplierLedger.map((e: any, i: number) => (
                            <tr key={i} className="border-b">
                              <td className="p-2">{formatDate(e.date)}</td><td className="p-2 font-medium">{e.reference}</td><td className="p-2">{e.description}</td>
                              <td className="p-2 text-right">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                              <td className="p-2 text-right text-success">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                              <td className="p-2 text-right font-semibold">{formatCurrency(e.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {suppliers.length === 0 ? (
                <Card><CardContent className="p-0"><EmptyState icon={Truck} title="No Suppliers" description="Add your first supplier." action={{ label: 'Add Supplier', onClick: () => openSupplierForm(null) }} /></CardContent></Card>
              ) : (
                <Card><CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Mobile</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">City</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Opening Bal</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                      </tr></thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr key={s.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{s.name}</td>
                            <td className="p-3">{s.mobile || '-'}</td>
                            <td className="p-3">{s.city || '-'}</td>
                            <td className="p-3 text-right">{formatCurrency(s.openingBalance)}</td>
                            <td className="p-3 text-right font-semibold text-amber-600">{formatCurrency(outstandingMap.get(s.id) || 0)}</td>
                            <td className="p-3 text-center">{s.active ? <span className="text-xs text-success font-semibold">Active</span> : <span className="text-xs text-muted-foreground">Inactive</span>}</td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleViewSupplier(s)} title="View"><Eye className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => openSupplierForm(s)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={async () => { await toggleSupplierActive(s.id); load(); }} title="Toggle"><Power className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Supplier Form Dialog */}
      {supplierFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSupplierFormOpen(false)}>
          <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editSupplier ? 'Edit Supplier' : 'New Supplier'}</h2>
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Supplier Name <span className="text-destructive">*</span></Label><Input value={sName} onChange={(e) => setSName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Mobile</Label><Input value={sMobile} onChange={(e) => setSMobile(e.target.value)} maxLength={10} /></div>
                <div className="grid gap-2"><Label>City</Label><Input value={sCity} onChange={(e) => setSCity(e.target.value)} /></div>
              </div>
              <div className="grid gap-2"><Label>Address</Label><Textarea value={sAddress} onChange={(e) => setSAddress(e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>GST Number</Label><Input value={sGst} onChange={(e) => setSGst(e.target.value)} /></div>
                <div className="grid gap-2"><Label>Opening Balance</Label><Input type="number" value={sOpening} onChange={(e) => setSOpening(e.target.value)} /></div>
              </div>
              <div className="grid gap-2"><Label>Credit Terms</Label><Input value={sTerms} onChange={(e) => setSTerms(e.target.value)} placeholder="e.g. 30 days" /></div>
              <div className="grid gap-2"><Label>Notes</Label><Textarea value={sNotes} onChange={(e) => setSNotes(e.target.value)} rows={2} /></div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setSupplierFormOpen(false)}>Cancel</Button>
              <Button onClick={saveSupplierForm}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)} title="Delete Supplier" description={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" variant="destructive" onConfirm={handleDeleteSupplier} />
      <ConfirmDialog open={!!cancelPurchaseTarget} onOpenChange={(v) => !v && setCancelPurchaseTarget(null)} title="Cancel Purchase" description={`Cancel purchase ${cancelPurchaseTarget?.billNo}? Stock will be reduced.`} confirmLabel="Cancel Purchase" variant="destructive" onConfirm={handleCancelPurchase} />
    </div>
  );
}
