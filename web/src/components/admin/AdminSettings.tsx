'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { handleError, type PanelProps } from './shared';

type PropertyRow = {
  name: string;
  tagline: string;
  description: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  base_rate: number;
  base_rate_label: string;
  base_rate_note: string;
  cleaning_fee: number;
  min_nights: number;
  max_nights: number;
  currency: string;
  check_in_time: string;
  check_out_time: string;
  amenities: string[];
  contact_email: string;
  contact_phone: string;
};

/** The standing details and standard rate that the public site reads. */
export function AdminSettings({ onExpired }: PanelProps) {
  const [row, setRow] = useState<PropertyRow | null>(null);
  const [amenityText, setAmenityText] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((data: PropertyRow) => {
    setRow(data);
    setAmenityText((data.amenities ?? []).join('\n'));
  }, []);

  const onError = useCallback(
    (err: unknown) => setStatus({ kind: 'error', text: handleError(err, onExpired) }),
    [onExpired],
  );

  const reload = useCallback(
    () => adminRequest<PropertyRow>('/property').then(apply, onError),
    [apply, onError],
  );

  useEffect(() => {
    let active = true;
    adminRequest<PropertyRow>('/property').then(
      (data) => {
        if (active) apply(data);
      },
      (err) => {
        if (active) onError(err);
      },
    );
    return () => {
      active = false;
    };
  }, [apply, onError]);

  if (!row) {
    return <div className="h-64 animate-pulse rounded-2xl bg-stone-200/60" aria-hidden />;
  }

  function update<K extends keyof PropertyRow>(key: K, value: PropertyRow[K]) {
    setRow((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!row) return;
    setBusy(true);
    setStatus(null);
    try {
      await adminRequest('/property', {
        method: 'PUT',
        body: JSON.stringify({
          name: row.name,
          tagline: row.tagline,
          description: row.description,
          address: row.address,
          bedrooms: Number(row.bedrooms),
          bathrooms: Number(row.bathrooms),
          maxGuests: Number(row.max_guests),
          baseRate: Number(row.base_rate),
          baseRateLabel: row.base_rate_label,
          baseRateNote: row.base_rate_note,
          cleaningFee: Number(row.cleaning_fee),
          minNights: Number(row.min_nights),
          maxNights: Number(row.max_nights),
          currency: row.currency,
          checkInTime: row.check_in_time,
          checkOutTime: row.check_out_time,
          amenities: amenityText.split('\n').map((line) => line.trim()).filter(Boolean),
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone,
        }),
      });
      setStatus({ kind: 'ok', text: 'Saved. The site updates within a minute.' });
      await reload();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const numberField = (
    label: string,
    key: keyof PropertyRow,
    props: Record<string, unknown> = {},
  ) => (
    <div>
      <label className="field-label" htmlFor={String(key)}>
        {label}
      </label>
      <input
        id={String(key)}
        type="number"
        className="field"
        value={String(row[key] ?? '')}
        onChange={(event) => update(key, Number(event.target.value) as never)}
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={save} className="grid gap-8 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="font-display text-xl">The flat</h2>

        <label className="field-label mt-5" htmlFor="p-name">Name</label>
        <input
          id="p-name"
          className="field"
          value={row.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />

        <label className="field-label mt-4" htmlFor="p-tagline">Headline</label>
        <input
          id="p-tagline"
          className="field"
          value={row.tagline}
          onChange={(e) => update('tagline', e.target.value)}
        />

        <label className="field-label mt-4" htmlFor="p-description">Description</label>
        <textarea
          id="p-description"
          rows={6}
          className="field"
          value={row.description}
          onChange={(e) => update('description', e.target.value)}
        />

        <label className="field-label mt-4" htmlFor="p-address">Address shown on the site</label>
        <input
          id="p-address"
          className="field"
          value={row.address}
          onChange={(e) => update('address', e.target.value)}
        />

        <label className="field-label mt-4" htmlFor="p-amenities">
          What is here — one per line
        </label>
        <textarea
          id="p-amenities"
          rows={7}
          className="field"
          value={amenityText}
          onChange={(e) => setAmenityText(e.target.value)}
        />
      </div>

      <div className="space-y-8">
        <div className="card p-6">
          <h2 className="font-display text-xl">Charges &amp; stay length</h2>
          <p className="mt-1 text-sm text-stone-500">
            Nightly rates live under Rates; these apply to every stay.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {numberField('Cleaning charge', 'cleaning_fee', { min: 0, step: 1 })}
            {numberField('Maximum nights', 'max_nights', { min: 1, max: 365 })}
            <div>
              <label className="field-label" htmlFor="p-currency">Currency</label>
              <select
                id="p-currency"
                className="field"
                value={row.currency}
                onChange={(e) => update('currency', e.target.value)}
              >
                <option value="GBP">GBP £</option>
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-xl">Capacity &amp; times</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {numberField('Sleeps', 'max_guests', { min: 1, max: 20 })}
            {numberField('Bedrooms', 'bedrooms', { min: 0, max: 20 })}
            {numberField('Bathrooms', 'bathrooms', { min: 0, max: 20 })}
            <div>
              <label className="field-label" htmlFor="p-checkin">Check-in from</label>
              <input
                id="p-checkin"
                type="time"
                className="field"
                value={row.check_in_time}
                onChange={(e) => update('check_in_time', e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="p-checkout">Check-out by</label>
              <input
                id="p-checkout"
                type="time"
                className="field"
                value={row.check_out_time}
                onChange={(e) => update('check_out_time', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-xl">Contact</h2>
          <label className="field-label mt-5" htmlFor="p-email">Email shown to guests</label>
          <input
            id="p-email"
            type="email"
            className="field"
            value={row.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
          />
          <label className="field-label mt-4" htmlFor="p-phone">Telephone</label>
          <input
            id="p-phone"
            className="field"
            value={row.contact_phone}
            onChange={(e) => update('contact_phone', e.target.value)}
          />
        </div>

        {status && (
          <p
            className={[
              'rounded-lg px-4 py-3 text-sm',
              status.kind === 'ok'
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border border-red-300 bg-red-50 text-red-800',
            ].join(' ')}
          >
            {status.text}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}
