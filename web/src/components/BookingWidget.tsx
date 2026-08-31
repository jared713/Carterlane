'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from './Calendar';
import {
  ApiError,
  createBooking,
  getAvailability,
  getQuote,
} from '@/lib/api';
import {
  addDays,
  formatDate,
  formatMoney,
  formatShort,
  startOfMonth,
  today,
} from '@/lib/dates';
import type { Availability, BookingConfirmation, Property, Quote } from '@/lib/types';

type Props = { property: Property };

const HORIZON_DAYS = 540;

export function BookingWidget({ property }: Props) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(today()));
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [quoteResult, setQuoteResult] = useState<{ key: string; quote: Quote } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  const from = today();
  const to = addDays(from, HORIZON_DAYS);

  const applyAvailability = useCallback((result: Availability) => {
    setAvailability(result);
    setLoadError(null);
  }, []);

  const reportLoadFailure = useCallback(() => {
    setLoadError(
      'We could not load the calendar just now. Please refresh, or email us and we will check the dates by hand.',
    );
  }, []);

  const loadAvailability = useCallback(
    () => getAvailability(from, to).then(applyAvailability, reportLoadFailure),
    [from, to, applyAvailability, reportLoadFailure],
  );

  useEffect(() => {
    let active = true;
    getAvailability(from, to).then(
      (result) => {
        if (active) applyAvailability(result);
      },
      () => {
        if (active) reportLoadFailure();
      },
    );
    return () => {
      active = false;
    };
  }, [from, to, applyAvailability, reportLoadFailure]);

  const unavailable = useMemo(
    () => new Set(availability?.unavailable ?? []),
    [availability],
  );

  // One key per priced stay, so a result that arrives after the guest has
  // changed their mind is ignored rather than shown.
  const quoteKey = checkIn && checkOut ? `${checkIn}|${checkOut}|${guests}` : null;

  useEffect(() => {
    if (!quoteKey || !checkIn || !checkOut) return;
    let active = true;
    getQuote(checkIn, checkOut, guests).then(
      (result) => {
        if (active) setQuoteResult({ key: quoteKey, quote: result });
      },
      () => {
        if (active) setQuoteResult(null);
      },
    );
    return () => {
      active = false;
    };
  }, [quoteKey, checkIn, checkOut, guests]);

  const quote = quoteResult?.key === quoteKey ? quoteResult.quote : null;
  const quoteLoading = Boolean(quoteKey) && !quote;

  useEffect(() => {
    if (confirmation) confirmationRef.current?.scrollIntoView({ block: 'center' });
  }, [confirmation]);

  function handleSelect(date: string) {
    setSubmitError(null);
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date);
      setCheckOut(null);
      return;
    }
    if (date <= checkIn) {
      setCheckIn(date);
      return;
    }
    setCheckOut(date);
  }

  function clearDates() {
    setCheckIn(null);
    setCheckOut(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!checkIn || !checkOut) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createBooking({
        checkIn,
        checkOut,
        guests,
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        website: form.website,
      });
      setConfirmation(result);
      clearDates();
      loadAvailability();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.details?.length
            ? `${err.message} (${err.details.map((d) => d.field).join(', ')})`
            : err.message
          : 'Something went wrong. Please try again.';
      setSubmitError(message);
      if (err instanceof ApiError && err.status === 409) loadAvailability();
    } finally {
      setSubmitting(false);
    }
  }

  const blockingErrors = (quote?.errors ?? []).filter(Boolean);
  const canSubmit =
    Boolean(checkIn && checkOut && quote?.available) &&
    blockingErrors.length === 0 &&
    form.name.trim().length > 1 &&
    /.+@.+\..+/.test(form.email) &&
    !submitting;

  if (confirmation) {
    return (
      <div ref={confirmationRef} className="card p-8 sm:p-10">
        <p className="eyebrow">Request received</p>
        <h3 className="heading-lg mt-3">Thank you — we have your dates.</h3>
        <p className="prose-body mt-4">
          Your reference is{' '}
          <strong className="font-medium text-ink">{confirmation.reference}</strong>. We
          have held{' '}
          <strong className="font-medium text-ink">
            {formatShort(confirmation.checkIn)} &ndash; {formatShort(confirmation.checkOut)}
          </strong>{' '}
          ({confirmation.nights} {confirmation.nights === 1 ? 'night' : 'nights'}) and sent a
          copy to your inbox. We will confirm by email shortly, with payment details — nothing
          is taken online.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-200 pt-6 text-sm">
          <div>
            <dt className="text-stone-500">Guests</dt>
            <dd className="mt-1 text-ink">{confirmation.guests}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Total</dt>
            <dd className="mt-1 text-ink">
              {formatMoney(confirmation.total, confirmation.currency)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="btn-secondary mt-8"
          onClick={() => {
            setConfirmation(null);
            setForm({ name: '', email: '', phone: '', message: '', website: '' });
          }}
        >
          Book another stay
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-stone-200 bg-stone-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-2xl">
            {formatMoney(property.fromRate, property.currency)}
            <span className="ml-1.5 text-sm text-stone-500">a night</span>
          </p>
          <p className="text-sm text-stone-500">
            {property.minNights}-night minimum · sleeps {property.maxGuests}
          </p>
        </div>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {loadError && (
          <p className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {loadError}
          </p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-300 px-3.5 py-2.5">
            <p className="field-label mb-0.5">Check in</p>
            <p className={checkIn ? 'text-[0.95rem] text-ink' : 'text-[0.95rem] text-stone-400'}>
              {checkIn ? formatShort(checkIn) : 'Add a date'}
            </p>
          </div>
          <div className="rounded-lg border border-stone-300 px-3.5 py-2.5">
            <p className="field-label mb-0.5">Check out</p>
            <p className={checkOut ? 'text-[0.95rem] text-ink' : 'text-[0.95rem] text-stone-400'}>
              {checkOut ? formatShort(checkOut) : 'Add a date'}
            </p>
          </div>
        </div>

        {availability ? (
          <Calendar
            month={month}
            unavailable={unavailable}
            checkIn={checkIn}
            checkOut={checkOut}
            baseRate={availability.baseRate}
            rates={availability.rates}
            currency={availability.currency}
            minDate={from}
            maxDate={to}
            onMonthChange={setMonth}
            onSelect={handleSelect}
          />
        ) : (
          <div className="h-72 animate-pulse rounded-lg bg-stone-100" aria-hidden />
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
          <p>
            {checkIn && !checkOut
              ? 'Now choose your check-out date.'
              : 'Prices shown are per night.'}
          </p>
          {(checkIn || checkOut) && (
            <button type="button" className="underline hover:text-ink" onClick={clearDates}>
              Clear dates
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-stone-200 pt-6">
          <label className="field-label" htmlFor="guests">
            Guests
          </label>
          <select
            id="guests"
            className="field"
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value))}
          >
            {Array.from({ length: property.maxGuests }, (_, i) => i + 1).map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </div>

        {quote && (
          <div className="mt-6 border-t border-stone-200 pt-6">
            {blockingErrors.length > 0 && (
              <ul className="mb-4 space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {blockingErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between text-stone-600">
                <dt>
                  {formatMoney(quote.averageNightly, quote.currency)} &times; {quote.nights}{' '}
                  {quote.nights === 1 ? 'night' : 'nights'}
                </dt>
                <dd className="text-ink">{formatMoney(quote.accommodation, quote.currency)}</dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>Cleaning</dt>
                <dd className="text-ink">{formatMoney(quote.cleaningFee, quote.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-3 text-base">
                <dt className="font-medium">Total</dt>
                <dd className="font-medium">{formatMoney(quote.total, quote.currency)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-stone-500">
              {formatDate(quote.checkIn)} &rarr; {formatDate(quote.checkOut)} · arrive from{' '}
              {property.checkInTime}, leave by {property.checkOutTime}.
            </p>
          </div>
        )}

        <form className="mt-6 space-y-4 border-t border-stone-200 pt-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="field"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="field"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="phone">
              Phone <span className="normal-case tracking-normal text-stone-400">(optional)</span>
            </label>
            <input
              id="phone"
              className="field"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="message">
              Anything we should know?
            </label>
            <textarea
              id="message"
              rows={3}
              className="field resize-none"
              placeholder="Arrival time, occasion, questions…"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>

          {/* Honeypot — hidden from people, irresistible to bots. */}
          <div className="hidden" aria-hidden>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          {submitError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {submitError}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
            {submitting
              ? 'Sending…'
              : quoteLoading
                ? 'Pricing…'
                : checkIn && checkOut
                  ? 'Request these dates'
                  : 'Choose your dates'}
          </button>
          <p className="text-center text-xs text-stone-500">
            No payment is taken online. We confirm by email, usually within a day.
          </p>
        </form>
      </div>
    </div>
  );
}
