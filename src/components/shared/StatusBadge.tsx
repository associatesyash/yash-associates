import { Badge } from '@/components/ui/badge';

export function StatusBadge({ status }: { status: 'Paid' | 'Partial' | 'Due' }) {
  if (status === 'Paid') return <Badge className="bg-success text-success-foreground hover:bg-success">Paid</Badge>;
  if (status === 'Partial') return <Badge className="bg-warning text-warning-foreground hover:bg-warning">Partial</Badge>;
  return <Badge variant="destructive">Due</Badge>;
}
