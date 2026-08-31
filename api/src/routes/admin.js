import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import { addDays, isIsoDate, nightsInclusive, today } from '../dates.js';
import { conflictingNights, unavailableNights } from '../availability.js';
import { getProperty } from '../quote.js';
import { authConfigured, issueToken, requireAdmin, verifyPassword } from '../auth.js';
import { notifyBookingStatus } from '../mailer.js';
import { shrinkImage } from '../images.js';

export const adminRouter = express.Router();

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 12) * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP or AVIF images can be uploaded.'));
    }
    return cb(null, true);
  },
});

const isoDate = z.string().refine(isIsoDate, 'Expected a YYYY-MM-DD date.');

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
});

adminRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    if (!authConfigured()) {
      return res.status(503).json({
        error: 'Admin access is not configured. Set SESSION_SECRET and ADMIN_PASSWORD.',
      });
    }
    const ok = await verifyPassword(req.body?.password);
    if (!ok) return res.status(401).json({ error: 'That password is not right.' });
    return res.json({ token: issueToken() });
  } catch (err) {
    return next(err);
  }
});

adminRouter.use(requireAdmin);

adminRouter.get('/session', (_req, res) => res.json({ ok: true }));

/* ---------------------------------------------------------------- property */

const propertySchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(8000),
  address: z.string().trim().max(400),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  maxGuests: z.coerce.number().int().min(1).max(20),
  baseRate: z.coerce.number().min(0).max(100000),
  cleaningFee: z.coerce.number().min(0).max(100000),
  minNights: z.coerce.number().int().min(1).max(90),
  maxNights: z.coerce.number().int().min(1).max(365),
  currency: z.enum(['GBP', 'EUR', 'USD']),
  checkInTime: z.string().trim().max(10),
  checkOutTime: z.string().trim().max(10),
  amenities: z.array(z.string().trim().max(80)).max(40),
  contactEmail: z.string().trim().email().max(200).or(z.literal('')),
  contactPhone: z.string().trim().max(40),
});

adminRouter.get('/property', async (_req, res, next) => {
  try {
    res.json(await getProperty());
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/property', async (req, res, next) => {
  try {
    const parsed = propertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Please check the fields.',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const p = parsed.data;
    if (p.maxNights < p.minNights) {
      return res.status(400).json({ error: 'Maximum stay must be at least the minimum.' });
    }
    const { rows } = await query(
      `UPDATE property SET
         name = $1, tagline = $2, description = $3, address = $4, bedrooms = $5,
         bathrooms = $6, max_guests = $7, base_rate = $8, cleaning_fee = $9,
         min_nights = $10, max_nights = $11, currency = $12, check_in_time = $13,
         check_out_time = $14, amenities = $15::jsonb, contact_email = $16,
         contact_phone = $17, updated_at = now()
       WHERE id = 1 RETURNING *`,
      [
        p.name, p.tagline, p.description, p.address, p.bedrooms, p.bathrooms,
        p.maxGuests, p.baseRate, p.cleaningFee, p.minNights, p.maxNights,
        p.currency, p.checkInTime, p.checkOutTime, JSON.stringify(p.amenities),
        p.contactEmail, p.contactPhone,
      ],
    );
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------ availability */

adminRouter.get('/calendar', async (req, res, next) => {
  try {
    const from = isIsoDate(req.query.from) ? req.query.from : today();
    const to = isIsoDate(req.query.to) ? req.query.to : addDays(from, 365);
    const taken = await unavailableNights(from, to);
    const [blocks, bookings] = await Promise.all([
      query(
        `SELECT id, start_night, end_night, reason FROM blocks
          WHERE start_night <= $2 AND end_night >= $1
          ORDER BY start_night`,
        [from, to],
      ),
      query(
        `SELECT id, reference, status, check_in, check_out, guest_name, guests, total
           FROM bookings
          WHERE status <> 'cancelled' AND check_in <= $2 AND check_out > $1
          ORDER BY check_in`,
        [from, to],
      ),
    ]);
    res.json({
      from,
      to,
      nights: [...taken.entries()].map(([night, info]) => ({ night, ...info })),
      blocks: blocks.rows,
      bookings: bookings.rows.map((b) => ({ ...b, total: Number(b.total) })),
    });
  } catch (err) {
    next(err);
  }
});

const blockSchema = z
  .object({
    start: isoDate,
    end: isoDate,
    reason: z.string().trim().max(200).optional().default('Unavailable'),
  })
  .refine((v) => v.end >= v.start, { message: '`end` must not be before `start`.' });

adminRouter.post('/blocks', async (req, res, next) => {
  try {
    const parsed = blockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { start, end, reason } = parsed.data;
    const taken = await unavailableNights(start, end);
    const bookedClash = nightsInclusive(start, end).filter(
      (night) => taken.get(night)?.reason === 'booked',
    );
    if (bookedClash.length) {
      return res.status(409).json({
        error: 'Those nights include a live booking. Cancel the booking first.',
        conflicts: bookedClash,
      });
    }
    const { rows } = await query(
      `INSERT INTO blocks (start_night, end_night, reason) VALUES ($1, $2, $3)
       RETURNING *`,
      [start, end, reason || 'Unavailable'],
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete('/blocks/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM blocks WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) return res.status(404).json({ error: 'No such block.' });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

/**
 * Re-open nights inside existing blocks by splitting them around the range.
 * Bookings are never touched here — those are cancelled explicitly.
 */
adminRouter.post('/blocks/open', async (req, res, next) => {
  try {
    const parsed = blockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { start, end } = parsed.data;
    const opened = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM blocks WHERE start_night <= $2 AND end_night >= $1 FOR UPDATE`,
        [start, end],
      );
      for (const block of rows) {
        await client.query('DELETE FROM blocks WHERE id = $1', [block.id]);
        if (block.start_night < start) {
          await client.query(
            'INSERT INTO blocks (start_night, end_night, reason) VALUES ($1,$2,$3)',
            [block.start_night, addDays(start, -1), block.reason],
          );
        }
        if (block.end_night > end) {
          await client.query(
            'INSERT INTO blocks (start_night, end_night, reason) VALUES ($1,$2,$3)',
            [addDays(end, 1), block.end_night, block.reason],
          );
        }
      }
      return rows.length;
    });
    const taken = await unavailableNights(start, end);
    const stillBooked = nightsInclusive(start, end).filter(
      (night) => taken.get(night)?.reason === 'booked',
    );
    return res.json({ blocksTouched: opened, stillBooked });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ rates */

const rateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    start: isoDate,
    end: isoDate,
    nightlyRate: z.coerce.number().min(0).max(100000),
    minNights: z.coerce.number().int().min(1).max(90).nullable().optional(),
    priority: z.coerce.number().int().min(0).max(100).optional().default(0),
  })
  .refine((v) => v.end >= v.start, { message: '`end` must not be before `start`.' });

adminRouter.get('/rates', async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM rate_rules ORDER BY start_night, priority DESC',
    );
    res.json(rows.map((r) => ({ ...r, nightly_rate: Number(r.nightly_rate) })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/rates', async (req, res, next) => {
  try {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const r = parsed.data;
    const { rows } = await query(
      `INSERT INTO rate_rules (name, start_night, end_night, nightly_rate, min_nights, priority)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [r.name, r.start, r.end, r.nightlyRate, r.minNights ?? null, r.priority],
    );
    return res.status(201).json({ ...rows[0], nightly_rate: Number(rows[0].nightly_rate) });
  } catch (err) {
    return next(err);
  }
});

adminRouter.put('/rates/:id', async (req, res, next) => {
  try {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const r = parsed.data;
    const { rows } = await query(
      `UPDATE rate_rules SET name = $1, start_night = $2, end_night = $3,
              nightly_rate = $4, min_nights = $5, priority = $6
        WHERE id = $7 RETURNING *`,
      [r.name, r.start, r.end, r.nightlyRate, r.minNights ?? null, r.priority,
       Number(req.params.id)],
    );
    if (!rows.length) return res.status(404).json({ error: 'No such rate.' });
    return res.json({ ...rows[0], nightly_rate: Number(rows[0].nightly_rate) });
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete('/rates/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM rate_rules WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) return res.status(404).json({ error: 'No such rate.' });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------------------- bookings */

adminRouter.get('/bookings', async (req, res, next) => {
  try {
    const status = ['pending', 'confirmed', 'cancelled'].includes(req.query.status)
      ? req.query.status
      : null;
    const { rows } = await query(
      `SELECT * FROM bookings
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY check_in DESC, id DESC
        LIMIT 500`,
      [status],
    );
    res.json(
      rows.map((b) => ({
        ...b,
        accommodation: Number(b.accommodation),
        cleaning_fee: Number(b.cleaning_fee),
        total: Number(b.total),
      })),
    );
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  adminNote: z.string().trim().max(2000).optional(),
  notify: z.boolean().optional().default(true),
});

adminRouter.patch('/bookings/:id', async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { status, adminNote, notify } = parsed.data;
    const id = Number(req.params.id);

    const booking = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(4815162342)');
      const current = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
      if (!current.rows.length) {
        const err = new Error('No such booking.');
        err.status = 404;
        throw err;
      }
      const row = current.rows[0];
      // Re-instating a cancelled booking must not double-book the nights.
      if (row.status === 'cancelled' && status !== 'cancelled') {
        const clash = await conflictingNights(row.check_in, row.check_out, {
          excludeBookingId: id,
          client,
        });
        if (clash.length) {
          const err = new Error('Those nights are no longer free.');
          err.status = 409;
          err.conflicts = clash;
          throw err;
        }
      }
      const { rows } = await client.query(
        `UPDATE bookings SET status = $1,
                admin_note = COALESCE($2, admin_note),
                updated_at = now()
          WHERE id = $3 RETURNING *`,
        [status, adminNote ?? null, id],
      );
      return rows[0];
    });

    if (notify && booking.status !== 'pending') {
      const property = await getProperty();
      notifyBookingStatus(booking, property).catch((err) =>
        console.error('Status notification failed:', err.message),
      );
    }
    return res.json({ ...booking, total: Number(booking.total) });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, conflicts: err.conflicts });
    }
    return next(err);
  }
});

/* ----------------------------------------------------------------- photos */

adminRouter.get('/photos', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, filename, caption, position, width, height, byte_size, created_at
         FROM photos ORDER BY position, id`,
    );
    res.json(rows.map((p) => ({ ...p, url: `/api/photos/${p.id}/file` })));
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/photos', upload.array('photos', 20), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Choose at least one image.' });
    const { rows: max } = await query(
      'SELECT COALESCE(MAX(position), 0) AS position FROM photos',
    );
    let position = Number(max[0].position);
    const created = [];
    for (const file of files) {
      const image = await shrinkImage(file.buffer, file.mimetype);
      position += 1;
      const { rows } = await query(
        `INSERT INTO photos
           (filename, content_type, bytes, byte_size, width, height, caption, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, filename, caption, position, width, height, byte_size`,
        [
          file.originalname.slice(0, 200),
          image.contentType,
          image.bytes,
          image.bytes.length,
          image.width,
          image.height,
          '',
          position,
        ],
      );
      created.push({ ...rows[0], url: `/api/photos/${rows[0].id}/file` });
    }
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

adminRouter.patch('/photos/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      caption: z.string().trim().max(300).optional(),
      position: z.coerce.number().int().min(0).max(10000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { caption, position } = parsed.data;
    const { rows } = await query(
      `UPDATE photos SET caption = COALESCE($1, caption),
              position = COALESCE($2, position)
        WHERE id = $3
        RETURNING id, filename, caption, position, width, height, byte_size`,
      [caption ?? null, position ?? null, Number(req.params.id)],
    );
    if (!rows.length) return res.status(404).json({ error: 'No such photo.' });
    return res.json({ ...rows[0], url: `/api/photos/${rows[0].id}/file` });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post('/photos/reorder', async (req, res, next) => {
  try {
    const schema = z.object({ order: z.array(z.coerce.number().int()).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Send an array of photo ids.' });
    await withTransaction(async (client) => {
      for (const [index, id] of parsed.data.order.entries()) {
        await client.query('UPDATE photos SET position = $1 WHERE id = $2', [index + 1, id]);
      }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete('/photos/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM photos WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) return res.status(404).json({ error: 'No such photo.' });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});
