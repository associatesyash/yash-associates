import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getStockMovements } from '@/services/stockService';
import { getCurrentStock } from '@/services/stockService';
import { formatDate } from '@/utils/format';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Boxes } from 'lucide-react';
import type { Product, StockMovement } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  OpeningStock: 'Opening Stock',
  Purchase: 'Purchase',
  Sale: 'Sale',
  SalesReturn: 'Sales Return',
  PurchaseReturn: 'Purchase Return',
  Damage: 'Damage',
  ManualAdjustment: 'Adjustment',
  Correction: 'Correction',
};

export function StockHistoryDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null }) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [currentStock, setCurrentStock] = useState(0);

  useEffect(() => {
    if (product && open) {
      getStockMovements(product.id).then(setMovements);
      getCurrentStock(product.id).then(setCurrentStock);
    }
  }, [product, open]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock History - {product.code}</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
          <DialogDescription>Review stock movements for this product.</DialogDescription>
          <div>
            <span className="text-sm text-muted-foreground">Current Stock: </span>
            <span className="text-lg font-bold">{currentStock} {product.unit}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {product.category} {product.brand} {product.design} {product.size} {product.color}
          </div>
        </div>
        {movements.length === 0 ? (
          <EmptyState icon={Boxes} title="No Stock Movements" description="No stock history for this product." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Reference</th>
                <th className="text-right p-2 font-medium text-muted-foreground">In</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Out</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Balance</th>
              </tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">{formatDate(m.date)}</td>
                    <td className="p-2"><Badge variant="outline">{TYPE_LABELS[m.type] || m.type}</Badge></td>
                    <td className="p-2">{m.reference}</td>
                    <td className="p-2 text-right text-success">{m.qtyIn > 0 ? `+${m.qtyIn}` : '-'}</td>
                    <td className="p-2 text-right text-destructive">{m.qtyOut > 0 ? `-${m.qtyOut}` : '-'}</td>
                    <td className="p-2 text-right font-semibold">{m.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
