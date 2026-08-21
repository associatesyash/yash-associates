import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getParties, getPartyOutstanding } from '@/services/partyService';
import { getOutstandingInvoices, generateReceiptNo } from '@/services/invoiceService';
import { receivePayment, getPayments, cancelPayment } from '@/services/paymentService';
import { getSettings, PAYMENT_MODES } from '@/services/settingsService';
import { formatCurrency, formatDate, toDateInput, fromDateInput } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Wallet, Plus, Search, X, Download } from 'lucide-react';
import { exportToExcel } from '@/services/exportService';
import { toast } from 'sonner';
import type { Party, Invoice, Payment } from '@/types';

export function PaymentsPage() {
  const { pageParam } = useUIStore();
  const [parties, setParties] = useState<Party[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);

  // Form state
  const [selectedParty, setSelectedParty] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [outstandingInvoices, setOutstandingInvoices] = useState<Invoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [partyOutstanding, setPartyOutstanding] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ps, pmts] = await Promise.all([getParties(), getPayments(50)]);
    setParties(ps.filter((p) => p.active));
    setPayments(pmts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-select party from invoice history
  useEffect(() => {
    if (pageParam) {
      // pageParam might be an invoice ID - find the party
      getOutstandingInvoices().then((invs: Invoice[]) => {
        const inv = invs.find((i: Invoice) => i.id === pageParam);
        if (inv) {
          setSelectedParty(inv.partyId);
          setShowForm(true);
        }
      });
    }
  }, [pageParam]);

  useEffect(() => {
    if (showForm) {
      generateReceiptNo().then(setReceiptNo);
    }
  }, [showForm]);

  useEffect(() => {
    if (selectedParty) {
      getPartyOutstanding(selectedParty).then(setPartyOutstanding);
      getOutstandingInvoices(selectedParty).then(setOutstandingInvoices);
      setAllocations({});
    } else {
      setOutstandingInvoices([]);
      setPartyOutstanding(0);
    }
  }, [selectedParty]);

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
  const paymentAmount = Number(amount) || 0;
  const isAdvance = totalAllocated < paymentAmount;

  const handleSave = async () => {
    if (!selectedParty) { toast.error('Please select a party'); return; }
    if (paymentAmount <= 0) { toast.error('Amount must be greater than zero'); return; }
    if (totalAllocated > paymentAmount + 0.01) { toast.error('Allocated amount exceeds payment'); return; }
    setSaving(true);
    try {
      const party = parties.find((p) => p.id === selectedParty);
      await receivePayment({
        date: fromDateInput(date),
        partyId: selectedParty,
        partyName: party?.name || '',
        amount: paymentAmount,
        mode,
        reference,
        notes,
        allocations: Object.entries(allocations).map(([invoiceId, amt]) => {
          const inv = outstandingInvoices.find((i) => i.id === invoiceId);
          return { invoiceId, invoiceNo: inv?.invoiceNo || '', amount: Number(amt) || 0 };
        }).filter((a) => a.amount > 0),
        isAdvance,
      });
      toast.success('Payment recorded successfully');
      setShowForm(false);
      setAmount('0'); setReference(''); setNotes(''); setSelectedParty(''); setAllocations({});
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelPayment(cancelTarget.id);
      toast.success('Payment reversed');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    return p.receiptNo.toLowerCase().includes(q) || p.partyName.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  const handleExport = () => {
    const rows = filteredPayments.map((p) => ({
      'Receipt No': p.receiptNo, 'Date': formatDate(p.date), 'Party': p.partyName,
      'Amount': p.amount, 'Mode': p.mode, 'Reference': p.reference, 'Invoice': p.invoiceNo || (p.isAdvance ? 'Advance' : '-'),
    }));
    exportToExcel(rows, 'payments.xlsx', 'Payments');
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Receive payments and manage collections"
        icon={Wallet}
        actions={[{ label: 'Receive Payment', onClick: () => setShowForm(true), icon: Plus }, { label: 'Export', onClick: handleExport, icon: Download, variant: 'outline' }]}
      />

      {!showForm ? (
        <>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by receipt no, party, or reference..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 max-w-md" />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={Wallet} title="No Payments Found" description="Record your first payment from a customer." action={{ label: 'Receive Payment', onClick: () => setShowForm(true) }} /></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Receipt No</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Party</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Mode</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                    </tr></thead>
                    <tbody>
                      {filteredPayments.map((pmt) => (
                        <tr key={pmt.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{pmt.receiptNo}</td>
                          <td className="p-3">{formatDate(pmt.date)}</td>
                          <td className="p-3">{pmt.partyName}</td>
                          <td className="p-3">{pmt.mode}</td>
                          <td className="p-3">{pmt.invoiceNo || (pmt.isAdvance ? 'Advance' : '-')}</td>
                          <td className="p-3 text-right font-semibold text-success">{formatCurrency(pmt.amount)}</td>
                          <td className="p-3 text-right"><Button variant="ghost" size="icon" onClick={() => setCancelTarget(pmt)} title="Reverse"><X className="h-4 w-4 text-destructive" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Receive Payment</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="grid gap-2"><Label>Receipt No</Label><Input value={receiptNo} disabled className="bg-muted" /></div>
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="grid gap-2 md:col-span-2"><Label>Party <span className="text-destructive">*</span></Label>
                <Select value={selectedParty} onValueChange={setSelectedParty}>
                  <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                  <SelectContent>{parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {selectedParty && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <span className="text-muted-foreground">Current Outstanding: </span><span className="font-semibold text-amber-600">{formatCurrency(partyOutstanding)}</span>
              </div>
            )}

            {outstandingInvoices.length > 0 && (
              <div className="space-y-2">
                <Label>Allocate to Invoices (Optional)</Label>
                <div className="space-y-2">
                  {outstandingInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-2 p-2 border rounded-lg">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{inv.invoiceNo}</span>
                        <span className="text-sm text-muted-foreground ml-2">{formatDate(inv.date)}</span>
                      </div>
                      <span className="text-sm text-amber-600">Outstanding: {formatCurrency(inv.outstanding)}</span>
                      <Input type="number" placeholder="0" value={allocations[inv.id] || ''} onChange={(e) => setAllocations({ ...allocations, [inv.id]: e.target.value })} className="w-24 h-8" />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Allocated: {formatCurrency(totalAllocated)}</span>
                  {isAdvance && paymentAmount > totalAllocated && <span className="text-blue-600">Advance: {formatCurrency(paymentAmount - totalAllocated)}</span>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Amount Received (₹) <span className="text-destructive">*</span></Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Payment Mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Reference No</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ID, Cheque no..." /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Payment'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title="Reverse Payment"
        description={`Reverse payment ${cancelTarget?.receiptNo}? Invoice outstanding will be restored.`}
        confirmLabel="Reverse"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </div>
  );
}
