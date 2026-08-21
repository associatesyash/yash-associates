import { useUIStore, type PageKey } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Wallet,
  Boxes,
  Truck,
  Undo2,
  Receipt,
  BarChart3,
  Settings,
  X,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { signOut } from '@/services/authService';
import { toast } from 'sonner';

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Main' },
  { key: 'parties', label: 'Parties', icon: Users, group: 'Main' },
  { key: 'products', label: 'Products', icon: Package, group: 'Main' },
  { key: 'sales', label: 'Sales / Billing', icon: ShoppingCart, group: 'Main' },
  { key: 'invoice-history', label: 'Invoice History', icon: Receipt, group: 'Main' },
  { key: 'payments', label: 'Payments', icon: Wallet, group: 'Main' },
  { key: 'stock', label: 'Stock', icon: Boxes, group: 'Main' },
  { key: 'purchases', label: 'Purchases', icon: Truck, group: 'Main' },
  { key: 'suppliers', label: 'Suppliers', icon: Users, group: 'Main' },
  { key: 'returns', label: 'Returns', icon: Undo2, group: 'Main' },
  { key: 'expenses', label: 'Expenses', icon: Receipt, group: 'Main' },
  { key: 'reports', label: 'Reports', icon: BarChart3, group: 'Main' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'Main' },
];

export function Sidebar() {
  const { currentPage, setPage, sidebarOpen, setSidebar } = useUIStore();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground',
          'flex flex-col transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              YA
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide">YASH ASSOCIATES</div>
              <div className="text-xs text-sidebar-foreground/60">Wholesale ERP</div>
            </div>
          </div>
          <button
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setSidebar(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.key || (item.key === 'parties' && currentPage === 'party-profile');
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <button
            className="mb-3 flex w-full items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => signOut().catch((error) => toast.error(error instanceof Error ? error.message : 'Unable to sign out'))}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
            <Sparkles className="h-3 w-3" />
            <span>Offline-First ERP v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
