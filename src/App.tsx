import { useEffect, lazy, Suspense, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { seedDefaultMetadata } from '@/services/settingsService';
import { seedDemoData } from '@/services/demoDataService';
import { getParties } from '@/services/partyService';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { AuthPage } from '@/components/auth/AuthPage';
import { getSession, onAuthStateChange } from '@/services/authService';
import { syncLocalData } from '@/services/cloudSyncService';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase';

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const PartiesPage = lazy(() => import('@/pages/PartiesPage').then(m => ({ default: m.PartiesPage })));
const PartyProfilePage = lazy(() => import('@/pages/PartyProfilePage').then(m => ({ default: m.PartyProfilePage })));
const ProductsPage = lazy(() => import('@/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const SalesPage = lazy(() => import('@/pages/SalesPage').then(m => ({ default: m.SalesPage })));
const InvoiceHistoryPage = lazy(() => import('@/pages/InvoiceHistoryPage').then(m => ({ default: m.InvoiceHistoryPage })));
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const StockPage = lazy(() => import('@/pages/StockPage').then(m => ({ default: m.StockPage })));
const PurchasesPage = lazy(() => import('@/pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const ReturnsPage = lazy(() => import('@/pages/ReturnsPage').then(m => ({ default: m.ReturnsPage })));
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function App() {
  const { currentPage, pageParam, setOnline } = useUIStore();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let cancelled = false;
    // Initialize local metadata, then authenticate and reconcile local/cloud records.
    (async () => {
      const currentSession = isSupabaseConfigured ? await getSession() : null;
      if (cancelled) return;
      setSession(currentSession);
      setAuthReady(true);
      await seedDefaultMetadata();
      const parties = await getParties();
      if (parties.length === 0) {
        await seedDemoData();
      }
      if (currentSession) await syncLocalData(currentSession);
    })();

    const authSubscription = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void syncLocalData(nextSession);
    });

    const handleSync = () => {
      if (session) void syncLocalData(session);
    };
    window.addEventListener('online', handleSync);
    const syncTimer = window.setInterval(handleSync, 30000);

    return () => {
      cancelled = true;
      authSubscription.data.subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleSync);
      window.clearInterval(syncTimer);
    };
  }, [setOnline, session]);

  if (!authReady) return <PageLoader />;
  if (isSupabaseConfigured && !session) return <AuthPage />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'parties': return <PartiesPage />;
      case 'party-profile': return pageParam ? <PartyProfilePage partyId={pageParam} /> : <PartiesPage />;
      case 'products': return <ProductsPage />;
      case 'sales': return <SalesPage />;
      case 'invoice-history': return <InvoiceHistoryPage />;
      case 'payments': return <PaymentsPage />;
      case 'stock': return <StockPage />;
      case 'purchases': return <PurchasesPage />;
      case 'suppliers': return <PurchasesPage />;
      case 'returns': return <ReturnsPage />;
      case 'expenses': return <ExpensesPage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
