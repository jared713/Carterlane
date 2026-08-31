/** Dates are plain 'YYYY-MM-DD' strings in UTC, matching the API exactly. */

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIso(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function today(): string {
  return toIso(new Date());
}

export function addDays(value: string, days: number): string {
  const date = parseIso(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function addMonths(value: string, months: number): string {
  const date = parseIso(value);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIso(date);
}

export function startOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    nights.push(night);
  }
  return nights;
}

export function nightCount(checkIn: string, checkOut: string): number {
  return Math.round(
    (parseIso(checkOut).getTime() - parseIso(checkIn).getTime()) / 86_400_000,
  );
}

/**
 * Every cell of a month grid, Monday-first, padded with the surrounding days
 * so the grid is always whole weeks.
 */
export function monthGrid(monthStart: string): { date: string; inMonth: boolean }[] {
  const first = parseIso(startOfMonth(monthStart));
  const month = first.getUTCMonth();
  // getUTCDay is Sunday-first; shift so Monday is column 0.
  const leading = (first.getUTCDay() + 6) % 7;
  const cells: { date: string; inMonth: boolean }[] = [];
  let cursor = addDays(toIso(first), -leading);
  while (cells.length < 42) {
    cells.push({ date: cursor, inMonth: parseIso(cursor).getUTCMonth() === month });
    cursor = addDays(cursor, 1);
    if (cells.length >= 35 && parseIso(cursor).getUTCMonth() !== month) break;
  }
  return cells;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(value: string): string {
  const date = parseIso(value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatDate(value: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(parseIso(value));
}

export function formatShort(value: string): string {
  return formatDate(value, { weekday: undefined, year: undefined });
}

export function formatMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
