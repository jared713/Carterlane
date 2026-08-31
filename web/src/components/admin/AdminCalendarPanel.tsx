'use client';

import { useCallback, useMemo, useState } from 'react';
import { Calendar } from '@/components/Calendar';
import { adminRequest } from '@/lib/api';
import { addDays, formatShort, startOfMonth, today } from '@/lib/dates';
import { useLoader } from '@/lib/useLoader';
import type { AdminCalendar } from '@/lib/types';
import { handleError, type PanelProps } from './shared';

/**
 * Click a start date and an end date, then mark that stretch as unavailable or
 * put it back on sale. Nights held by a live booking are left alone — those are
 * released by cancelling the booking itself.
 */
export function AdminCalendarPanel({ onExpired }: PanelProps) {
  const [month, setMonth] = useState(() => startOfMonth(today()));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const from = today();
  const to = addDays(from, 730);

  const fetcher = useCallback(
    () => adminRequest<AdminCalendar>(`/calendar?from=${from}&to=${to}`),
    [from, to],
  );

  const onError = useCallback(
    (err: unknown) => setStatus({ kind: 'error', text: handleError(err, onExpired) }),
    [onExpired],
  );

  const { data, reload } = useLoader(fetcher, onError);

  const unavailable = useMemo(
    () => new Set((data?.nights ?? []).map((night) => night.night)),
    [data],
  );
  const bookedNights = useMemo(
    () =>
      new Set(
        (data?.nights ?? []).filter((n) => n.reason === 'booked').map((n) => n.night),
      ),
    [data],
  );

  function select(date: string) {
    setStatus(null);
    if (!start || (start && end)) {
      setStart(date);
      setEnd(null);
      return;
    }
    if (date < start) {
      setStart(date);
      return;
    }
    setEnd(date);
  }

  const rangeStart = start;
  // A single click selects one night; the Calendar treats `end` as exclusive,
  // so an inclusive range needs the day after.
  const rangeEnd = end ?? start;

  async function apply(action: 'block' | 'open') {
    if (!rangeStart || !rangeEnd) return;
    setBusy(true);
    setStatus(null);
    try {
      if (action === 'block') {
        await adminRequest('/blocks', {
          method: 'POST',
          body: JSON.stringify({
            start: rangeStart,
            end: rangeEnd,
            reason: reason.trim() || 'Unavailable',
          }),
        });
        setStatus({
          kind: 'ok',
          text: `Closed ${formatShort(rangeStart)} to ${formatShort(rangeEnd)}.`,
        });
      } else {
        const result = await adminRequest<{ stillBooked: string[] }>('/blocks/open', {
          method: 'POST',
          body: JSON.stringify({ start: rangeStart, end: rangeEnd }),
        });
        setStatus({
          kind: 'ok',
          text: result.stillBooked.length
            ? `Re-opened, but ${result.stillBooked.length} night(s) are still held by a booking.`
            : `Opened ${formatShort(rangeStart)} to ${formatShort(rangeEnd)}.`,
        });
      }
      setStart(null);
      setEnd(null);
      setReason('');
      await reload();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const selectionHasBooking = useMemo(() => {
    if (!rangeStart || !rangeEnd) return false;
    for (let night = rangeStart; night <= rangeEnd; night = addDays(night, 1)) {
      if (bookedNights.has(night)) return true;
    }
    return false;
  }, [rangeStart, rangeEnd, bookedNights]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="card p-6 sm:p-8">
        <h2 className="font-display text-xl">Availability</h2>
        <p className="mt-1.5 text-sm text-stone-500">
          Click a first night, then a last night. Crossed-out nights are already closed or
          booked.
        </p>
        <div className="mt-6">
          {data ? (
            <Calendar
              month={month}
              monthsShown={2}
              unavailable={unavailable}
              checkIn={rangeStart}
              checkOut={rangeEnd ? addDays(rangeEnd, 1) : null}
              baseRate={0}
              rates={[]}
              currency=""
              minDate={from}
              maxDate={to}
              showPrices={false}
              allowUnavailable
              onMonthChange={setMonth}
              onSelect={select}
            />
          ) : (
            <div className="h-72 animate-pulse rounded-lg bg-stone-100" aria-hidden />
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stone-200 pt-5 text-xs text-stone-500">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-ink" aria-hidden /> Selected
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-stone-300" aria-hidden /> Closed or booked
          </span>
          <span>
            {unavailable.size} night{unavailable.size === 1 ? '' : 's'} unavailable in the
            next two years
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h3 className="font-display text-lg">Selected nights</h3>
          <p className="mt-2 text-sm text-stone-600">
            {rangeStart
              ? `${formatShort(rangeStart)} → ${formatShort(rangeEnd!)}`
              : 'Nothing selected yet.'}
          </p>

          <label className="field-label mt-5" htmlFor="reason">
            Note (shown only to you)
          </label>
          <input
            id="reason"
            className="field"
            placeholder="Owner stay, maintenance…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />

          {selectionHasBooking && (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              These nights include a live booking. Cancel it under Bookings first.
            </p>
          )}

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!rangeStart || busy || selectionHasBooking}
              onClick={() => apply('block')}
            >
              Mark as booked / closed
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!rangeStart || busy}
              onClick={() => apply('open')}
            >
              Open for booking
            </button>
            {rangeStart && (
              <button
                type="button"
                className="text-xs text-stone-500 underline hover:text-ink"
                onClick={() => {
                  setStart(null);
                  setEnd(null);
                }}
              >
                Clear selection
              </button>
            )}
          </div>

          {status && (
            <p
              className={[
                'mt-4 rounded-lg px-3.5 py-2.5 text-xs',
                status.kind === 'ok'
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border border-red-300 bg-red-50 text-red-800',
              ].join(' ')}
            >
              {status.text}
            </p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-display text-lg">Closed periods</h3>
          {data?.blocks.length ? (
            <ul className="mt-4 space-y-3 text-sm">
              {data.blocks.map((block) => (
                <li key={block.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="text-ink">
                      {formatShort(block.start_night)} &ndash; {formatShort(block.end_night)}
                    </span>
                    <span className="block text-xs text-stone-500">{block.reason}</span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-stone-500 underline hover:text-red-700"
                    onClick={async () => {
                      try {
                        await adminRequest(`/blocks/${block.id}`, { method: 'DELETE' });
                        await reload();
                      } catch (err) {
                        onError(err);
                      }
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Nothing closed at the moment.</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-display text-lg">Upcoming stays</h3>
          {data?.bookings.length ? (
            <ul className="mt-4 space-y-3 text-sm">
              {data.bookings.slice(0, 8).map((booking) => (
                <li key={booking.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="text-ink">
                      {formatShort(booking.check_in)} &ndash; {formatShort(booking.check_out)}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {booking.guest_name} · {booking.reference}
                    </span>
                  </span>
                  <span
                    className={[
                      'rounded-full px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider',
                      booking.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800',
                    ].join(' ')}
                  >
                    {booking.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No bookings in the calendar yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
