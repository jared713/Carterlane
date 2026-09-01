import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import { addDays, isIsoDate, nightCount, today } from '../dates.js';
import { availabilityCalendar, conflictingNights } from '../availability.js';
import { getProperty, lowestNightlyRate, priceStay, validateStay } from '../quote.js';
import { bookingReference } from '../reference.js';
import { notifyNewBooking } from '../mailer.js';

export const publicRouter = express.Router();

const isoDate = z.string().refine(isIsoDate, 'Expected a YYYY-MM-DD date.');

const bookingSchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.coerce.number().int().min(1).max(20),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  // Honeypot: real guests never fill this in.
  website: z.string().max(0).optional(),
});

// Ten attempts a quarter of an hour is generous for a guest and tight for a
// script. It is configurable because the end-to-end suite makes eight bookings
// in a run, so a fixed limit makes the tests unrunnable twice in a row.
const bookingLimiter = rateLimit({
  windowMs: Number(process.env.BOOKING_RATE_WINDOW_MIN || 15) * 60 * 1000,
  limit: Number(process.env.BOOKING_RATE_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

publicRouter.get('/property', async (_req, res, next) => {
  try {
    const property = await getProperty();
    const windowEnd = addDays(today(), 365);
    const fromRate = await lowestNightlyRate(today(), windowEnd, property);
    res.json({
      name: property.name,
      tagline: property.tagline,
      description: property.description,
      address: property.address,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      maxGuests: property.max_guests,
      minNights: property.min_nights,
      maxNights: property.max_nights,
      baseRate: property.base_rate,
      fromRate,
      cleaningFee: property.cleaning_fee,
      currency: property.currency,
      checkInTime: property.check_in_time,
      checkOutTime: property.check_out_time,
      amenities: property.amenities,
      contactEmail: property.contact_email,
      contactPhone: property.contact_phone,
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/photos', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, caption, width, height, content_type, position
         FROM photos ORDER BY position, id`,
    );
    res.json(
      rows.map((photo) => ({
        id: photo.id,
        caption: photo.caption,
        width: photo.width,
        height: photo.height,
        url: `/api/photos/${photo.id}/file`,
      })),
    );
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/photos/:id/file', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).end();
    const { rows } = await query(
      'SELECT bytes, content_type FROM photos WHERE id = $1',
      [id],
    );
    if (!rows.length) return res.status(404).end();
    res.set('Content-Type', rows[0].content_type);
    // Photo bytes are immutable once uploaded; a replacement gets a new id.
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(rows[0].bytes);
  } catch (err) {
    return next(err);
  }
});

publicRouter.get('/availability', async (req, res, next) => {
  try {
    const from = isIsoDate(req.query.from) ? req.query.from : today();
    const to = isIsoDate(req.query.to) ? req.query.to : addDays(from, 365);
    if (to < from) return res.status(400).json({ error: '`to` must be after `from`.' });
    if (nightCount(from, to) > 730) {
      return res.status(400).json({ error: 'Request at most two years at a time.' });
    }
    const calendar = await availabilityCalendar(from, to);
    const property = await getProperty();
    const { rows: rules } = await query(
      `SELECT id, name, start_night, end_night, nightly_rate, min_nights, priority
         FROM rate_rules
        WHERE start_night <= $2 AND end_night >= $1
        ORDER BY priority DESC, id DESC`,
      [from, to],
    );
    return res.json({
      ...calendar,
      baseRate: property.base_rate,
      currency: property.currency,
      minNights: property.min_nights,
      maxNights: property.max_nights,
      maxGuests: property.max_guests,
      cleaningFee: property.cleaning_fee,
      rates: rules.map((rule) => ({
        // The id is what makes a rate identifiable: name and dates can repeat.
        id: rule.id,
        name: rule.name,
        start: rule.start_night,
        end: rule.end_night,
        nightlyRate: Number(rule.nightly_rate),
        minNights: rule.min_nights,
        priority: rule.priority,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

publicRouter.get('/quote', async (req, res, next) => {
  try {
    const { checkIn, checkOut, guests } = req.query;
    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
      return res.status(400).json({ error: 'Provide checkIn and checkOut as YYYY-MM-DD.' });
    }
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }
    if (checkIn < today()) {
      return res.status(400).json({ error: 'Check-in cannot be in the past.' });
    }
    const property = await getProperty();
    const quote = await priceStay(checkIn, checkOut, property);
    const guestCount = Number(guests || 1);
    const errors = validateStay(
      { checkIn, checkOut, guests: guestCount },
      property,
      quote.minNights,
    );
    const conflicts = await conflictingNights(checkIn, checkOut);
    if (conflicts.length) errors.push('Some of those nights are no longer available.');
    return res.json({ ...quote, available: conflicts.length === 0, conflicts, errors });
  } catch (err) {
    return next(err);
  }
});

publicRouter.post('/bookings', bookingLimiter, async (req, res, next) => {
  try {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Please check the form.',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const data = parsed.data;
    if (data.website) return res.status(400).json({ error: 'Please check the form.' });
    if (data.checkOut <= data.checkIn) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }
    if (data.checkIn < today()) {
      return res.status(400).json({ error: 'Check-in cannot be in the past.' });
    }

    const property = await getProperty();
    const quote = await priceStay(data.checkIn, data.checkOut, property);
    const errors = validateStay(data, property, quote.minNights);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const booking = await withTransaction(async (client) => {
      // Serialise booking creation so two guests cannot claim the same night.
      await client.query('SELECT pg_advisory_xact_lock(4815162342)');
      const conflicts = await conflictingNights(data.checkIn, data.checkOut, { client });
      if (conflicts.length) {
        const err = new Error('Those dates have just been taken. Please choose again.');
        err.status = 409;
        err.conflicts = conflicts;
        throw err;
      }
      const { rows } = await client.query(
        `INSERT INTO bookings
           (reference, check_in, check_out, guests, guest_name, guest_email,
            guest_phone, message, nights, accommodation, cleaning_fee, total, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          bookingReference(),
          data.checkIn,
          data.checkOut,
          data.guests,
          data.name,
          data.email,
          data.phone,
          data.message,
          quote.nights,
          quote.accommodation,
          quote.cleaningFee,
          quote.total,
          property.currency,
        ],
      );
      return rows[0];
    });

    // Fire and forget: the booking is committed, email is best effort.
    notifyNewBooking(booking, property).catch((err) =>
      console.error('Booking notification failed:', err.message),
    );

    return res.status(201).json({
      reference: booking.reference,
      status: booking.status,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      guests: booking.guests,
      total: Number(booking.total),
      currency: booking.currency,
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message, conflicts: err.conflicts });
    }
    return next(err);
  }
});
