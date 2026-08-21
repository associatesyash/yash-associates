import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getDashboardStats, getSalesTrend, getTopCategories } from '@/services/reportService';
import { getInvoices } from '@/services/invoiceService';
import { getPayments } from '@/services/paymentService';
import { getPurchases } from '@/services/purchaseService';
import { getExpenses } from '@/services/expenseService';
import { getLowStockItems } from '@/services/stockService';
import { formatCurrency, formatDate } from '@/utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Users,
  Wallet,
  ShoppingCart,
  TrendingUp,
  Boxes,
  AlertTriangle,
  Package,
  Truck,
  BarChart3,
  Settings,
  Receipt,
  ArrowRight,
  CalendarDays,
  Banknote,
} from 'lucide-react';
import type { Invoice, Payment, Purchase, Expense } from '@/types';

export function Dashboard() {
  const { setPage } = useUIStore();
  const [stats, setStats] = useState<ReturnType<typeof getDashboardStats> extends Promise<infer T> ? T : never>({
    totalParties: 0,
    totalProducts: 0,
    customerOutstanding: 0,
    todaySales: 0,
    todayPayments: 0,
    stockValue: 0,
    lowStockCount: 0,
    monthlySales: 0,
    monthlyExpenses: 0,
    monthlyPurchases: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [lowStock, setLowStock] = useState<{ product: any; stock: number }[]>([]);
  const [trend, setTrend] = useState<{ date: number; value: number }[]>([]);
  const [topCats, setTopCats] = useState<{ name: string; value: number }[]>([]);

  const load = useCallback(async () => {
    const [s, inv, pmt, pur, exp, low, tr, cats] = await Promise.all([
      getDashboardStats(),
      getInvoices(5),
      getPayments(5),
      getPurchases(5),
      getExpenses(5),
      getLowStockItems(),
      getSalesTrend(30),
      getTopCategories(5),
    ]);
    setStats(s);
    setRecentInvoices(inv);
    setRecentPayments(pmt);
    setRecentPurchases(pur);
    setRecentExpenses(exp);
    setLowStock(low);
    setTrend(tr);
    setTopCats(cats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = [
    { label: 'Total Parties', value: stats.totalParties, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', page: 'parties' as const, isCurrency: false },
    { label: 'Customer Outstanding', value: stats.customerOutstanding, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', page: 'parties' as const, isCurrency: true },
    { label: "Today's Sales", value: stats.todaySales, icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-50', page: 'invoice-history' as const, isCurrency: true },
    { label: "Today's Payments", value: stats.todayPayments, icon: Banknote, color: 'text-teal-600', bg: 'bg-teal-50', page: 'payments' as const, isCurrency: true },
    { label: 'Current Stock Value', value: stats.stockValue, icon: Boxes, color: 'text-indigo-600', bg: 'bg-indigo-50', page: 'stock' as const, isCurrency: true },
    { label: 'Low Stock Items', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', page: 'stock' as const, isCurrency: false },
    { label: 'Monthly Sales', value: stats.monthlySales, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', page: 'reports' as const, isCurrency: true },
    { label: 'Monthly Expenses', value: stats.monthlyExpenses, icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50', page: 'expenses' as const, isCurrency: true },
  ];

  const actions = [
    { label: 'Parties', icon: Users, page: 'parties' as const, color: 'bg-blue-500' },
    { label: 'Products', icon: Package, page: 'products' as const, color: 'bg-indigo-500' },
    { label: 'Sales', icon: ShoppingCart, page: 'sales' as const, color: 'bg-green-500' },
    { label: 'Payments', icon: Wallet, page: 'payments' as const, color: 'bg-teal-500' },
    { label: 'Stock', icon: Boxes, page: 'stock' as const, color: 'bg-purple-500' },
    { label: 'Purchases', icon: Truck, page: 'purchases' as const, color: 'bg-orange-500' },
    { label: 'Reports', icon: BarChart3, page: 'reports' as const, color: 'bg-cyan-500' },
    { label: 'Settings', icon: Settings, page: 'settings' as const, color: 'bg-slate-500' },
  ];

  const maxTrend = Math.max(...trend.map((t) => t.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">YASH ASSOCIATES</h1>
        <p className="text-sm text-muted-foreground">Ladies Undergarment Wholesale Management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card
            key={i}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setPage(kpi.page)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <p className="text-xl font-bold mt-1">
                    {kpi.isCurrency ? formatCurrency(kpi.value) : kpi.value}
                  </p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => setPage(action.page)}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} text-white group-hover:scale-105 transition-transform`}>
                <action.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Sales Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {trend.map((t, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t-sm transition-colors relative group"
                style={{ height: `${(t.value / maxTrend) * 100}%`, minHeight: '2px' }}
                title={`${formatDate(t.date)}: ${formatCurrency(t.value)}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Invoices</CardTitle>
            <button onClick={() => setPage('invoice-history')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {recentInvoices.length === 0 ? (
              <EmptyState icon={Receipt} title="No invoices yet" description="Create your first invoice to start selling." />
            ) : (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{inv.invoiceNo} - {inv.partyName}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(inv.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(inv.grandTotal)}</div>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Payments</CardTitle>
            <button onClick={() => setPage('payments')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {recentPayments.length === 0 ? (
              <EmptyState icon={Wallet} title="No payments yet" description="Record a payment from a customer." />
            ) : (
              <div className="space-y-2">
                {recentPayments.map((pmt) => (
                  <div key={pmt.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{pmt.receiptNo} - {pmt.partyName}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(pmt.date)} - {pmt.mode}</div>
                    </div>
                    <div className="text-sm font-semibold text-success">{formatCurrency(pmt.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Purchases</CardTitle>
            <button onClick={() => setPage('purchases')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {recentPurchases.length === 0 ? (
              <EmptyState icon={Truck} title="No purchases yet" description="Record a purchase from a supplier." />
            ) : (
              <div className="space-y-2">
                {recentPurchases.map((pur) => (
                  <div key={pur.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{pur.billNo} - {pur.supplierName}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(pur.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(pur.grandTotal)}</div>
                      <StatusBadge status={pur.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Low Stock Alert</CardTitle>
            <button onClick={() => setPage('stock')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {lowStock.length === 0 ? (
              <EmptyState icon={Boxes} title="All stock levels are healthy" description="No items are running low." />
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 5).map(({ product, stock }) => (
                  <div key={product.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{product.code}</div>
                      <div className="text-xs text-muted-foreground">{product.category} {product.brand} {product.design} {product.size} {product.color}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-destructive">{stock} {product.unit}</div>
                      <div className="text-xs text-muted-foreground">Min: {product.minStock}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
