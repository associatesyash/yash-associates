import { useUIStore } from '@/stores/uiStore';
import { formatDate } from '@/utils/format';
import { Menu, Wifi, WifiOff, Cloud, Database } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Header() {
  const { toggleSidebar, online } = useUIStore();
  const [today, setToday] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setToday(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 bg-card border-b shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-md hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <div className="font-semibold text-sm text-muted-foreground">
            {formatDate(today)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-xs font-medium">
          <Database className="h-3.5 w-3.5 text-success" />
          <span className="hidden sm:inline">Data Saved Locally</span>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
            online ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
