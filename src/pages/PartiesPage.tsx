import { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getParties, deleteParty, togglePartyActive } from '@/services/partyService';
import { getPartyOutstandingBatch } from '@/services/partyService';
import { formatCurrency } from '@/utils/format';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Search, Pencil, Eye, Trash2, Power } from 'lucide-react';
import { PartyFormDialog } from './PartyFormDialog';
import { toast } from 'sonner';
import type { Party } from '@/types';

const PAGE_SIZE = 10;

export function PartiesPage() {
  const { setPage } = useUIStore();
  const [parties, setParties] = useState<Party[]>([]);
  const [outstandingMap, setOutstandingMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState('');
  const [page, setPageState] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getParties();
      setParties(all);
      const outstanding = await getPartyOutstandingBatch(all.map((p) => p.id));
      setOutstandingMap(outstanding);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = parties.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.mobile.includes(q) ||
      p.city.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleEdit = (party: Party) => {
    setEditParty(party);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditParty(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteParty(deleteTarget.id);
      toast.success('Party deleted');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete party');
    }
  };

  const handleToggleActive = async (party: Party) => {
    try {
      await togglePartyActive(party.id);
      load();
      toast.success(party.active ? 'Party deactivated' : 'Party activated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Parties"
        description="Manage customers and their outstanding balances"
        icon={Users}
        actions={[{ label: 'Add Party', onClick: handleAdd, icon: Plus }]}
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, mobile, or city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageState(0);
              }}
              className="pl-9 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading parties...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No Parties Found"
              description="Create your first customer to start managing sales and outstanding balances."
              action={{ label: 'Add Party', onClick: handleAdd }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Party Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Mobile</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">City</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Opening Bal</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Credit Limit</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((party) => {
                    const outstanding = outstandingMap.get(party.id) || 0;
                    const overLimit = party.creditLimit > 0 && outstanding > party.creditLimit;
                    return (
                      <tr key={party.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">{party.name}</td>
                        <td className="p-3">{party.mobile || '-'}</td>
                        <td className="p-3">{party.city || '-'}</td>
                        <td className="p-3 text-right">{formatCurrency(party.openingBalance)}</td>
                        <td className={`p-3 text-right font-semibold ${outstanding > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {formatCurrency(outstanding)}
                          {overLimit && <span className="ml-1 text-xs text-destructive">Over limit!</span>}
                        </td>
                        <td className="p-3 text-right">{formatCurrency(party.creditLimit)}</td>
                        <td className="p-3 text-center">
                          {party.active ? (
                            <Badge className="bg-success/10 text-success border-0">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setPage('party-profile', party.id)} title="View">
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(party)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(party)} title={party.active ? 'Deactivate' : 'Activate'}>
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(party)} title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages} ({filtered.length} parties)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPageState(page - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPageState(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PartyFormDialog open={formOpen} onOpenChange={setFormOpen} party={editParty} onSaved={load} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Party"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
