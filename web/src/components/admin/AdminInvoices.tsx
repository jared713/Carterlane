'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { useLoader } from '@/lib/useLoader';
import { addDays, today } from '@/lib/dates';
import {
  invoiceHtml,
  longDate,
  money,
  type Invoice,
  type InvoiceSettings,
} from '@/lib/invoice';
import { handleError, type PanelProps } from './shared';

/** A4 at 96dpi, and the fraction of it the preview column can show. */
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PREVIEW_SCALE = 0.655;

type Draft = {
  id: number | null;
  number: string;
  issued_on: string;
  due_on: string;
  period: string;
  client_name: string;
  client_address: string;
  description: string;
  detail: string;
  days: string;
  rate: string;
  currency: string;
  paid: boolean;
  paid_on: string;
  paid_method: string;
  notes: string;
};

const blank = (): Draft => ({
  id: null,
  number: '',
  issued_on: today(),
  due_on: addDays(today(), 14),
  period: '',
  client_name: '',
  client_address: '',
  description: 'Accommodation at Carter Lane, London EC4',
  detail: '',
  days: '',
  rate: '100',
  currency: 'GBP',
  paid: false,
  paid_on: today(),
  paid_method: 'Bank transfer',
  notes: '',
});

const toInvoice = (d: Draft): Invoice => ({
  number: d.number,
  issued_on: d.issued_on,
  due_on: d.due_on || null,
  period: d.period,
  client_name: d.client_name || '\u2014',
  client_address: d.client_address,
  description: d.description,
  detail: d.detail,
  days: Number(d.days) || 0,
  rate: Number(d.rate) || 0,
  currency: d.currency,
  paid: d.paid,
  paid_on: d.paid ? d.paid_on || null : null,
  paid_method: d.paid_method,
  notes: d.notes,
});

const fromRow = (row: Invoice & { id: number }): Draft => ({
  id: row.id,
  number: row.number,
  issued_on: row.issued_on,
  due_on: row.due_on ?? '',
  period: row.period,
  client_name: row.client_name,
  client_address: row.client_address,
  description: row.description,
  detail: row.detail,
  days: String(row.days),
  rate: String(row.rate),
  currency: row.currency,
  paid: row.paid,
  paid_on: row.paid_on ?? today(),
  paid_method: row.paid_method,
  notes: row.notes,
});

/**
 * Invoices: edit the details, watch the document update, print it to PDF.
 *
 * The preview is the finished document in an iframe, not an approximation of
 * it, so what the printer produces is exactly what is on screen. Printing goes
 * through that same iframe, which keeps invoice details — a client's address,
 * bank particulars — out of any URL and off any public route.
 */
export function AdminInvoices({ onExpired }: PanelProps) {
  const [draft, setDraft] = useState<Draft>(blank);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const onError = useCallback(
    (err: unknown) => setStatus({ kind: 'error', text: handleError(err, onExpired) }),
    [onExpired],
  );

  const fetchInvoices = useCallback(
    () => adminRequest<(Invoice & { id: number; total: number })[]>('/invoices'),
    [],
  );
  const fetchSettings = useCallback(
    () => adminRequest<InvoiceSettings>('/invoice-settings'),
    [],
  );

  const { data: invoices, reload } = useLoader(fetchInvoices, onError);
  const { data: settings, setData: setSettings } = useLoader(fetchSettings, onError);

  const total = (Number(draft.days) || 0) * (Number(draft.rate) || 0);

  const html = useMemo(
    () => (settings ? invoiceHtml(toInvoice(draft), settings) : ''),
    [draft, settings],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setStatus(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Suggest the next number in whatever series the last invoice used. */
  function suggestNumber() {
    const last = invoices?.[0]?.number ?? '';
    const match = last.match(/^(.*?)(\d+)$/);
    const now = new Date();
    if (!match) {
      return `CL-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    const next = String(Number(match[2]) + 1).padStart(match[2].length, '0');
    return `${match[1]}${next}`;
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const payload = {
        number: draft.number.trim(),
        issuedOn: draft.issued_on,
        dueOn: draft.due_on || null,
        period: draft.period,
        clientName: draft.client_name,
        clientAddress: draft.client_address,
        description: draft.description,
        detail: draft.detail,
        days: Number(draft.days),
        rate: Number(draft.rate),
        currency: draft.currency,
        paid: draft.paid,
        paidOn: draft.paid ? draft.paid_on || null : null,
        paidMethod: draft.paid_method,
        notes: draft.notes,
      };
      const saved = await adminRequest<Invoice & { id: number }>(
        draft.id ? `/invoices/${draft.id}` : '/invoices',
        { method: draft.id ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      );
      setDraft(fromRow(saved));
      setStatus({ kind: 'ok', text: `Invoice ${saved.number} saved.` });
      await reload();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, number: string) {
    if (!window.confirm(`Delete invoice ${number}? This cannot be undone.`)) return;
    try {
      await adminRequest(`/invoices/${id}`, { method: 'DELETE' });
      if (draft.id === id) setDraft(blank());
      await reload();
    } catch (err) {
      onError(err);
    }
  }

  /** Hand the finished document to the browser's own print-to-PDF. */
  function download() {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  const ready = draft.number.trim() && draft.client_name.trim() && Number(draft.days) > 0;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="space-y-6">
        {/* ------------------------------------------------------- the form */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">
              {draft.id ? `Editing ${draft.number}` : 'New invoice'}
            </h2>
            {draft.id && (
              <button type="button" className="btn-secondary !px-4 !py-1.5 text-xs"
                onClick={() => setDraft(blank())}>
                Start a new one
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="inv-number">Invoice number</label>
              <div className="flex gap-2">
                <input id="inv-number" className="field" value={draft.number}
                  onChange={(e) => set('number', e.target.value)} placeholder="CL-2026-10" />
                <button type="button" className="btn-secondary whitespace-nowrap !px-3 text-xs"
                  onClick={() => set('number', suggestNumber())}>
                  Next
                </button>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="inv-period">Period</label>
              <input id="inv-period" className="field" value={draft.period}
                onChange={(e) => set('period', e.target.value)} placeholder="October 2026" />
            </div>
            <div>
              <label className="field-label" htmlFor="inv-issued">Date issued</label>
              <input id="inv-issued" type="date" className="field" value={draft.issued_on}
                onChange={(e) => set('issued_on', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="inv-due">Payment due</label>
              <input id="inv-due" type="date" className="field" value={draft.due_on}
                onChange={(e) => set('due_on', e.target.value)} disabled={draft.paid} />
            </div>
          </div>

          <div className="mt-4">
            <label className="field-label" htmlFor="inv-client">Billed to</label>
            <input id="inv-client" className="field" value={draft.client_name}
              onChange={(e) => set('client_name', e.target.value)} placeholder="Name" />
            <textarea rows={3} className="field mt-2" value={draft.client_address}
              onChange={(e) => set('client_address', e.target.value)}
              placeholder={'Address line\nTown\nPostcode'} />
          </div>

          <div className="mt-4">
            <label className="field-label" htmlFor="inv-desc">Description</label>
            <input id="inv-desc" className="field" value={draft.description}
              onChange={(e) => set('description', e.target.value)} />
            <input className="field mt-2" value={draft.detail}
              onChange={(e) => set('detail', e.target.value)}
              placeholder="Second line, e.g. Daily rate, October 2026" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="inv-days">Days</label>
              <input id="inv-days" type="number" min="0" step="0.5" className="field"
                value={draft.days} onChange={(e) => set('days', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="inv-rate">Rate per day</label>
              <input id="inv-rate" type="number" min="0" step="1" className="field"
                value={draft.rate} onChange={(e) => set('rate', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="inv-cur">Currency</label>
              <select id="inv-cur" className="field" value={draft.currency}
                onChange={(e) => set('currency', e.target.value)}>
                <option value="GBP">GBP £</option>
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
              </select>
            </div>
          </div>

          <p className="mt-3 text-sm text-stone-600">
            Total <span className="font-medium text-ink">{money(total, draft.currency)}</span>
            <span className="text-stone-400"> · no VAT</span>
          </p>

          <div className="mt-5 border-t border-stone-200 pt-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-stone-300"
                checked={draft.paid} onChange={(e) => set('paid', e.target.checked)} />
              Already paid — show nothing due
            </label>
            {draft.paid && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="inv-paidon">Date received</label>
                  <input id="inv-paidon" type="date" className="field" value={draft.paid_on}
                    onChange={(e) => set('paid_on', e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="inv-method">Method</label>
                  <input id="inv-method" className="field" value={draft.paid_method}
                    onChange={(e) => set('paid_method', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="field-label" htmlFor="inv-notes">Notes (optional)</label>
            <textarea id="inv-notes" rows={2} className="field" value={draft.notes}
              onChange={(e) => set('notes', e.target.value)} />
          </div>

          {status && (
            <p className={[
              'mt-4 rounded-lg px-4 py-3 text-sm',
              status.kind === 'ok'
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border border-red-300 bg-red-50 text-red-800',
            ].join(' ')}>
              {status.text}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!ready || busy} onClick={save}>
              {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Save invoice'}
            </button>
            <button type="button" className="btn-secondary" disabled={!ready || !settings}
              onClick={download}>
              Download PDF
            </button>
          </div>
          {!ready && (
            <p className="mt-2 text-xs text-stone-500">
              A number, a name and a number of days are needed before this can be saved or printed.
            </p>
          )}
        </div>

        {/* ------------------------------------------------- your own details */}
        <div className="card p-6">
          <button type="button" className="flex w-full items-center justify-between text-left"
            onClick={() => setShowSettings((v) => !v)}>
            <span className="font-display text-lg">Your details &amp; bank</span>
            <span className="text-xs text-stone-500">
              {showSettings ? 'Hide' : 'Edit'}
            </span>
          </button>
          <p className="mt-1 text-sm text-stone-500">
            Typed once, and used on every invoice.
          </p>
          {showSettings && settings && (
            <IssuerFields
              settings={settings}
              onSaved={(next) => {
                setSettings(next);
                setStatus({ kind: 'ok', text: 'Your details are saved.' });
              }}
              onError={onError}
            />
          )}
        </div>

        {/* ------------------------------------------------------ past ones */}
        <div className="card p-6">
          <h3 className="font-display text-lg">Saved invoices</h3>
          {invoices?.length ? (
            <ul className="mt-4 divide-y divide-stone-100 text-sm">
              {invoices.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <span className="text-ink">{row.number}</span>
                    <span className="block text-xs text-stone-500">
                      {row.client_name} · {longDate(row.issued_on)}
                      {row.paid ? ' · paid' : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-ink">{money(row.total, row.currency)}</span>
                    <button type="button" className="text-xs text-stone-500 underline hover:text-ink"
                      onClick={() => { setDraft(fromRow(row)); setStatus(null); }}>
                      Open
                    </button>
                    <button type="button" className="text-xs text-stone-500 underline hover:text-red-700"
                      onClick={() => remove(row.id, row.number)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Nothing saved yet.</p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- preview */}
      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Preview</p>
          <p className="text-xs text-stone-500">A4 · exactly what prints</p>
        </div>
        {/* Shrunk with zoom rather than a transform: zoom shrinks the box in
            layout, so the frame occupies the space it appears to, and no
            parent needs to be told the scaled height. */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <iframe
            ref={frameRef}
            title="Invoice preview"
            srcDoc={html}
            className="block border-0"
            style={{
              width: `${A4_WIDTH}px`,
              height: `${A4_HEIGHT}px`,
              zoom: PREVIEW_SCALE,
            }}
          />
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Download PDF opens your browser&rsquo;s print dialogue &mdash; choose
          &ldquo;Save as PDF&rdquo; as the destination.
        </p>
      </div>
    </div>
  );
}

function IssuerFields({
  settings,
  onSaved,
  onError,
}: {
  settings: InvoiceSettings;
  onSaved: (next: InvoiceSettings) => void;
  onError: (err: unknown) => void;
}) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);

  const field = (
    label: string,
    key: keyof InvoiceSettings,
    props: Record<string, unknown> = {},
  ) => (
    <div>
      <label className="field-label" htmlFor={`set-${key}`}>{label}</label>
      <input id={`set-${key}`} className="field" value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );

  async function save() {
    setBusy(true);
    try {
      const next = await adminRequest<InvoiceSettings>('/invoice-settings', {
        method: 'PUT',
        body: JSON.stringify({
          issuerName: form.issuer_name,
          issuerLegal: form.issuer_legal,
          issuerAddress: form.issuer_address,
          issuerEmail: form.issuer_email,
          issuerPhone: form.issuer_phone,
          issuerCompanyNo: form.issuer_company_no,
          bankName: form.bank_name,
          bankSortCode: form.bank_sort_code,
          bankAccount: form.bank_account,
          paymentTerms: form.payment_terms,
        }),
      });
      onSaved(next);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('Trading name', 'issuer_name')}
        {field('Registered name', 'issuer_legal')}
      </div>
      <div>
        <label className="field-label" htmlFor="set-addr">Address</label>
        <textarea id="set-addr" rows={3} className="field" value={form.issuer_address}
          onChange={(e) => setForm({ ...form, issuer_address: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field('Email', 'issuer_email', { type: 'email' })}
        {field('Telephone', 'issuer_phone')}
        {field('Company no.', 'issuer_company_no')}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field('Account name', 'bank_name')}
        {field('Sort code', 'bank_sort_code')}
        {field('Account number', 'bank_account')}
      </div>
      <div>
        <label className="field-label" htmlFor="set-terms">Payment terms (unpaid invoices)</label>
        <input id="set-terms" className="field" value={form.payment_terms}
          onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
      </div>
      <button type="button" className="btn-primary" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save details'}
      </button>
    </div>
  );
}
