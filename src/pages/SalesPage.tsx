import { useEffect, useState, useCallback, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getParties } from '@/services/partyService';
import { getProducts } from '@/services/productService';
import { getCurrentStock } from '@/services/stockService';
import { getPartyOutstanding } from '@/services/partyService';
import { createInvoice, generateInvoiceNo } from '@/services/invoiceService';
import { getSettings, PAYMENT_MODES } from '@/services/settingsService';
import { formatCurrency, formatDate, toDateInput, fromDateInput } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, Plus, Trash2, Search, AlertTriangle, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Party, Product, Settings } from '@/types';

interface BillItem {
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
  discountRate: number;
  amount: number;
  availableStock: number;
}

export function SalesPage() {
  const { setPage } = useUIStore();
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [selectedParty, setSelectedParty] = useState('');
  const [partyOutstanding, setPartyOutstanding] = useState(0);
  const [items, setItems] = useState<BillItem[]>([]);
  const [billDiscountRate, setBillDiscountRate] = useState('0');
  const [paymentReceived, setPaymentReceived] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productStock, setProductStock] = useState(0);
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const searchRef = useRef<HTMLInputElement>(null);

  const init = useCallback(async () => {
    const [ps, prds, sett, invNo] = await Promise.all([
      getParties(), getProducts(), getSettings(), generateInvoiceNo(),
    ]);
    setParties(ps.filter((p) => p.active));
    setProducts(prds.filter((p) => p.active));
    setSettings(sett);
    setInvoiceNo(invNo);
  }, []);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (selectedParty) {
      getPartyOutstanding(selectedParty).then(setPartyOutstanding);
    } else {
      setPartyOutstanding(0);
    }
  }, [selectedParty]);

  const party = parties.find((p) => p.id === selectedParty);
  const availableCredit = party ? party.creditLimit - partyOutstanding : 0;

  // Calculations
  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const itemDiscounts = items.reduce((s, i) => s + i.discount, 0);
  const billDiscountRateValue = Number(billDiscountRate) || 0;
  const billDiscount = Math.max(0, (subtotal - itemDiscounts) * billDiscountRateValue / 100);
  const taxableAmount = subtotal - itemDiscounts - billDiscount;
  const taxAmount = settings?.taxEnabled ? Math.round(taxableAmount * settings.taxRate) / 100 : 0;
  const beforeRound = taxableAmount + taxAmount;
  const grandTotal = Math.round(beforeRound);
  const roundOff = grandTotal - beforeRound;
  const payment = Number(paymentReceived) || 0;
  const outstanding = grandTotal - payment;
  const status = outstanding <= 0 ? 'Paid' : payment > 0 ? 'Partial' : 'Due';

  // New invoice total vs credit limit
  const projectedOutstanding = partyOutstanding + outstanding;
  const overLimit = party && party.creditLimit > 0 && projectedOutstanding > party.creditLimit;

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return p.code.toLowerCase().includes(q) || p.design.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.color.toLowerCase().includes(q) || p.size.toLowerCase().includes(q);
  }).slice(0, 10);

  const handleProductSelect = async (p: Product) => {
    setSelectedProductId(p.id);
    setProductSearch(`${p.code} - ${p.category} ${p.brand} ${p.design} ${p.size} ${p.color}`);
    setRate(String(p.wholesaleRate));
    const stock = await getCurrentStock(p.id);
    setProductStock(stock);
    setShowProductDropdown(false);
    setQty('1');
    setDiscount('0');
  };

  const handleAddItem = () => {
    if (!selectedProductId) { toast.error('Select a product first'); return; }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    const q = Number(qty) || 0;
    if (q <= 0) { toast.error('Quantity must be greater than zero'); return; }
    if (q > productStock) { toast.error(`Insufficient stock. Available: ${productStock}`); return; }
    const r = Number(rate) || 0;
    const discountRate = Math.max(0, Number(discount) || 0);
    const d = q * r * discountRate / 100;
    const amount = q * r - d;
    setItems([...items, {
      productId: product.id, productCode: product.code, productDesc: `${product.category} ${product.brand} ${product.design} ${product.size} ${product.color}`,
      category: product.category, brand: product.brand, size: product.size, color: product.color, unit: product.unit,
      qty: q, rate: r, discount: d, discountRate, amount, availableStock: productStock,
    }]);
    setSelectedProductId('');
    setProductSearch('');
    setQty('1');
    setRate('0');
    setDiscount('0');
    setProductStock(0);
    searchRef.current?.focus();
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!selectedParty) { toast.error('Please select a party'); return; }
    if (items.length === 0) { toast.error('Please add at least one item'); return; }
    setLoading(true);
    try {
      await createInvoice({
        date: fromDateInput(date),
        partyId: selectedParty,
        partyName: party?.name || '',
        items: items.map((i) => ({
          productId: i.productId, productCode: i.productCode, productDesc: i.productDesc,
          category: i.category, brand: i.brand, size: i.size, color: i.color, unit: i.unit,
          qty: i.qty, rate: i.rate, discount: i.discount, amount: i.amount,
        })),
        discountAmount: billDiscount,
        billDiscountRate: billDiscountRateValue,
        notes,
        salesperson,
        paymentReceived: payment,
        paymentMode,
        paymentRef,
      });
      toast.success(`Invoice ${invoiceNo} created successfully`);
      // Reset form
      setItems([]); setBillDiscountRate('0'); setPaymentReceived('0'); setPaymentRef(''); setNotes(''); setSalesperson(''); setSelectedParty('');
      init();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedProductId) {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div>
      <PageHeader title="Sales / Billing" description="Create a new invoice quickly" icon={ShoppingCart} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Bill Header + Items */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="grid gap-2">
                  <Label>Invoice No</Label>
                  <Input value={invoiceNo} disabled className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Party <span className="text-destructive">*</span></Label>
                  <Select value={selectedParty} onValueChange={setSelectedParty}>
                    <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                    <SelectContent>
                      {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} - {p.mobile}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Salesperson</Label><Input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} placeholder="Salesperson name" /></div>
                <div className="grid gap-2 md:col-span-2"><Label>Narration</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional narration" /></div>
              </div>
              {party && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <div><span className="text-muted-foreground">Outstanding: </span><span className="font-semibold text-amber-600">{formatCurrency(partyOutstanding)}</span></div>
                  <div><span className="text-muted-foreground">Credit Limit: </span><span className="font-semibold">{formatCurrency(party.creditLimit)}</span></div>
                  <div><span className="text-muted-foreground">Available Credit: </span><span className={`font-semibold ${availableCredit < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(availableCredit)}</span></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Entry */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label>Add Product</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Search by code, design, brand, category..."
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
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
              {selectedProductId && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                  <div className="grid gap-1">
                    <Label className="text-xs">Stock</Label>
                    <Input value={productStock} disabled className="bg-muted h-9" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Rate (₹)</Label>
                    <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9" onKeyDown={handleKeyDown} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Discount (%)</Label>
                    <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9" onKeyDown={handleKeyDown} />
                  </div>
                  <Button onClick={handleAddItem}><Plus className="h-4 w-4 mr-1" />Add</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No items added yet. Search and add products above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium text-muted-foreground">Product</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Qty</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Rate</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Discount (%)</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                      <th className="p-2"></th>
                    </tr></thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30">
                          <td className="p-2">{item.productDesc}</td>
                          <td className="p-2 text-right">{item.qty} {item.unit}</td>
                          <td className="p-2 text-right">{formatCurrency(item.rate)}</td>
                          <td className="p-2 text-right">{item.discountRate}%</td>
                          <td className="p-2 text-right font-semibold">{formatCurrency(item.amount)}</td>
                          <td className="p-2"><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Summary */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-base">Bill Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Item Discounts</span><span>-{formatCurrency(itemDiscounts)}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Bill Discount (%)</span>
                  <div className="relative"><Input type="number" min="0" value={billDiscountRate} onChange={(e) => setBillDiscountRate(e.target.value)} className="w-24 h-8 pr-6 text-right" /><span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span></div>
                </div>
                {settings?.taxEnabled && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{settings.taxName} ({settings.taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Round Off</span><span>{formatCurrency(roundOff)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-base">Payment</h3>
              <div className="grid gap-2">
                <Label>Payment Received (₹)</Label>
                <Input type="number" value={paymentReceived} onChange={(e) => setPaymentReceived(e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Reference Number</Label>
                <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="UPI ID, Cheque no..." />
              </div>
              <div className="space-y-2 text-sm pt-2 border-t">
                <div className="flex justify-between font-bold"><span>Outstanding</span><span className={outstanding > 0 ? 'text-amber-600' : 'text-success'}>{formatCurrency(outstanding)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-semibold">{status}</span></div>
              </div>
            </CardContent>
          </Card>

          {overLimit && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Credit limit exceeded! Projected outstanding: {formatCurrency(projectedOutstanding)} vs limit {formatCurrency(party?.creditLimit || 0)}</span>
            </div>
          )}

          <Card>
            <CardContent className="p-4">
              <Label>Payment narration</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Invoice notes or reference" className="mt-1" />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setItems([]); setSelectedParty(''); setBillDiscountRate('0'); setPaymentReceived('0'); setPaymentRef(''); setNotes(''); setSalesperson(''); }}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
            <Button className="flex-1" onClick={() => setConfirmOpen(true)} disabled={loading || items.length === 0}>
              <Save className="h-4 w-4 mr-1" />{loading ? 'Saving...' : 'Save Invoice'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Invoice"
        description={`Create invoice ${invoiceNo} for ${party?.name} with grand total ${formatCurrency(grandTotal)}?${overLimit ? ' Credit limit will be exceeded!' : ''}`}
        confirmLabel="Create Invoice"
        onConfirm={handleSave}
      />
    </div>
  );
}
