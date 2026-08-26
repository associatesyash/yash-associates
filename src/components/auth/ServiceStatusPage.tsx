import { CloudOff } from 'lucide-react';

interface ServiceStatusPageProps {
  email?: string;
}

export function ServiceStatusPage({ email }: ServiceStatusPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-7 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CloudOff className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold">Service temporarily unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cloud limit exceeded. Kindly upgrade to use the ERP system.
        </p>
        {email && <p className="mt-5 text-xs text-muted-foreground">Signed in as {email}</p>}
      </section>
    </main>
  );
}
