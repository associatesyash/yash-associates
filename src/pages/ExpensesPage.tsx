import { useEffect, useState, useCallback } from 'react';
import { getExpenses, createExpense, cancelExpense } from '@/services/expenseService';
import { getCategories, PAYMENT_MODES } from '@/services/settingsService';
import { formatCurrency, formatDate, toDateInput, fromDateInput } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Receipt, Plus, Search, X, Download } from 'lucide-react';
import { exportToExcel } from '@/services/exportService';
import { toast } from 'sonner';
import type { Expense } from '@/types';

const PAGE_SIZE = 15;

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPageState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Expense | null>(null);

  // Form
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState('Cash');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [exps, cats] = await Promise.all([getExpenses(), getCategories('expense')]);
    setExpenses(exps);
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = expenses.filter((e) => {
    const q = search.toLowerCase();
    return e.expenseNo.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);

  const handleSave = async () => {
    if (!category) { toast.error('Select a category'); return; }
    if (Number(amount) <= 0) { toast.error('Amount must be > 0'); return; }
    setSaving(true);
    try {
      await createExpense(fromDateInput(date), category, Number(amount), mode, description, notes);
      toast.success('Expense recorded');
      setShowForm(false);
      setAmount('0'); setDescription(''); setNotes(''); setCategory('');
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try { await cancelExpense(cancelTarget.id); toast.success('Expense cancelled'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      'Expense No': e.expenseNo, 'Date': formatDate(e.date), 'Category': e.category,
      'Amount': e.amount, 'Mode': e.mode, 'Description': e.description,
    }));
    exportToExcel(rows, 'expenses.xlsx', 'Expenses');
  };

  return (
    <div>
      <PageHeader title="Expenses" description="Track business expenses" icon={Receipt}
        actions={[{ label: 'Add Expense', onClick: () => setShowForm(true), icon: Plus }, { label: 'Export', onClick: handleExport, icon: Download, variant: 'outline' }]} />

      {!showForm ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Expenses</p><p className="text-xl font-bold">{formatCurrency(totalAmount)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Count</p><p className="text-xl font-bold">{filtered.length}</p></CardContent></Card>
          </div>

          <Card className="mb-4"><CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 max-w-md" />
            </div>
          </CardContent></Card>

          {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={Receipt} title="No Expenses" description="Record your first expense." action={{ label: 'Add Expense', onClick: () => setShowForm(true) }} /></CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Expense No</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Mode</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {pageItems.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{e.expenseNo}</td>
                        <td className="p-3">{formatDate(e.date)}</td>
                        <td className="p-3">{e.category}</td>
                        <td className="p-3">{e.description}</td>
                        <td className="p-3">{e.mode}</td>
                        <td className="p-3 text-right font-semibold text-destructive">{formatCurrency(e.amount)}</td>
                        <td className="p-3 text-right"><Button variant="ghost" size="icon" onClick={() => setCancelTarget(e)} title="Cancel"><X className="h-4 w-4 text-destructive" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t">
                  <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPageState(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPageState(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent></Card>
          )}
        </>
      ) : (
        <Card><CardContent className="p-6 space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New Expense</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Amount (₹) <span className="text-destructive">*</span></Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Payment Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this expense for?" /></div>
          <div className="grid gap-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Expense'}</Button>
          </div>
        </CardContent></Card>
      )}

      <ConfirmDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)} title="Cancel Expense" description={`Cancel expense ${cancelTarget?.expenseNo}?`} confirmLabel="Cancel" variant="destructive" onConfirm={handleCancel} />
    </div>
  );
}
