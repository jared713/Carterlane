import { query } from './db.js';
import { addDays, nightCount, nightsBetween } from './dates.js';

export async function getProperty() {
  const { rows } = await query('SELECT * FROM property WHERE id = 1');
  const property = rows[0];
  return {
    ...property,
    base_rate: Number(property.base_rate),
    cleaning_fee: Number(property.cleaning_fee),
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Price a stay night by night. The highest-priority rate rule covering a night
 * wins; ties break on the most recently created rule; otherwise the base rate
 * applies. Rules may also raise the minimum stay for the nights they cover.
 */
export async function priceStay(checkIn, checkOut, property) {
  const nights = nightsBetween(checkIn, checkOut);
  const { rows: rules } = await query(
    `SELECT id, name, start_night, end_night, nightly_rate, min_nights, priority
       FROM rate_rules
      WHERE start_night <= $2 AND end_night >= $1
      ORDER BY priority DESC, id DESC`,
    [checkIn, addDays(checkOut, -1)],
  );

  let minNights = property.min_nights;
  const breakdown = nights.map((night) => {
    const rule = rules.find((r) => r.start_night <= night && r.end_night >= night);
    if (rule?.min_nights) minNights = Math.max(minNights, rule.min_nights);
    return {
      night,
      rate: round2(Number(rule ? rule.nightly_rate : property.base_rate)),
      rule: rule ? { id: rule.id, name: rule.name } : null,
    };
  });

  const accommodation = round2(breakdown.reduce((sum, n) => sum + n.rate, 0));
  const cleaningFee = round2(property.cleaning_fee);

  return {
    checkIn,
    checkOut,
    nights: nights.length,
    breakdown,
    accommodation,
    cleaningFee,
    total: round2(accommodation + cleaningFee),
    averageNightly: nights.length ? round2(accommodation / nights.length) : 0,
    currency: property.currency,
    minNights,
  };
}

/** Stay-length and guest-count rules, independent of availability. */
export function validateStay({ checkIn, checkOut, guests }, property, minNights) {
  const errors = [];
  const nights = nightCount(checkIn, checkOut);

  if (nights < 1) errors.push('Check-out must be after check-in.');
  if (nights > property.max_nights) {
    errors.push(`Stays are limited to ${property.max_nights} nights.`);
  }
  if (nights >= 1 && nights < minNights) {
    errors.push(`Minimum stay for these dates is ${minNights} nights.`);
  }
  if (guests < 1) errors.push('At least one guest is required.');
  if (guests > property.max_guests) {
    errors.push(`The flat sleeps ${property.max_guests}.`);
  }
  return errors;
}

/** Cheapest nightly rate over a window, for "from £X a night" copy. */
export async function lowestNightlyRate(from, to, property) {
  const { rows } = await query(
    `SELECT MIN(nightly_rate) AS min_rate
       FROM rate_rules
      WHERE start_night <= $2 AND end_night >= $1`,
    [from, to],
  );
  const ruleMin = rows[0]?.min_rate == null ? null : Number(rows[0].min_rate);
  return ruleMin == null ? property.base_rate : Math.min(ruleMin, property.base_rate);
}
