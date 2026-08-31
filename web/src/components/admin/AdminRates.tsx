'use client';

import { useCallback, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { addDays, formatMoney, formatShort, today } from '@/lib/dates';
import { useLoader } from '@/lib/useLoader';
import type { AdminRate } from '@/lib/types';
import { handleError, type PanelProps } from './shared';

type Draft = {
  id: number | null;
  name: string;
  start: string;
  end: string;
  nightlyRate: string;
  minNights: string;
  priority: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  start: today(),
  end: addDays(today(), 6),
  nightlyRate: '',
  minNights: '',
  priority: '0',
});

/**
 * Seasonal pricing. Each rule covers a date range; where two overlap, the
 * higher priority wins, which is how a Christmas rate sits inside a winter one.
 */
export function AdminRates({ onExpired }: PanelProps) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(() => {
    setError(null);
    return adminRequest<AdminRate[]>('/rates');
  }, []);

  const onError = useCallback(
    (err: unknown) => setError(handleError(err, onExpired)),
    [onExpired],
  );

  const { data, reload } = useLoader(fetcher, onError);
  const rates = data ?? [];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      start: draft.start,
      end: draft.end,
      nightlyRate: Number(draft.nightlyRate),
      minNights: draft.minNights ? Number(draft.minNights) : null,
      priority: Number(draft.priority || 0),
    };
    try {
      await adminRequest(draft.id ? `/rates/${draft.id}` : '/rates', {
        method: draft.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setDraft(emptyDraft());
      await reload();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await adminRequest(`/rates/${id}`, { method: 'DELETE' });
      if (draft.id === id) setDraft(emptyDraft());
      await reload();
    } catch (err) {
      onError(err);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="card overflow-hidden">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="font-display text-xl">Seasonal rates</h2>
          <p className="mt-1 text-sm text-stone-500">
            Nights not covered by a rule are charged at the standard rate set under Details.
          </p>
        </div>
        {rates.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-stone-500">
            No seasons yet — every night uses the standard rate.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Season</th>
                <th scope="col" className="px-6 py-3 font-medium">Dates</th>
                <th scope="col" className="px-6 py-3 font-medium">Min</th>
                <th scope="col" className="px-6 py-3 font-medium">Priority</th>
                <th scope="col" className="px-6 py-3 text-right font-medium">Rate</th>
                <th scope="col" className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rates.map((rate) => (
                <tr key={rate.id} className={draft.id === rate.id ? 'bg-stone-50' : ''}>
                  <td className="px-6 py-3.5 text-ink">{rate.name}</td>
                  <td className="px-6 py-3.5 text-stone-600">
                    {formatShort(rate.start_night)} &ndash; {formatShort(rate.end_night)}
                  </td>
                  <td className="px-6 py-3.5 text-stone-600">{rate.min_nights ?? '—'}</td>
                  <td className="px-6 py-3.5 text-stone-600">{rate.priority}</td>
                  <td className="px-6 py-3.5 text-right font-medium">
                    {formatMoney(rate.nightly_rate)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-right">
                    <button
                      type="button"
                      className="text-xs text-stone-500 underline hover:text-ink"
                      onClick={() =>
                        setDraft({
                          id: rate.id,
                          name: rate.name,
                          start: rate.start_night,
                          end: rate.end_night,
                          nightlyRate: String(rate.nightly_rate),
                          minNights: rate.min_nights ? String(rate.min_nights) : '',
                          priority: String(rate.priority),
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-xs text-stone-500 underline hover:text-red-700"
                      onClick={() => remove(rate.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form onSubmit={save} className="card h-fit p-6">
        <h3 className="font-display text-lg">{draft.id ? 'Edit season' : 'Add a season'}</h3>

        <label className="field-label mt-5" htmlFor="rate-name">Name</label>
        <input
          id="rate-name"
          className="field"
          required
          placeholder="Summer, Christmas…"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="rate-start">First night</label>
            <input
              id="rate-start"
              type="date"
              className="field"
              required
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="rate-end">Last night</label>
            <input
              id="rate-end"
              type="date"
              className="field"
              required
              min={draft.start}
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </div>
        </div>

        <label className="field-label mt-4" htmlFor="rate-amount">Rate per night</label>
        <input
          id="rate-amount"
          type="number"
          min="0"
          step="1"
          className="field"
          required
          value={draft.nightlyRate}
          onChange={(e) => setDraft({ ...draft, nightlyRate: e.target.value })}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="rate-min">Minimum nights</label>
            <input
              id="rate-min"
              type="number"
              min="1"
              className="field"
              placeholder="default"
              value={draft.minNights}
              onChange={(e) => setDraft({ ...draft, minNights: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="rate-priority">Priority</label>
            <input
              id="rate-priority"
              type="number"
              min="0"
              className="field"
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Where seasons overlap, the higher priority wins.
        </p>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <button type="submit" className="btn-primary mt-5 w-full" disabled={busy}>
          {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Add season'}
        </button>
        {draft.id && (
          <button
            type="button"
            className="btn-secondary mt-2 w-full"
            onClick={() => setDraft(emptyDraft())}
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
