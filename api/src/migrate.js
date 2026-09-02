import { query } from './db.js';

// Idempotent schema. Runs on every boot so a Railway deploy needs no extra step.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS property (
     id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
     name           TEXT NOT NULL DEFAULT 'Carterlane',
     tagline        TEXT NOT NULL DEFAULT 'A St Paul''s view, a front door of your own.',
     description    TEXT NOT NULL DEFAULT '',
     address        TEXT NOT NULL DEFAULT '',
     bedrooms       SMALLINT NOT NULL DEFAULT 1,
     bathrooms      SMALLINT NOT NULL DEFAULT 1,
     max_guests     SMALLINT NOT NULL DEFAULT 2,
     base_rate      NUMERIC(10,2) NOT NULL DEFAULT 180.00,
     cleaning_fee   NUMERIC(10,2) NOT NULL DEFAULT 60.00,
     min_nights     SMALLINT NOT NULL DEFAULT 2,
     max_nights     SMALLINT NOT NULL DEFAULT 28,
     currency       TEXT NOT NULL DEFAULT 'GBP',
     check_in_time  TEXT NOT NULL DEFAULT '15:00',
     check_out_time TEXT NOT NULL DEFAULT '11:00',
     amenities      JSONB NOT NULL DEFAULT '[]'::jsonb,
     contact_email  TEXT NOT NULL DEFAULT '',
     contact_phone  TEXT NOT NULL DEFAULT '',
     updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `INSERT INTO property (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,

  // A "night" is identified by the date it starts on. A block covers the
  // nights start_night .. end_night inclusive.
  `CREATE TABLE IF NOT EXISTS blocks (
     id          SERIAL PRIMARY KEY,
     start_night DATE NOT NULL,
     end_night   DATE NOT NULL,
     reason      TEXT NOT NULL DEFAULT 'Unavailable',
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT blocks_range_valid CHECK (end_night >= start_night)
   )`,
  `CREATE INDEX IF NOT EXISTS blocks_range_idx ON blocks (start_night, end_night)`,

  `CREATE TABLE IF NOT EXISTS rate_rules (
     id           SERIAL PRIMARY KEY,
     name         TEXT NOT NULL,
     start_night  DATE NOT NULL,
     end_night    DATE NOT NULL,
     nightly_rate NUMERIC(10,2) NOT NULL CHECK (nightly_rate >= 0),
     min_nights   SMALLINT,
     priority     SMALLINT NOT NULL DEFAULT 0,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT rate_rules_range_valid CHECK (end_night >= start_night)
   )`,
  `CREATE INDEX IF NOT EXISTS rate_rules_range_idx ON rate_rules (start_night, end_night)`,

  // check_out is exclusive: a stay of check_in .. check_out occupies the
  // nights check_in .. check_out - 1 day.
  `CREATE TABLE IF NOT EXISTS bookings (
     id             SERIAL PRIMARY KEY,
     reference      TEXT NOT NULL UNIQUE,
     status         TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
     check_in       DATE NOT NULL,
     check_out      DATE NOT NULL,
     guests         SMALLINT NOT NULL DEFAULT 1,
     guest_name     TEXT NOT NULL,
     guest_email    TEXT NOT NULL,
     guest_phone    TEXT NOT NULL DEFAULT '',
     message        TEXT NOT NULL DEFAULT '',
     nights         SMALLINT NOT NULL,
     accommodation  NUMERIC(10,2) NOT NULL DEFAULT 0,
     cleaning_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
     total          NUMERIC(10,2) NOT NULL DEFAULT 0,
     currency       TEXT NOT NULL DEFAULT 'GBP',
     admin_note     TEXT NOT NULL DEFAULT '',
     created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT bookings_range_valid CHECK (check_out > check_in)
   )`,
  `CREATE INDEX IF NOT EXISTS bookings_range_idx ON bookings (check_in, check_out)`,
  `CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status)`,

  `CREATE TABLE IF NOT EXISTS photos (
     id           SERIAL PRIMARY KEY,
     filename     TEXT NOT NULL,
     content_type TEXT NOT NULL,
     bytes        BYTEA NOT NULL,
     byte_size    INTEGER NOT NULL,
     width        INTEGER,
     height       INTEGER,
     caption      TEXT NOT NULL DEFAULT '',
     position     INTEGER NOT NULL DEFAULT 0,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS photos_position_idx ON photos (position, id)`,

  // Details that are the same on every invoice, typed once.
  `CREATE TABLE IF NOT EXISTS invoice_settings (
     id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
     issuer_name       TEXT NOT NULL DEFAULT 'Carterlane',
     issuer_legal      TEXT NOT NULL DEFAULT '',
     issuer_address    TEXT NOT NULL DEFAULT '',
     issuer_email      TEXT NOT NULL DEFAULT '',
     issuer_phone      TEXT NOT NULL DEFAULT '',
     issuer_company_no TEXT NOT NULL DEFAULT '',
     bank_name         TEXT NOT NULL DEFAULT '',
     bank_sort_code    TEXT NOT NULL DEFAULT '',
     bank_account      TEXT NOT NULL DEFAULT '',
     payment_terms     TEXT NOT NULL DEFAULT 'Payment is due within 14 days.',
     updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `INSERT INTO invoice_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,

  // Amounts are stored as given rather than as a computed total, so an invoice
  // reprinted years later shows exactly what was sent.
  `CREATE TABLE IF NOT EXISTS invoices (
     id             SERIAL PRIMARY KEY,
     number         TEXT NOT NULL UNIQUE,
     issued_on      DATE NOT NULL,
     due_on         DATE,
     period         TEXT NOT NULL DEFAULT '',
     client_name    TEXT NOT NULL,
     client_address TEXT NOT NULL DEFAULT '',
     description    TEXT NOT NULL,
     detail         TEXT NOT NULL DEFAULT '',
     days           NUMERIC(10,2) NOT NULL CHECK (days > 0),
     rate           NUMERIC(10,2) NOT NULL CHECK (rate >= 0),
     currency       TEXT NOT NULL DEFAULT 'GBP',
     paid           BOOLEAN NOT NULL DEFAULT false,
     paid_on        DATE,
     paid_method    TEXT NOT NULL DEFAULT 'Bank transfer',
     notes          TEXT NOT NULL DEFAULT '',
     created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS invoices_issued_idx ON invoices (issued_on DESC, id DESC)`,
];

export async function migrate() {
  for (const statement of STATEMENTS) {
    await query(statement);
  }
  console.log('Schema up to date.');
}
