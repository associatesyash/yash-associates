import { useEffect, useState, useCallback } from 'react';
import {
  getSalesByDateRange, getPaymentsByDateRange, getPurchasesByDateRange, getExpensesByDateRange,
  getProductWiseSales, getCustomerWiseSales, getBrandWiseSales, getCategoryWiseSales, getPartyAging,
} from '@/services/reportService';
import { getParties } from '@/services/partyService';
import { getSuppliers } from '@/services/purchaseService';
import { getAllProductStock } from '@/services/stockService';
import { getLowStockItems } from '@/services/stockService';
import { formatCurrency, formatDate, toDateInput, fromDateInput, startOfDay, endOfDay, startOfMonth, endOfMonth } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { exportToExcel, exportToPDF } from '@/services/exportService';
import { BarChart3, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function ReportsPage() {
  const [tab, setTab] = useState('sales');
  const today = Date.now();
  const [fromDate, setFromDate] = useState(toDateInput(startOfMonth(today)));
  const [toDate, setToDate] = useState(toDateInput(endOfDay(today)));
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(false);

  const from = startOfDay(fromDateInput(fromDate));
  const to = endOfDay(fromDateInput(toDate));

  const load = useCallback(async () => {
    setLoading(true);
    let rows: any[] = [];
    let total = 0;

    switch (tab) {
      case 'sales': {
        const invs = await getSalesByDateRange(from, to);
        rows = invs.map((i) => ({ 'Invoice No': i.invoiceNo, 'Date': formatDate(i.date), 'Party': i.partyName, 'Amount': i.grandTotal, 'Paid': i.paymentReceived, 'Outstanding': i.outstanding, 'Status': i.status }));
        total = invs.reduce((s, i) => s + i.grandTotal, 0);
        break;
      }
      case 'payments': {
        const pmts = await getPaymentsByDateRange(from, to);
        rows = pmts.map((p) => ({ 'Receipt No': p.receiptNo, 'Date': formatDate(p.date), 'Party': p.partyName, 'Amount': p.amount, 'Mode': p.mode, 'Reference': p.reference, 'Invoice': p.invoiceNo || (p.isAdvance ? 'Advance' : '-') }));
        total = pmts.reduce((s, p) => s + p.amount, 0);
        break;
      }
      case 'purchases': {
        const purs = await getPurchasesByDateRange(from, to);
        rows = purs.map((p) => ({ 'Bill No': p.billNo, 'Date': formatDate(p.date), 'Supplier': p.supplierName, 'Amount': p.grandTotal, 'Paid': p.paymentMade, 'Outstanding': p.outstanding, 'Status': p.status }));
        total = purs.reduce((s, p) => s + p.grandTotal, 0);
        break;
      }
      case 'expenses': {
        const exps = await getExpensesByDateRange(from, to);
        rows = exps.map((e) => ({ 'Expense No': e.expenseNo, 'Date': formatDate(e.date), 'Category': e.category, 'Amount': e.amount, 'Mode': e.mode, 'Description': e.description }));
        total = exps.reduce((s, e) => s + e.amount, 0);
        break;
      }
      case 'productSales': {
        const ps = await getProductWiseSales(from, to);
        rows = ps.map((p) => ({ 'Product': p.productDesc, 'Qty': p.qty, 'Amount': p.amount }));
        total = ps.reduce((s, p) => s + p.amount, 0);
        break;
      }
      case 'customerSales': {
        const cs = await getCustomerWiseSales(from, to);
        rows = cs.map((c) => ({ 'Party': c.partyName, 'Orders': c.count, 'Amount': c.amount }));
        total = cs.reduce((s, c) => s + c.amount, 0);
        break;
      }
      case 'brandSales': {
        const bs = await getBrandWiseSales(from, to);
        rows = bs.map((b) => ({ 'Brand': b.brand, 'Amount': b.amount }));
        total = bs.reduce((s, b) => s + b.amount, 0);
        break;
      }
      case 'categorySales': {
        const cs = await getCategoryWiseSales(from, to);
        rows = cs.map((c) => ({ 'Category': c.category, 'Amount': c.amount }));
        total = cs.reduce((s, c) => s + c.amount, 0);
        break;
      }
      case 'aging': {
        const ag = await getPartyAging();
        rows = ag.map((a) => ({ 'Party': a.partyName, 'Current': a.current, '1-30': a.overdue30, '31-60': a.overdue60, '60+': a.overdue90, 'Total': a.total }));
        total = ag.reduce((s, a) => s + a.total, 0);
        break;
      }
      case 'stock': {
        const all = await getAllProductStock();
        rows = all.map(({ product, stock }) => ({ 'Code': product.code, 'Product': `${product.category} ${product.brand} ${product.design} ${product.size} ${product.color}`, 'Stock': stock, 'Min': product.minStock, 'Cost Value': stock * product.purchaseRate, 'Retail Value': stock * product.wholesaleRate }));
        total = all.reduce((s, { product, stock }) => s + stock * product.purchaseRate, 0);
        break;
      }
      case 'lowStock': {
        const low = await getLowStockItems();
        rows = low.map(({ product, stock }) => ({ 'Code': product.code, 'Product': `${product.category} ${product.brand} ${product.design} ${product.size} ${product.color}`, 'Current': stock, 'Min': product.minStock, 'Reorder': Math.max(product.minStock * 2 - stock, product.minStock) }));
        total = low.length;
        break;
      }
    }

    setData(rows);
    setSummary({ total, count: rows.length });
    setLoading(false);
  }, [tab, from, to]);

  useEffect(() => { load(); }, [load]);

  const handleExportExcel = () => {
    if (data.length === 0) { toast.error('No data to export'); return; }
    const sheetName = tab === 'sales' ? 'Sales' : tab === 'payments' ? 'Payments' : tab === 'purchases' ? 'Purchases' : tab === 'expenses' ? 'Expenses' : tab === 'productSales' ? 'Product Sales' : tab === 'customerSales' ? 'Customer Sales' : tab === 'brandSales' ? 'Brand Sales' : tab === 'categorySales' ? 'Category Sales' : tab === 'aging' ? 'Customer Aging' : tab === 'stock' ? 'Stock' : 'Low Stock';
    exportToExcel(data, `${sheetName}-${formatDate(from)}-to-${formatDate(to)}.xlsx`, sheetName);
  };

  const handleExportPDF = () => {
    if (data.length === 0) { toast.error('No data to export'); return; }
    const headers = Object.keys(data[0]);
    const rows = data.map((r) => headers.map((h) => r[h]));
    const title = tab === 'sales' ? 'Sales Report' : tab === 'payments' ? 'Payment Collection' : tab === 'purchases' ? 'Purchase Report' : tab === 'expenses' ? 'Expense Report' : tab === 'productSales' ? 'Product-wise Sales' : tab === 'customerSales' ? 'Customer-wise Sales' : tab === 'brandSales' ? 'Brand-wise Sales' : tab === 'categorySales' ? 'Category-wise Sales' : tab === 'aging' ? 'Customer Aging' : tab === 'stock' ? 'Stock Report' : 'Low Stock Report';
    exportToPDF(title, headers, rows, `${title.replace(/\s/g, '-')}.pdf`);
  };

  const reportTabs = [
    { key: 'sales', label: 'Sales' },
    { key: 'payments', label: 'Payments' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'productSales', label: 'Product Sales' },
    { key: 'customerSales', label: 'Customer Sales' },
    { key: 'brandSales', label: 'Brand Sales' },
    { key: 'categorySales', label: 'Category Sales' },
    { key: 'aging', label: 'Customer Aging' },
    { key: 'stock', label: 'Stock' },
    { key: 'lowStock', label: 'Low Stock' },
  ];

  const isStockReport = tab === 'stock' || tab === 'lowStock';

  return (
    <div>
      <PageHeader title="Reports" description="Business analytics and reports" icon={BarChart3}
        actions={[{ label: 'Excel', onClick: handleExportExcel, icon: Download, variant: 'outline' }, { label: 'PDF', onClick: handleExportPDF, icon: FileText, variant: 'outline' }]} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {reportTabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>

        <Card className="mb-4 mt-2"><CardContent className="p-4 flex flex-wrap items-end gap-4">
          {!isStockReport && (
            <>
              <div className="grid gap-2"><Label>From Date</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-auto" /></div>
              <div className="grid gap-2"><Label>To Date</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-auto" /></div>
            </>
          )}
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">{tab === 'lowStock' ? 'Items' : 'Total'}</p>
            <p className="text-xl font-bold">{tab === 'lowStock' ? summary.count : formatCurrency(summary.total)}</p>
          </div>
        </CardContent></Card>

        <TabsContent value={tab}>
          {loading ? <div className="text-center py-8 text-muted-foreground">Loading report...</div> : data.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No data found for the selected criteria.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    {Object.keys(data[0]).map((h) => <th key={h} className="text-left p-3 font-medium text-muted-foreground">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        {Object.keys(data[0]).map((h) => {
                          const val = row[h];
                          const isCurrency = typeof val === 'number' && (h === 'Amount' || h === 'Paid' || h === 'Outstanding' || h === 'Cost Value' || h === 'Retail Value' || h === 'Current' || h === '1-30' || h === '31-60' || h === '60+' || h === 'Total');
                          return <td key={h} className={`p-3 ${isCurrency ? 'text-right font-semibold' : ''}`}>{isCurrency ? formatCurrency(val) : val}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
