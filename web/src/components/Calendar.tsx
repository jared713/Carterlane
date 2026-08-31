'use client';

import { useMemo } from 'react';
import {
  addDays,
  addMonths,
  monthGrid,
  monthLabel,
  nightsBetween,
  startOfMonth,
  today,
} from '@/lib/dates';
import type { RateWindow } from '@/lib/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  month: string;
  monthsShown?: number;
  unavailable: Set<string>;
  checkIn: string | null;
  checkOut: string | null;
  baseRate: number;
  rates: RateWindow[];
  currency: string;
  minDate?: string;
  maxDate?: string;
  showPrices?: boolean;
  /** Admin mode: taken nights are still selectable, so they can be re-opened. */
  allowUnavailable?: boolean;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
};

function rateFor(night: string, rates: RateWindow[], baseRate: number): number {
  const rule = rates.find((r) => r.start <= night && r.end >= night);
  return rule ? rule.nightlyRate : baseRate;
}

export function Calendar({
  month,
  monthsShown = 2,
  unavailable,
  checkIn,
  checkOut,
  baseRate,
  rates,
  currency,
  minDate = today(),
  maxDate,
  showPrices = true,
  allowUnavailable = false,
  onMonthChange,
  onSelect,
}: Props) {
  const months = useMemo(
    () => Array.from({ length: monthsShown }, (_, i) => addMonths(month, i)),
    [month, monthsShown],
  );

  // A selection is invalid if any night inside it is already taken; grey those
  // out while the guest is picking a check-out date.
  const blockedAfterCheckIn = useMemo(() => {
    if (allowUnavailable || !checkIn || checkOut) return null;
    let limit: string | null = null;
    for (let night = checkIn; ; night = addDays(night, 1)) {
      if (night !== checkIn && unavailable.has(night)) {
        limit = night;
        break;
      }
      if (night > addDays(checkIn, 400)) break;
    }
    return limit;
  }, [allowUnavailable, checkIn, checkOut, unavailable]);

  const selectedNights = useMemo(
    () => new Set(checkIn && checkOut ? nightsBetween(checkIn, checkOut) : []),
    [checkIn, checkOut],
  );

  const sortedRates = useMemo(
    () => [...rates].sort((a, b) => b.priority - a.priority),
    [rates],
  );

  const priorMonthAllowed = addMonths(month, -1) >= startOfMonth(minDate);
  const nextMonthAllowed = !maxDate || addMonths(month, monthsShown) <= maxDate;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary !px-3.5 !py-2"
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={!priorMonthAllowed}
          aria-label="Previous month"
        >
          <span aria-hidden>&larr;</span>
        </button>
        <p className="font-display text-lg" aria-live="polite">
          {monthLabel(month)}
          {monthsShown > 1 && (
            <span className="hidden sm:inline">
              {' '}
              &ndash; {monthLabel(addMonths(month, monthsShown - 1))}
            </span>
          )}
        </p>
        <button
          type="button"
          className="btn-secondary !px-3.5 !py-2"
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={!nextMonthAllowed}
          aria-label="Next month"
        >
          <span aria-hidden>&rarr;</span>
        </button>
      </div>

      <div className={monthsShown > 1 ? 'grid gap-8 sm:grid-cols-2' : ''}>
        {months.map((current, index) => (
          <div key={current} className={index > 0 ? 'hidden sm:block' : ''}>
            <p className="mb-2 text-center font-display text-sm text-stone-600 sm:hidden">
              {monthLabel(current)}
            </p>
            <p className="mb-3 hidden text-center font-display text-sm text-stone-600 sm:block">
              {monthLabel(current)}
            </p>
            <div className="grid grid-cols-7 gap-px text-center">
              {WEEKDAYS.map((day) => (
                <div key={day} className="pb-2 text-[0.65rem] uppercase tracking-wider text-stone-400">
                  {day.slice(0, 1)}
                  <span className="sr-only">{day}</span>
                </div>
              ))}

              {monthGrid(current).map(({ date, inMonth }) => {
                const isPast = date < minDate;
                const beyond = maxDate ? date > maxDate : false;
                const taken = unavailable.has(date);
                const pastLimit = blockedAfterCheckIn ? date > blockedAfterCheckIn : false;
                // The check-out day itself is never a night, so a taken night
                // may still be a legal check-out.
                const selectableAsCheckOut =
                  Boolean(checkIn) && !checkOut && date > checkIn! &&
                  (!blockedAfterCheckIn || date <= blockedAfterCheckIn);

                const disabled =
                  !inMonth || isPast || beyond ||
                  (!allowUnavailable &&
                    ((selectableAsCheckOut ? pastLimit : taken) ||
                      (Boolean(checkIn) && !checkOut && date <= checkIn!)));

                const isCheckIn = date === checkIn;
                const isCheckOut = date === checkOut;
                const inRange = selectedNights.has(date) || isCheckOut;
                const nightly = rateFor(date, sortedRates, baseRate);

                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(date)}
                    aria-label={`${date}${taken ? ' — unavailable' : ''}`}
                    aria-pressed={isCheckIn || isCheckOut}
                    className={[
                      'relative flex h-11 flex-col items-center justify-center rounded-md text-sm transition sm:h-12',
                      !inMonth && 'invisible',
                      disabled && inMonth && 'cursor-not-allowed text-stone-300',
                      taken && inMonth && !disabled && 'text-stone-300',
                      !disabled && !inRange && 'text-ink hover:bg-stone-100',
                      inRange && !isCheckIn && !isCheckOut && 'bg-stone-200/70 text-ink',
                      (isCheckIn || isCheckOut) && 'bg-ink text-stone-50 hover:bg-ink',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="leading-none">{Number(date.slice(8, 10))}</span>
                    {showPrices && !disabled && !isCheckIn && !isCheckOut && (
                      <span className="mt-0.5 text-[0.6rem] leading-none text-stone-400">
                        {currency === 'GBP' ? '£' : ''}
                        {Math.round(nightly)}
                      </span>
                    )}
                    {taken && inMonth && (
                      <span
                        aria-hidden
                        className="absolute inset-x-2.5 top-1/2 h-px -translate-y-1/2 rotate-[-14deg] bg-stone-300"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
