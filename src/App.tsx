import React, { useEffect, lazy, Suspense, useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { seedDefaultMetadata } from '@/services/settingsService';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { AuthPage } from '@/components/auth/AuthPage';
import { ServiceStatusPage } from '@/components/auth/ServiceStatusPage';
import { getSession, onAuthStateChange, signOut } from '@/services/authService';
import { syncLocalData } from '@/services/cloudSyncService';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';

function syncErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const detail = error as { message?: string; details?: string; hint?: string; code?: string };
    return [detail.message, detail.details, detail.hint, detail.code ? `code ${detail.code}` : ''].filter(Boolean).join(' | ');
  }
  return error instanceof Error ? error.message : 'Cloud sync failed';
}

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

class ChunkLoadBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(error: Error) {
    if (error.message.includes('dynamically imported module')) return { failed: true };
    throw error;
  }

  componentDidCatch() {
    if (!sessionStorage.getItem('yash-chunk-reload')) {
      sessionStorage.setItem('yash-chunk-reload', '1');
      window.location.reload();
    }
  }

  render() {
    return this.state.failed ? <PageLoader /> : this.props.children;
  }
}

function App() {
  const { currentPage, pageParam, setOnline } = useUIStore();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

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
      if (currentSession) {
        try {
          await signOut();
        } catch (error) {
          toast.error(`Unable to clear the existing session: ${syncErrorMessage(error)}`);
        }
      }
      setSession(null);
      setAuthReady(true);
      await seedDefaultMetadata();
    })();

    const authSubscription = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void syncLocalData(nextSession).catch((error) => {
          toast.error(`Cloud sync failed: ${syncErrorMessage(error)}`);
        });
      }
    });

    const handleSync = () => {
      if (sessionRef.current) {
        void syncLocalData(sessionRef.current).catch((error) => {
          toast.error(`Cloud sync failed: ${syncErrorMessage(error)}`);
        });
      }
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
  }, [setOnline]);

  if (!authReady) return <PageLoader />;
  if (isSupabaseConfigured && !session) return <AuthPage />;
  if (session?.user.app_metadata?.service_status === 'suspended') {
    return <ServiceStatusPage email={session.user.email} />;
  }

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
          <ChunkLoadBoundary>
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </ChunkLoadBoundary>
        </main>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
