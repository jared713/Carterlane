/**
 * Renders an invoice as a complete, self-contained HTML document.
 *
 * It is a string rather than a component because it has to leave the app: it
 * is written into an iframe and handed to the browser's print engine, which
 * gives crisp vector text at whatever the printer or PDF writer asks for.
 * Rasterising the page instead would produce a blurry document, and rendering
 * it on the server would mean carrying a headless browser for one feature.
 */

export type InvoiceSettings = {
  issuer_name: string;
  issuer_legal: string;
  issuer_address: string;
  issuer_email: string;
  issuer_phone: string;
  issuer_company_no: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account: string;
  payment_terms: string;
};

export type Invoice = {
  id?: number;
  number: string;
  issued_on: string;
  due_on: string | null;
  period: string;
  client_name: string;
  client_address: string;
  description: string;
  detail: string;
  days: number;
  rate: number;
  currency: string;
  paid: boolean;
  paid_on: string | null;
  paid_method: string;
  notes: string;
};

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(escape)
    .join('<br>');

export function money(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function longDate(iso: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Days may be fractional, so show a decimal only when there is one. */
const formatDays = (days: number) =>
  Number.isInteger(days) ? String(days) : days.toFixed(2);

const MARK = `<svg viewBox="0 0 100 100" width="64" height="64" aria-hidden="true" fill="none" stroke="currentColor">
  <path d="M29.7 77.5C33 79.6 37.4 81.4 41.9 82.5 46.4 83.6 51.1 83.7 55.7 83 60.3 82.3 64.8 80.7 68.8 78.3 72.9 75.9 76.5 72.7 79.4 68.9 82.3 65.1 84.4 60.8 85.6 56.2 86.8 51.6 87 46.8 86.3 42.1 85.5 37.4 83.8 32.9 81.3 28.9 78.7 24.9 75.3 21.4 71.4 18.7 67.4 16 62.9 14.1 58.2 13.2 53.5 12.3 48.6 12.3 43.9 13.3 39.2 14.3 34.7 16.2 30.8 19 26.8 21.7 23.5 25.2 20.9 29.2 18.4 33.2 16.7 37.7 15.9 42.4 15.1 47 15.3 51.8 16.4 56.3"
        stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
  <path d="M4 66.5H31" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
  <text x="48.5" y="63.5" text-anchor="middle" fill="currentColor" stroke="none"
        font-family="Fraunces, Georgia, serif" font-size="39" font-weight="300"
        letter-spacing="-0.5">CL</text>
</svg>`;

export function invoiceHtml(invoice: Invoice, settings: InvoiceSettings): string {
  const total = invoice.days * invoice.rate;
  const paid = invoice.paid;
  const cur = invoice.currency || 'GBP';

  const statusField = paid
    ? `<div class="label">Status</div><div class="value"><span class="paid">Paid in full</span></div>`
    : `<div class="label">Payment due</div><div class="value">${escape(longDate(invoice.due_on)) || '&mdash;'}</div>`;

  const noteBox = paid
    ? `<strong>Paid in full &mdash; no payment is due.</strong><br>No VAT is charged on this invoice.`
    : `No VAT is charged on this invoice.`;

  const paymentBlock = paid
    ? `<div class="label">Payment received</div>
       <dl>
         <dt>Method</dt><dd>${escape(invoice.paid_method || 'Bank transfer')}</dd>
         <dt>Date received</dt><dd>${escape(longDate(invoice.paid_on)) || '&mdash;'}</dd>
         <dt>Reference</dt><dd>${escape(invoice.number)}</dd>
         <dt>Amount</dt><dd>${money(total, cur)}</dd>
       </dl>`
    : `<div class="label">Payment by bank transfer</div>
       <dl>
         <dt>Account name</dt><dd>${escape(settings.bank_name) || '&mdash;'}</dd>
         <dt>Sort code</dt><dd>${escape(settings.bank_sort_code) || '&mdash;'}</dd>
         <dt>Account number</dt><dd>${escape(settings.bank_account) || '&mdash;'}</dd>
         <dt>Reference</dt><dd>${escape(invoice.number)}</dd>
       </dl>`;

  const terms = paid
    ? 'This invoice has been settled in full and is issued as a record only. No further payment is required.'
    : settings.payment_terms || 'Payment is due within 14 days.';

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Invoice ${escape(invoice.number)} — ${escape(settings.issuer_name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Loaded without blocking the first paint. A stylesheet link holds the page
     blank until it resolves, so a slow or unreachable font host would leave
     the preview empty; this way the document appears at once in Georgia and
     the system sans, and swaps to the brand faces when they arrive. -->
<link rel="stylesheet" media="print" onload="this.media='all'"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Inter:wght@400;500&display=swap">
<noscript><link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Inter:wght@400;500&display=swap"></noscript>
<style>
  :root {
    --ink:#14161a; --stone-700:#5f523d; --stone-500:#94815f;
    --stone-300:#d2c7b2; --stone-200:#e6dfd1; --stone-100:#f3efe7; --brass:#a8853f;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:Inter,system-ui,-apple-system,sans-serif;color:var(--ink);background:#fff;
       font-size:10.5pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{width:210mm;min-height:297mm;margin:0 auto;padding:12mm 16mm;display:flex;flex-direction:column}
  h1{font-family:Fraunces,Georgia,serif;font-weight:300;font-size:22pt;margin:6mm 0 0;letter-spacing:.02em}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:16mm}
  .mark{color:var(--brass)}
  .mark .name{font-family:Fraunces,Georgia,serif;font-size:15pt;color:var(--ink);margin-top:3mm}
  .issuer{text-align:right;font-size:9pt;color:var(--stone-700)}
  .issuer .legal{color:var(--ink);font-weight:500}
  .meta{display:flex;gap:12mm;margin-top:5mm;padding-top:4mm;border-top:1px solid var(--stone-200)}
  .label{font-size:7.5pt;text-transform:uppercase;letter-spacing:.14em;color:var(--stone-500);margin-bottom:1.5mm}
  .value{font-size:10.5pt}
  .paid{color:var(--brass);font-weight:500}
  .billto{margin-top:5mm}
  .billto .who{font-size:12pt;font-family:Fraunces,Georgia,serif}
  table{width:100%;border-collapse:collapse;margin-top:5mm}
  thead th{text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:.14em;
           color:var(--stone-500);font-weight:500;padding:0 0 2.5mm;border-bottom:1px solid var(--stone-300)}
  thead th.num,tbody td.num{text-align:right}
  tbody td{padding:3mm 0;border-bottom:1px solid var(--stone-200);vertical-align:top}
  tbody .desc{font-size:11pt}
  tbody .sub{font-size:9pt;color:var(--stone-700);margin-top:1mm}
  .totals{margin-top:4mm;margin-left:auto;width:78mm}
  .totals .row{display:flex;justify-content:space-between;padding:2mm 0;font-size:10pt}
  .totals .row.rule{border-top:1px solid var(--stone-300);margin-top:1mm;padding-top:2.5mm;font-weight:500}
  .totals .row.grand{border-top:1.5px solid var(--ink);margin-top:2mm;padding-top:3.5mm;
                     font-family:Fraunces,Georgia,serif;font-size:16pt}
  .vat-note{margin-top:4mm;padding:3mm 4mm;background:var(--stone-100);
            border-left:2px solid var(--brass);font-size:9pt;color:var(--stone-700)}
  .pay{margin-top:5mm;display:flex;gap:14mm}
  .pay>div{flex:1}
  .pay dl{margin:0;display:grid;grid-template-columns:34mm 1fr;row-gap:1.5mm;font-size:9.5pt}
  .pay dt{color:var(--stone-700)}
  .pay dd{margin:0}
  .notes{margin-top:5mm;font-size:9.5pt;color:var(--stone-700)}
  footer{margin-top:auto;padding-top:4mm;border-top:1px solid var(--stone-200);
         font-size:8.5pt;color:var(--stone-500);display:flex;justify-content:space-between}
  @page{size:A4;margin:0}
  @media print{.sheet{margin:0}}
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div>
      <div class="mark">${MARK}</div>
      <div class="name">${escape(settings.issuer_name)}</div>
    </div>
    <div class="issuer">
      <div class="legal">${escape(settings.issuer_legal)}</div>
      ${lines(settings.issuer_address)}
      <div style="margin-top:2.5mm">${escape(settings.issuer_email)}</div>
      <div>${escape(settings.issuer_phone)}</div>
      ${settings.issuer_company_no ? `<div style="margin-top:2.5mm">Company no. ${escape(settings.issuer_company_no)}</div>` : ''}
    </div>
  </header>

  <h1>Invoice</h1>

  <div class="meta">
    <div><div class="label">Invoice number</div><div class="value">${escape(invoice.number)}</div></div>
    <div><div class="label">Date issued</div><div class="value">${escape(longDate(invoice.issued_on))}</div></div>
    <div>${statusField}</div>
    ${invoice.period ? `<div><div class="label">Period</div><div class="value">${escape(invoice.period)}</div></div>` : ''}
  </div>

  <div class="billto">
    <div class="label">Billed to</div>
    <div class="who">${escape(invoice.client_name)}</div>
    <div>${lines(invoice.client_address)}</div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th class="num">Days</th><th class="num">Rate</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="desc">${escape(invoice.description)}</div>
          ${invoice.detail ? `<div class="sub">${escape(invoice.detail)}</div>` : ''}
        </td>
        <td class="num">${formatDays(invoice.days)}</td>
        <td class="num">${money(invoice.rate, cur)}</td>
        <td class="num">${money(total, cur)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(total, cur)}</span></div>
    <div class="row"><span>VAT</span><span>&mdash;</span></div>
    ${paid ? '<div class="row rule"><span>Invoice total</span><span>' + money(total, cur) + '</span></div>' : ''}
    ${paid
      ? `<div class="row"><span>Payment received</span><span>&minus;${money(total, cur)}</span></div>
         <div class="row grand"><span>Amount due</span><span>${money(0, cur)}</span></div>`
      : `<div class="row grand"><span>Total due</span><span>${money(total, cur)}</span></div>`}
  </div>

  <div class="vat-note">${noteBox}</div>

  <div class="pay">
    <div>${paymentBlock}</div>
    <div>
      <div class="label">Terms</div>
      <div style="font-size:9.5pt;color:var(--stone-700)">${escape(terms)}</div>
    </div>
  </div>

  ${invoice.notes ? `<div class="notes"><div class="label">Notes</div>${lines(invoice.notes)}</div>` : ''}

  <footer>
    <span>${escape(settings.issuer_name)} &middot; ${escape(invoice.number)}</span>
    <span>${money(total, cur)}${paid ? ' &middot; paid in full' : ` due ${escape(longDate(invoice.due_on))}`}</span>
  </footer>
</div>
</body>
</html>`;
}
