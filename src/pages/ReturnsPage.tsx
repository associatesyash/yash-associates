import { useEffect, useState, useCallback } from 'react';
import { getReturns, getReturnItems, createSalesReturn, createPurchaseReturn, cancelReturn } from '@/services/returnService';
import { getOutstandingInvoices } from '@/services/invoiceService';
import { getPurchases, getPurchaseItems } from '@/services/purchaseService';
import { getInvoiceItems } from '@/services/invoiceService';
import { getSuppliers } from '@/services/purchaseService';
import { getParties } from '@/services/partyService';
import { RETURN_REASONS } from '@/services/settingsService';
import { formatCurrency, formatDate, toDateInput, fromDateInput } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Undo2, Plus, X, Download } from 'lucide-react';
import { exportToExcel } from '@/services/exportService';
import { toast } from 'sonner';
import type { Return, Invoice, Purchase, Party, Supplier } from '@/types';

export function ReturnsPage() {
  const [tab, setTab] = useState('list');
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Return | null>(null);

  // Sales return form
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selParty, setSelParty] = useState('');
  const [selInvoice, setSelInvoice] = useState('');
  const [invItems, setInvItems] = useState<any[]>([]);
  const [returnItems, setReturnItems] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [notes, setNotes] = useState('');

  // Purchase return form
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selSupplier, setSelSupplier] = useState('');
  const [selPurchase, setSelPurchase] = useState('');
  const [purItems, setPurItems] = useState<any[]>([]);
  const [purReturnItems, setPurReturnItems] = useState<Record<string, string>>({});
  const [purReason, setPurReason] = useState('');
  const [purDate, setPurDate] = useState(toDateInput(Date.now()));
  const [purNotes, setPurNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [rets, ps, sups, invs, purs] = await Promise.all([getReturns(), getParties(), getSuppliers(), getOutstandingInvoices(), getPurchases()]);
    setReturns(rets);
    setParties(ps.filter((p) => p.active));
    setSuppliers(sups.filter((s) => s.active));
    setInvoices(invs);
    setPurchases(purs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvoiceSelect = async (invId: string) => {
    setSelInvoice(invId);
    if (invId) {
      const items = await getInvoiceItems(invId);
      setInvItems(items);
      setReturnItems({});
    } else {
      setInvItems([]);
    }
  };

  const handlePurchaseSelect = async (purId: string) => {
    setSelPurchase(purId);
    if (purId) {
      const items = await getPurchaseItems(purId);
      setPurItems(items);
      setPurReturnItems({});
    } else {
      setPurItems([]);
    }
  };

  const handleSalesReturn = async () => {
    if (!selInvoice) { toast.error('Select an invoice'); return; }
    const items = Object.entries(returnItems).map(([productId, qtyStr]) => {
      const item = invItems.find((i) => i.productId === productId);
      return { productId, productCode: item?.productCode || '', productDesc: item?.productDesc || '', qty: Number(qtyStr) || 0, rate: item?.rate || 0, amount: (Number(qtyStr) || 0) * (item?.rate || 0) };
    }).filter((i) => i.qty > 0);
    if (items.length === 0) { toast.error('Enter return quantities'); return; }
    const inv = invoices.find((i) => i.id === selInvoice);
    try {
      await createSalesReturn({ date: fromDateInput(date), invoiceId: selInvoice, partyId: inv?.partyId || '', partyName: inv?.partyName || '', items, reason, notes });
      toast.success('Sales return created');
      setTab('list');
      load();
      setSelInvoice(''); setReturnItems({}); setReason('');
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePurchaseReturn = async () => {
    if (!selPurchase) { toast.error('Select a purchase'); return; }
    const items = Object.entries(purReturnItems).map(([productId, qtyStr]) => {
      const item = purItems.find((i) => i.productId === productId);
      return { productId, productCode: item?.productCode || '', productDesc: item?.productDesc || '', qty: Number(qtyStr) || 0, rate: item?.rate || 0, amount: (Number(qtyStr) || 0) * (item?.rate || 0) };
    }).filter((i) => i.qty > 0);
    if (items.length === 0) { toast.error('Enter return quantities'); return; }
    const pur = purchases.find((p) => p.id === selPurchase);
    try {
      await createPurchaseReturn({ date: fromDateInput(purDate), purchaseId: selPurchase, supplierId: pur?.supplierId || '', supplierName: pur?.supplierName || '', items, reason: purReason, notes: purNotes });
      toast.success('Purchase return created');
      setTab('list');
      load();
      setSelPurchase(''); setPurReturnItems({}); setPurReason('');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try { await cancelReturn(cancelTarget.id); toast.success('Return cancelled'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleExport = () => {
    const rows = returns.map((r) => ({
      'Return No': r.returnNo, 'Date': formatDate(r.date), 'Type': r.type,
      'Party/Supplier': r.partyName || r.supplierName, 'Reference': r.refInvoiceNo || r.refPurchaseNo || '-',
      'Reason': r.reason, 'Amount': r.amount,
    }));
    exportToExcel(rows, 'returns.xlsx', 'Returns');
  };

  return (
    <div>
      <PageHeader title="Returns" description="Sales returns and purchase returns" icon={Undo2}
        actions={[{ label: 'Export', onClick: handleExport, icon: Download, variant: 'outline' }]} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="list">All Returns</TabsTrigger>
          <TabsTrigger value="sales">Sales Return</TabsTrigger>
          <TabsTrigger value="purchase">Purchase Return</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : returns.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={Undo2} title="No Returns" description="No returns recorded yet." /></CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Return No</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Party/Supplier</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {returns.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{r.returnNo}</td>
                        <td className="p-3">{formatDate(r.date)}</td>
                        <td className="p-3">{r.type === 'SalesReturn' ? 'Sales Return' : 'Purchase Return'}</td>
                        <td className="p-3">{r.partyName || r.supplierName}</td>
                        <td className="p-3">{r.refInvoiceNo || r.refPurchaseNo || '-'}</td>
                        <td className="p-3">{r.reason}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
                        <td className="p-3 text-right"><Button variant="ghost" size="icon" onClick={() => setCancelTarget(r)} title="Cancel"><X className="h-4 w-4 text-destructive" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Sales Return Form */}
        <TabsContent value="sales">
          <Card><CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">Sales Return</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="grid gap-2 md:col-span-2"><Label>Select Invoice</Label>
                <Select value={selInvoice} onValueChange={handleInvoiceSelect}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>{invoices.map((inv) => <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNo} - {inv.partyName} - {formatCurrency(inv.grandTotal)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {invItems.length > 0 && (
              <div className="space-y-2">
                <Label>Return Quantities</Label>
                {invItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <div className="flex-1"><span className="text-sm">{item.productDesc}</span><span className="text-sm text-muted-foreground ml-2">(Sold: {item.qty})</span></div>
                    <Input type="number" placeholder="0" value={returnItems[item.productId] || ''} onChange={(e) => setReturnItems({ ...returnItems, [item.productId]: e.target.value })} className="w-24 h-8" />
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>{RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
            <Button onClick={handleSalesReturn}><Plus className="h-4 w-4 mr-1" />Create Sales Return</Button>
          </CardContent></Card>
        </TabsContent>

        {/* Purchase Return Form */}
        <TabsContent value="purchase">
          <Card><CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">Purchase Return</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={purDate} onChange={(e) => setPurDate(e.target.value)} /></div>
              <div className="grid gap-2 md:col-span-2"><Label>Select Purchase</Label>
                <Select value={selPurchase} onValueChange={handlePurchaseSelect}>
                  <SelectTrigger><SelectValue placeholder="Select purchase" /></SelectTrigger>
                  <SelectContent>{purchases.map((p) => <SelectItem key={p.id} value={p.id}>{p.billNo} - {p.supplierName} - {formatCurrency(p.grandTotal)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {purItems.length > 0 && (
              <div className="space-y-2">
                <Label>Return Quantities</Label>
                {purItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <div className="flex-1"><span className="text-sm">{item.productDesc}</span><span className="text-sm text-muted-foreground ml-2">(Purchased: {item.qty})</span></div>
                    <Input type="number" placeholder="0" value={purReturnItems[item.productId] || ''} onChange={(e) => setPurReturnItems({ ...purReturnItems, [item.productId]: e.target.value })} className="w-24 h-8" />
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Reason</Label>
                <Select value={purReason} onValueChange={setPurReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>{RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={purNotes} onChange={(e) => setPurNotes(e.target.value)} /></div>
            </div>
            <Button onClick={handlePurchaseReturn}><Plus className="h-4 w-4 mr-1" />Create Purchase Return</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)} title="Cancel Return" description={`Cancel return ${cancelTarget?.returnNo}? Stock will be adjusted.`} confirmLabel="Cancel Return" variant="destructive" onConfirm={handleCancel} />
    </div>
  );
}
