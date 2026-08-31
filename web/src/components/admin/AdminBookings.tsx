'use client';

import { useCallback, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { formatMoney, formatShort } from '@/lib/dates';
import { useLoader } from '@/lib/useLoader';
import type { AdminBooking } from '@/lib/types';
import { handleError, type PanelProps } from './shared';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Awaiting reply' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_STYLES: Record<AdminBooking['status'], string> = {
  pending: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-stone-200 text-stone-600',
};

export function AdminBookings({ onExpired }: PanelProps) {
  const [filter, setFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetcher = useCallback(() => {
    setError(null);
    const query = filter ? `?status=${filter}` : '';
    return adminRequest<AdminBooking[]>(`/bookings${query}`);
  }, [filter]);

  const onError = useCallback(
    (err: unknown) => setError(handleError(err, onExpired)),
    [onExpired],
  );

  const { data, reload } = useLoader(fetcher, onError);
  const bookings = data ?? [];

  async function setStatus(booking: AdminBooking, status: AdminBooking['status']) {
    setBusyId(booking.id);
    setError(null);
    try {
      await adminRequest(`/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notify }),
      });
      await reload();
    } catch (err) {
      onError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={[
                'rounded-full px-4 py-1.5 text-sm transition',
                filter === option.id
                  ? 'bg-ink text-stone-50'
                  : 'border border-stone-300 text-stone-600 hover:border-stone-500',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Email the guest when I confirm or cancel
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {bookings.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-sm text-stone-500">No bookings here yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-lg">
                      {formatShort(booking.check_in)} &ndash; {formatShort(booking.check_out)}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider ${STATUS_STYLES[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-stone-600">
                    {booking.guest_name} · {booking.guests}{' '}
                    {booking.guests === 1 ? 'guest' : 'guests'} · {booking.nights} nights ·{' '}
                    <span className="text-stone-400">{booking.reference}</span>
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    <a className="hover:text-ink" href={`mailto:${booking.guest_email}`}>
                      {booking.guest_email}
                    </a>
                    {booking.guest_phone && ` · ${booking.guest_phone}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl">
                    {formatMoney(booking.total, booking.currency)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatMoney(booking.accommodation, booking.currency)} +{' '}
                    {formatMoney(booking.cleaning_fee, booking.currency)} cleaning
                  </p>
                </div>
              </div>

              {booking.message && (
                <p className="mt-4 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  {expanded === booking.id || booking.message.length < 180
                    ? booking.message
                    : `${booking.message.slice(0, 180)}… `}
                  {booking.message.length >= 180 && (
                    <button
                      type="button"
                      className="ml-1 underline"
                      onClick={() =>
                        setExpanded(expanded === booking.id ? null : booking.id)
                      }
                    >
                      {expanded === booking.id ? 'less' : 'more'}
                    </button>
                  )}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                {booking.status !== 'confirmed' && (
                  <button
                    type="button"
                    className="btn-primary !px-4 !py-2 text-xs"
                    disabled={busyId === booking.id}
                    onClick={() => setStatus(booking, 'confirmed')}
                  >
                    Confirm
                  </button>
                )}
                {booking.status !== 'cancelled' && (
                  <button
                    type="button"
                    className="btn-secondary !px-4 !py-2 text-xs"
                    disabled={busyId === booking.id}
                    onClick={() => setStatus(booking, 'cancelled')}
                  >
                    Cancel &amp; release dates
                  </button>
                )}
                {booking.status === 'cancelled' && (
                  <button
                    type="button"
                    className="btn-secondary !px-4 !py-2 text-xs"
                    disabled={busyId === booking.id}
                    onClick={() => setStatus(booking, 'pending')}
                  >
                    Re-open as a request
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
