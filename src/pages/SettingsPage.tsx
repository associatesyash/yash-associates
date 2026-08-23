import { useEffect, useState, useCallback, useRef } from 'react';
import { getSettings, saveSettings, seedDefaultMetadata } from '@/services/settingsService';
import { createBackup, restoreBackup, getBackupInfo, downloadBackup } from '@/services/backupService';
import { clearAllBusinessData } from '@/services/cloudSyncService';
import { seedDemoData } from '@/services/demoDataService';
import { exportToExcel } from '@/services/exportService';
import { getParties } from '@/services/partyService';
import { getProducts } from '@/services/productService';
import { getInvoices } from '@/services/invoiceService';
import { getPayments } from '@/services/paymentService';
import { getPurchases } from '@/services/purchaseService';
import { getExpenses } from '@/services/expenseService';
import { getSuppliers } from '@/services/purchaseService';
import { getAllProductStock } from '@/services/stockService';
import { formatCurrency, formatDate } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Save, Download, Upload, Database, Sparkles, FileSpreadsheet, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import type { Settings } from '@/types';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/services/authService';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ lastBackup: any | null; totalRecords: number }>({ lastBackup: null, totalRecords: 0 });
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [tab, setTab] = useState('business');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [sett, bi] = await Promise.all([getSettings(), getBackupInfo()]);
    setSettings(sett);
    setBackupInfo(bi);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success('Settings saved');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleBackup = async () => {
    try {
      const { filename, blob, recordCount } = await createBackup();
      downloadBackup(blob, filename);
      toast.success(`Backup created with ${recordCount} records`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    try {
      const result = await restoreBackup(restoreFile);
      toast.success(`Restored ${result.recordCount} records from ${result.tableCount} tables`);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      window.location.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmRestore(false); }
  };

  const handleSeedDemo = async () => {
    try {
      await seedDemoData();
      toast.success('Demo data loaded');
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmDemo(false); }
  };

  const handleClearAllData = async () => {
    try {
      const session = supabase ? await getSession() : null;
      await clearAllBusinessData(session);
      toast.success('All business data cleared');
      window.location.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmClear(false); }
  };

  const handleExportData = async (type: string) => {
    try {
      if (type === 'parties') {
        const parties = await getParties();
        exportToExcel(parties.map((p) => ({ Name: p.name, Mobile: p.mobile, City: p.city, OpeningBalance: p.openingBalance, CreditLimit: p.creditLimit, Active: p.active })), 'parties.xlsx', 'Parties');
      } else if (type === 'products') {
        const products = await getProducts();
        exportToExcel(products.map((p) => ({ Code: p.code, Category: p.category, Brand: p.brand, Design: p.design, Size: p.size, Color: p.color, PurchaseRate: p.purchaseRate, WholesaleRate: p.wholesaleRate, MRP: p.mrp, MinStock: p.minStock, Active: p.active })), 'products.xlsx', 'Products');
      } else if (type === 'invoices') {
        const invs = await getInvoices();
        exportToExcel(invs.map((i) => ({ InvoiceNo: i.invoiceNo, Date: formatDate(i.date), Party: i.partyName, GrandTotal: i.grandTotal, Paid: i.paymentReceived, Outstanding: i.outstanding, Status: i.status })), 'invoices.xlsx', 'Invoices');
      } else if (type === 'payments') {
        const pmts = await getPayments();
        exportToExcel(pmts.map((p) => ({ ReceiptNo: p.receiptNo, Date: formatDate(p.date), Party: p.partyName, Amount: p.amount, Mode: p.mode, Reference: p.reference })), 'payments.xlsx', 'Payments');
      } else if (type === 'purchases') {
        const purs = await getPurchases();
        exportToExcel(purs.map((p) => ({ BillNo: p.billNo, Date: formatDate(p.date), Supplier: p.supplierName, GrandTotal: p.grandTotal, Paid: p.paymentMade, Outstanding: p.outstanding, Status: p.status })), 'purchases.xlsx', 'Purchases');
      } else if (type === 'suppliers') {
        const sups = await getSuppliers();
        exportToExcel(sups.map((s) => ({ Name: s.name, Mobile: s.mobile, City: s.city, GST: s.gstNumber, OpeningBalance: s.openingBalance, CreditTerms: s.creditTerms, Active: s.active })), 'suppliers.xlsx', 'Suppliers');
      } else if (type === 'stock') {
        const stock = await getAllProductStock();
        exportToExcel(stock.map(({ product, stock: s }) => ({ Code: product.code, Product: `${product.category} ${product.brand} ${product.design} ${product.size} ${product.color}`, Stock: s, MinStock: product.minStock, Unit: product.unit, CostValue: s * product.purchaseRate })), 'stock.xlsx', 'Stock');
      } else if (type === 'expenses') {
        const exps = await getExpenses();
        exportToExcel(exps.map((e) => ({ ExpenseNo: e.expenseNo, Date: formatDate(e.date), Category: e.category, Amount: e.amount, Mode: e.mode, Description: e.description })), 'expenses.xlsx', 'Expenses');
      }
      toast.success(`Exported ${type}`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (!settings) return <div className="text-center py-12 text-muted-foreground">Loading settings...</div>;

  return (
    <div>
      <PageHeader title="Settings" description="Configure your business and manage data" icon={SettingsIcon} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="invoice">Invoice & Tax</TabsTrigger>
          <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        {/* Business Info */}
        <TabsContent value="business">
          <Card><CardContent className="p-6 space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Business Name</Label><Input value={settings.businessName} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Mobile</Label><Input value={settings.mobile} onChange={(e) => setSettings({ ...settings, mobile: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Address</Label><Input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Email</Label><Input value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>GST Number</Label><Input value={settings.gstNumber} onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })} /></div>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Settings'}</Button>
          </CardContent></Card>
        </TabsContent>

        {/* Invoice & Tax */}
        <TabsContent value="invoice">
          <Card><CardContent className="p-6 space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Invoice Prefix</Label><Input value={settings.invoicePrefix} onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Receipt Prefix</Label><Input value={settings.receiptPrefix} onChange={(e) => setSettings({ ...settings, receiptPrefix: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Purchase Prefix</Label><Input value={settings.purchasePrefix} onChange={(e) => setSettings({ ...settings, purchasePrefix: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Expense Prefix</Label><Input value={settings.expensePrefix} onChange={(e) => setSettings({ ...settings, expensePrefix: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2 py-2">
              <Switch checked={settings.taxEnabled} onCheckedChange={(v) => setSettings({ ...settings, taxEnabled: v })} id="tax" />
              <Label htmlFor="tax">Enable Tax ({settings.taxName})</Label>
            </div>
            {settings.taxEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Tax Name</Label><Input value={settings.taxName} onChange={(e) => setSettings({ ...settings, taxName: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Tax Rate (%)</Label><Input type="number" value={String(settings.taxRate)} onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) || 0 })} /></div>
              </div>
            )}
            <div className="flex items-center gap-2 py-2">
              <Switch checked={settings.lowStockAlert} onCheckedChange={(v) => setSettings({ ...settings, lowStockAlert: v })} id="lowstock" />
              <Label htmlFor="lowstock">Low Stock Alerts</Label>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Settings'}</Button>
          </CardContent></Card>
        </TabsContent>

        {/* Backup & Restore */}
        <TabsContent value="backup">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4 text-primary" />Backup</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Backup:</span><span className="font-medium">{backupInfo.lastBackup ? formatDate(backupInfo.lastBackup.createdAt) : 'Never'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Records:</span><span className="font-medium">{backupInfo.totalRecords}</span></div>
                  {backupInfo.lastBackup && <div className="flex justify-between"><span className="text-muted-foreground">Backup Records:</span><span className="font-medium">{backupInfo.lastBackup.recordCount}</span></div>}
                </div>
                <Button onClick={handleBackup} className="w-full"><Download className="h-4 w-4 mr-2" />Backup Now</Button>
                <p className="text-xs text-muted-foreground">Creates a JSON file with all your data. Save it somewhere safe.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Restore</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2"><Label>Select Backup File</Label>
                  <input ref={fileInputRef} type="file" accept=".json" onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} className="text-sm" />
                </div>
                <Button variant="outline" className="w-full" disabled={!restoreFile} onClick={() => setConfirmRestore(true)}><Upload className="h-4 w-4 mr-2" />Restore Backup</Button>
                <p className="text-xs text-destructive">Warning: Restore will replace ALL current data. Make sure you have a backup first.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Export Data */}
        <TabsContent value="export">
          <Card><CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Export to Excel</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['parties', 'products', 'invoices', 'payments', 'purchases', 'suppliers', 'stock', 'expenses'].map((type) => (
                <Button key={type} variant="outline" onClick={() => handleExportData(type)} className="capitalize"><Download className="h-4 w-4 mr-2" />{type}</Button>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* Data Management */}
        <TabsContent value="data">
          <Card><CardContent className="p-6 space-y-4 max-w-lg">
            <div className="flex items-center gap-2 mb-2"><Database className="h-5 w-5 text-primary" /><h3 className="font-semibold">Data Management</h3></div>
            <p className="text-sm text-muted-foreground">Load demo data to see how the system works with realistic parties, products, invoices, payments, and more.</p>
            <Button variant="outline" onClick={() => setConfirmDemo(true)}><Sparkles className="h-4 w-4 mr-2" />Load Demo Data</Button>
            <p className="text-xs text-muted-foreground">Demo data will only be loaded if no parties exist yet.</p>
            <div className="border-t pt-4 space-y-2">
              <Button variant="destructive" onClick={() => setConfirmClear(true)}><Database className="h-4 w-4 mr-2" />Reset All Business Data</Button>
              <p className="text-xs text-muted-foreground">Clears local and cloud business records for the signed-in account. This cannot be undone.</p>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={confirmRestore} onOpenChange={setConfirmRestore} title="Restore Backup" description="This will REPLACE ALL current data with the backup file contents. Are you absolutely sure?" confirmLabel="Restore" variant="destructive" onConfirm={handleRestore} />
      <ConfirmDialog open={confirmDemo} onOpenChange={setConfirmDemo} title="Load Demo Data" description="This will add sample parties, products, invoices, and more. Continue?" confirmLabel="Load Demo Data" onConfirm={handleSeedDemo} />
      <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear} title="Reset All Business Data" description="This permanently deletes all local and cloud business records for this account. Authentication and application settings remain available. Continue?" confirmLabel="Delete Everything" variant="destructive" onConfirm={handleClearAllData} />
    </div>
  );
}
