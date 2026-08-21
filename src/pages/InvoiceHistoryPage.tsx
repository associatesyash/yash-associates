import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getInvoices, getInvoiceWithItems, cancelInvoice } from '@/services/invoiceService';
import { getSettings } from '@/services/settingsService';
import { formatCurrency, formatDate, toDateInput, fromDateInput, startOfDay, endOfDay } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Receipt, Search, Eye, Printer, Undo2, X, Download } from 'lucide-react';
import { exportToExcel } from '@/services/exportService';
import { printInvoice } from '@/services/exportService';
import { toast } from 'sonner';
import type { Invoice, InvoiceItem, Settings } from '@/types';

const PAGE_SIZE = 15;

export function InvoiceHistoryPage() {
  const { setPage } = useUIStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPageState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [viewInvoice, setViewInvoice] = useState<{ invoice: Invoice; items: InvoiceItem[] } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [invs, sett] = await Promise.all([getInvoices(), getSettings()]);
    setInvoices(invs);
    setSettings(sett);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch = inv.invoiceNo.toLowerCase().includes(q) || inv.partyName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const from = fromDate ? startOfDay(fromDateInput(fromDate)) : 0;
    const to = toDate ? endOfDay(fromDateInput(toDate)) : Date.now();
    const matchDate = inv.date >= from && inv.date <= to;
    return matchSearch && matchStatus && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleView = async (inv: Invoice) => {
    const data = await getInvoiceWithItems(inv.id);
    if (data) setViewInvoice(data);
  };

  const handlePrint = async (inv: Invoice) => {
    const data = await getInvoiceWithItems(inv.id);
    if (data && settings) {
      printInvoice({
        name: settings.businessName, address: settings.address, mobile: settings.mobile,
        email: settings.email, gstNumber: settings.gstNumber,
      }, data.invoice, data.items);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((inv) => ({
      'Invoice No': inv.invoiceNo, 'Date': formatDate(inv.date), 'Party': inv.partyName,
      'Amount': inv.grandTotal, 'Paid': inv.paymentReceived, 'Outstanding': inv.outstanding, 'Status': inv.status,
    }));
    exportToExcel(rows, 'invoices.xlsx', 'Invoices');
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelInvoice(cancelTarget.id);
      toast.success('Invoice cancelled');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader
        title="Invoice History"
        description="View, print, and manage all invoices"
        icon={Receipt}
        actions={[{ label: 'New Invoice', onClick: () => setPage('sales'), icon: Receipt }, { label: 'Export', onClick: handleExport, icon: Download, variant: 'outline' }]}
      />

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by invoice no or party..." value={search} onChange={(e) => { setSearch(e.target.value); setPageState(0); }} className="pl-9 max-w-md" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPageState(0); }} className="w-auto" />
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPageState(0); }} className="w-auto" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPageState(0); }}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Due">Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading invoices...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Receipt} title="No Invoices Found" description="Create your first invoice to start selling." action={{ label: 'New Invoice', onClick: () => setPage('sales') }} /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Invoice No</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Party</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {pageItems.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{inv.invoiceNo}</td>
                      <td className="p-3">{formatDate(inv.date)}</td>
                      <td className="p-3">{inv.partyName}</td>
                      <td className="p-3 text-right">{formatCurrency(inv.grandTotal)}</td>
                      <td className="p-3 text-right text-success">{formatCurrency(inv.paymentReceived)}</td>
                      <td className="p-3 text-right text-amber-600">{formatCurrency(inv.outstanding)}</td>
                      <td className="p-3 text-center"><StatusBadge status={inv.status} /></td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleView(inv)} title="View"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrint(inv)} title="Print"><Printer className="h-4 w-4" /></Button>
                          {inv.outstanding > 0 && <Button variant="ghost" size="icon" onClick={() => setPage('payments', inv.id)} title="Receive Payment"><Undo2 className="h-4 w-4 text-success" /></Button>}
                          <Button variant="ghost" size="icon" onClick={() => setCancelTarget(inv)} title="Cancel"><X className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages} ({filtered.length} invoices)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPageState(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPageState(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Invoice Dialog */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Invoice {viewInvoice.invoice.invoiceNo}</h2>
              <Button variant="ghost" size="icon" onClick={() => setViewInvoice(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-muted-foreground">Date: </span>{formatDate(viewInvoice.invoice.date)}</div>
              <div><span className="text-muted-foreground">Party: </span>{viewInvoice.invoice.partyName}</div>
              <div><span className="text-muted-foreground">Status: </span><StatusBadge status={viewInvoice.invoice.status} /></div>
              <div><span className="text-muted-foreground">Payment Mode: </span>{viewInvoice.invoice.paymentMode || '-'}</div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2">Product</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Rate</th>
                <th className="text-right p-2">Disc</th>
                <th className="text-right p-2">Amount</th>
              </tr></thead>
              <tbody>
                {viewInvoice.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{item.productDesc}</td>
                    <td className="p-2 text-right">{item.qty} {item.unit}</td>
                    <td className="p-2 text-right">{formatCurrency(item.rate)}</td>
                    <td className="p-2 text-right">{formatCurrency(item.discount)}</td>
                    <td className="p-2 text-right font-semibold">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(viewInvoice.invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatCurrency(viewInvoice.invoice.discountAmount)}</span></div>
              {viewInvoice.invoice.taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(viewInvoice.invoice.taxAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-1"><span>Grand Total</span><span>{formatCurrency(viewInvoice.invoice.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="text-success">{formatCurrency(viewInvoice.invoice.paymentReceived)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="text-amber-600">{formatCurrency(viewInvoice.invoice.outstanding)}</span></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => handlePrint(viewInvoice.invoice)}><Printer className="h-4 w-4 mr-1" />Print</Button>
              <Button onClick={() => setViewInvoice(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title="Cancel Invoice"
        description={`Cancel invoice ${cancelTarget?.invoiceNo}? Stock will be restored and payments reversed. This action cannot be undone.`}
        confirmLabel="Cancel Invoice"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </div>
  );
}
