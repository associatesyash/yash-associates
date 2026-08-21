import { create } from 'zustand';

export type PageKey =
  | 'dashboard'
  | 'parties'
  | 'party-profile'
  | 'products'
  | 'sales'
  | 'invoice-history'
  | 'payments'
  | 'stock'
  | 'purchases'
  | 'suppliers'
  | 'returns'
  | 'expenses'
  | 'reports'
  | 'settings';

interface UIState {
  currentPage: PageKey;
  pageParam: string | null;
  sidebarOpen: boolean;
  online: boolean;
  setPage: (page: PageKey, param?: string | null) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  setOnline: (online: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentPage: 'dashboard',
  pageParam: null,
  sidebarOpen: false,
  online: navigator.onLine,
  setPage: (page, param = null) => set({ currentPage: page, pageParam: param, sidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),
  setOnline: (online) => set({ online }),
}));
