import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getParty, getPartyOutstanding, getPartyInvoices, getPartyPayments, getPartyLedger, getPartyAnalytics, getPartyReturns } from '@/services/partyService';
import { formatCurrency, formatDate, toDateInput, fromDateInput, startOfDay, endOfDay } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { exportToExcel, exportToPDF } from '@/services/exportService';
import { ArrowLeft, Phone, MapPin, Wallet, TrendingUp, ShoppingBag, Receipt, Undo2, Download, FileText } from 'lucide-react';
import type { Party, Invoice, Payment, Return } from '@/types';

export function PartyProfilePage({ partyId }: { partyId: string }) {
  const { setPage } = useUIStore();
  const [party, setParty] = useState<Party | null>(null);
  const [outstanding, setOutstanding] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [ledger, setLedger] = useState<ReturnType<typeof getPartyLedger> extends Promise<infer T> ? T : never>([]);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getPartyAnalytics>> | null>(null);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getParty(partyId);
    if (!p) { setLoading(false); return; }
    setParty(p);
    const [out, invs, pmts, rets, led, ana] = await Promise.all([
      getPartyOutstanding(partyId),
      getPartyInvoices(partyId),
      getPartyPayments(partyId),
      getPartyReturns(partyId),
      getPartyLedger(partyId),
      getPartyAnalytics(partyId),
    ]);
    setOutstanding(out);
    setInvoices(invs);
    setPayments(pmts);
    setReturns(rets);
    setLedger(led as any);
    setAnalytics(ana as any);
    setLoading(false);
  }, [partyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading party...</div>;
  if (!party) return <div className="text-center py-12"><p className="text-muted-foreground">Party not found.</p><Button className="mt-4" onClick={() => setPage('parties')}>Back to Parties</Button></div>;

  const availableCredit = party.creditLimit - outstanding;

  const filteredLedger = ledger.filter((e: any) => {
    const from = ledgerFrom ? fromDateInput(ledgerFrom) : 0;
    const to = ledgerTo ? endOfDay(fromDateInput(ledgerTo)) : Date.now();
    return e.date >= from && e.date <= to;
  });

  const exportLedger = (format: 'excel' | 'pdf') => {
    const rows = filteredLedger.map((e: any) => ({
      Date: formatDate(e.date),
      Reference: e.reference,
      Description: e.description,
      Debit: e.debit,
      Credit: e.credit,
      Balance: e.balance,
    }));
    if (format === 'excel') exportToExcel(rows, `ledger-${party.name}.xlsx`, 'Ledger');
    else exportToPDF(`Ledger - ${party.name}`, ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'], rows.map((r: any) => [r.Date, r.Reference, r.Description, r.Debit, r.Credit, r.Balance]), `ledger-${party.name}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setPage('parties')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{party.name}</h1>
          <p className="text-sm text-muted-foreground">Party Profile</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-amber-600" /><span className="text-xs text-muted-foreground">Outstanding</span></div>
            <p className={`text-xl font-bold ${outstanding > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{formatCurrency(outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground">Total Sales</span></div>
            <p className="text-xl font-bold">{formatCurrency(analytics?.totalSales || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Receipt className="h-4 w-4 text-teal-600" /><span className="text-xs text-muted-foreground">Total Payments</span></div>
            <p className="text-xl font-bold">{formatCurrency(analytics?.totalPayments || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><ShoppingBag className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">Total Orders</span></div>
            <p className="text-xl font-bold">{analytics?.totalOrders || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="history">Buying History</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Party Name</Label><p className="font-medium">{party.name}</p></div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><Label className="text-xs text-muted-foreground">Mobile</Label><p className="font-medium">{party.mobile || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">City</Label><p className="font-medium">{party.city || '-'}</p></div>
                <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><div><Label className="text-xs text-muted-foreground">Address</Label><p className="font-medium">{party.address || '-'}</p></div></div>
              </div>
              <div className="space-y-3">
                <div><Label className="text-xs text-muted-foreground">Opening Balance</Label><p className="font-medium">{formatCurrency(party.openingBalance)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Credit Limit</Label><p className="font-medium">{formatCurrency(party.creditLimit)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Available Credit</Label><p className={`font-medium ${availableCredit < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(availableCredit)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Last Purchase</Label><p className="font-medium">{analytics?.lastPurchaseDate ? formatDate(analytics.lastPurchaseDate) : 'No purchases yet'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Avg Order Value</Label><p className="font-medium">{formatCurrency(analytics?.avgOrderValue || 0)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Notes</Label><p className="font-medium">{party.notes || '-'}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="No Orders" description="This party has no invoices yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Invoice No</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Paid</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    </tr></thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setPage('invoice-history', inv.id)}>
                          <td className="p-3 font-medium">{inv.invoiceNo}</td>
                          <td className="p-3">{formatDate(inv.date)}</td>
                          <td className="p-3 text-right">{formatCurrency(inv.grandTotal)}</td>
                          <td className="p-3 text-right text-success">{formatCurrency(inv.paymentReceived)}</td>
                          <td className="p-3 text-right text-amber-600">{formatCurrency(inv.outstanding)}</td>
                          <td className="p-3 text-center"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <EmptyState icon={Wallet} title="No Payments" description="No payments received from this party." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Receipt No</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Mode</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                    </tr></thead>
                    <tbody>
                      {payments.map((pmt) => (
                        <tr key={pmt.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{pmt.receiptNo}</td>
                          <td className="p-3">{formatDate(pmt.date)}</td>
                          <td className="p-3">{pmt.mode}</td>
                          <td className="p-3">{pmt.invoiceNo || (pmt.isAdvance ? 'Advance' : '-')}</td>
                          <td className="p-3 text-right font-semibold text-success">{formatCurrency(pmt.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base">Customer Ledger</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} className="w-auto" placeholder="From" />
                  <Input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} className="w-auto" placeholder="To" />
                  <Button variant="outline" size="sm" onClick={() => exportLedger('excel')}><Download className="h-4 w-4 mr-1" />Excel</Button>
                  <Button variant="outline" size="sm" onClick={() => exportLedger('pdf')}><FileText className="h-4 w-4 mr-1" />PDF</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLedger.length === 0 ? (
                <EmptyState icon={Receipt} title="No Ledger Entries" description="No transactions for this party." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Debit</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Credit</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Balance</th>
                    </tr></thead>
                    <tbody>
                      {filteredLedger.map((e: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-muted/30">
                          <td className="p-3">{formatDate(e.date)}</td>
                          <td className="p-3 font-medium">{e.reference}</td>
                          <td className="p-3">{e.description}</td>
                          <td className="p-3 text-right">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                          <td className="p-3 text-right text-success">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(e.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buying History Tab */}
        <TabsContent value="history">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Category-wise Purchasing</CardTitle></CardHeader>
              <CardContent className="p-0">
                {analytics?.categoryWise.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No purchase data.</p>
                ) : (
                  <div className="space-y-2 p-4">
                    {analytics?.categoryWise.map((c: any) => (
                      <div key={c.category} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="text-sm font-medium">{c.category}</span>
                        <span className="text-sm font-semibold">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Brand-wise Purchasing</CardTitle></CardHeader>
              <CardContent className="p-0">
                {analytics?.brandWise.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No purchase data.</p>
                ) : (
                  <div className="space-y-2 p-4">
                    {analytics?.brandWise.map((b: any) => (
                      <div key={b.brand} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="text-sm font-medium">{b.brand}</span>
                        <span className="text-sm font-semibold">{formatCurrency(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Product-wise Purchasing</CardTitle></CardHeader>
              <CardContent className="p-0">
                {analytics?.productWise.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No purchase data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                      </tr></thead>
                      <tbody>
                        {analytics?.productWise.map((p: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-muted/30">
                            <td className="p-3">{p.productDesc}</td>
                            <td className="p-3 text-right">{p.qty}</td>
                            <td className="p-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns">
          <Card>
            <CardContent className="p-0">
              {returns.length === 0 ? (
                <EmptyState icon={Undo2} title="No Returns" description="No returns from this party." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Return No</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                    </tr></thead>
                    <tbody>
                      {returns.map((ret) => (
                        <tr key={ret.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{ret.returnNo}</td>
                          <td className="p-3">{formatDate(ret.date)}</td>
                          <td className="p-3">{ret.refInvoiceNo || '-'}</td>
                          <td className="p-3">{ret.reason}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(ret.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
