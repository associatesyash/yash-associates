import { FormEvent, useState } from 'react';
import { signIn, signUp } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Cloud, LockKeyhole, Loader2 } from 'lucide-react';

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error('Enter a valid email and a password of at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        toast.success('Welcome back');
      } else {
        const signedIn = await signUp(email.trim(), password);
        toast.success(signedIn ? 'Account created' : 'Check your email to confirm your account');
        if (!signedIn) setMode('signin');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to authenticate');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-7 shadow-lg animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">YA</div>
          <div>
            <h1 className="text-xl font-bold">YASH ASSOCIATES</h1>
            <p className="text-sm text-muted-foreground">Wholesale ERP</p>
          </div>
        </div>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</h2>
          <p className="text-sm text-muted-foreground mt-1">Your business data stays private and syncs securely.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="grid gap-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
        </form>
        <button className="mt-5 w-full text-sm text-primary hover:underline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
        <div className="mt-6 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"><Cloud className="h-4 w-4" /> Offline records sync when you reconnect.</div>
      </section>
    </main>
  );
}
