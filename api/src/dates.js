// All dates in this codebase are plain 'YYYY-MM-DD' strings handled in UTC, so
// a night never drifts across a timezone or DST boundary.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  return toIso(new Date(time)) === value;
}

export function toIso(date) {
  return date.toISOString().slice(0, 10);
}

export function parseIso(value) {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value, days) {
  const date = parseIso(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function today() {
  return toIso(new Date());
}

export function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Nights occupied by a stay: check_in .. check_out - 1 day. */
export function nightsBetween(checkIn, checkOut) {
  const nights = [];
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    nights.push(night);
  }
  return nights;
}

/** Every date from start to end inclusive. */
export function nightsInclusive(start, end) {
  return nightsBetween(start, addDays(end, 1));
}

export function nightCount(checkIn, checkOut) {
  return Math.round(
    (parseIso(checkOut).getTime() - parseIso(checkIn).getTime()) / 86_400_000,
  );
}

/** Collapse a sorted list of dates into inclusive [start, end] ranges. */
export function toRanges(dates) {
  const sorted = [...new Set(dates)].sort();
  const ranges = [];
  for (const date of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && addDays(last.end, 1) === date) {
      last.end = date;
    } else {
      ranges.push({ start: date, end: date });
    }
  }
  return ranges;
}
