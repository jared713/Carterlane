'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminLogin, adminRequest, adminToken, ApiError } from '@/lib/api';
import { AdminCalendarPanel } from './AdminCalendarPanel';
import { AdminBookings } from './AdminBookings';
import { AdminRates } from './AdminRates';
import { AdminPhotos } from './AdminPhotos';
import { AdminSettings } from './AdminSettings';
import { AdminInvoices } from './AdminInvoices';

const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'rates', label: 'Rates' },
  { id: 'photos', label: 'Photos' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'settings', label: 'Details' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminApp() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>('calendar');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const stored = adminToken.get();
    const check = stored
      ? adminRequest('/session').then(
          () => true,
          () => {
            adminToken.clear();
            return false;
          },
        )
      : Promise.resolve(false);

    check.then((valid) => {
      if (!active) return;
      setSignedIn(valid);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(() => {
    adminToken.clear();
    setSignedIn(false);
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      setSignedIn(true);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-stone-500">Checking your session…</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <form onSubmit={handleLogin} className="card w-full max-w-sm p-8">
          <p className="eyebrow">Carterlane</p>
          <h1 className="heading-lg mt-3 text-2xl">Owner area</h1>
          <p className="mt-3 text-sm text-stone-500">
            Set dates, prices and photographs, and answer booking requests.
          </p>
          <label className="field-label mt-7" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100/60">
      <header className="border-b border-stone-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <p className="font-display text-lg">Carterlane · owner area</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-stone-500 hover:text-ink">
              View site
            </Link>
            <button type="button" className="btn-secondary !px-4 !py-1.5" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
        <div className="container-page flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                '-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm transition',
                tab === item.id
                  ? 'border-ink font-medium text-ink'
                  : 'border-transparent text-stone-500 hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="container-page py-10">
        {tab === 'calendar' && <AdminCalendarPanel onExpired={signOut} />}
        {tab === 'bookings' && <AdminBookings onExpired={signOut} />}
        {tab === 'rates' && <AdminRates onExpired={signOut} />}
        {tab === 'photos' && <AdminPhotos onExpired={signOut} />}
        {tab === 'invoices' && <AdminInvoices onExpired={signOut} />}
        {tab === 'settings' && <AdminSettings onExpired={signOut} />}
      </main>
    </div>
  );
}
