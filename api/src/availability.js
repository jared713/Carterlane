import { query } from './db.js';
import { addDays, nightsBetween, nightsInclusive, toRanges } from './dates.js';

/**
 * Every night that cannot be booked in [from, to] inclusive, from both manual
 * blocks and live (pending or confirmed) bookings.
 */
export async function unavailableNights(from, to, options = {}) {
  const { excludeBookingId = null, client = null } = options;
  const run = client ? client.query.bind(client) : query;
  const [blocks, bookings] = await Promise.all([
    run(
      `SELECT start_night, end_night, reason
         FROM blocks
        WHERE start_night <= $2 AND end_night >= $1`,
      [from, to],
    ),
    run(
      `SELECT id, check_in, check_out, status, reference
         FROM bookings
        WHERE status <> 'cancelled'
          AND check_in <= $2
          AND check_out > $1
          AND ($3::int IS NULL OR id <> $3::int)`,
      [from, to, excludeBookingId],
    ),
  ]);

  const nights = new Map();
  for (const block of blocks.rows) {
    for (const night of nightsInclusive(block.start_night, block.end_night)) {
      if (night >= from && night <= to) {
        nights.set(night, { reason: 'blocked', label: block.reason });
      }
    }
  }
  for (const booking of bookings.rows) {
    for (const night of nightsBetween(booking.check_in, booking.check_out)) {
      if (night >= from && night <= to) {
        nights.set(night, {
          reason: 'booked',
          label: booking.status === 'pending' ? 'Held (pending)' : 'Booked',
          bookingId: booking.id,
          reference: booking.reference,
        });
      }
    }
  }
  return nights;
}

/** Which of the requested nights are already taken. */
export async function conflictingNights(checkIn, checkOut, options = {}) {
  const lastNight = addDays(checkOut, -1);
  const taken = await unavailableNights(checkIn, lastNight, options);
  return nightsBetween(checkIn, checkOut).filter((night) => taken.has(night));
}

export async function availabilityCalendar(from, to) {
  const taken = await unavailableNights(from, to);
  return {
    from,
    to,
    unavailable: [...taken.keys()].sort(),
    ranges: toRanges([...taken.keys()]),
  };
}
