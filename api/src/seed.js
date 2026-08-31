import 'dotenv/config';
import { query, pool } from './db.js';
import { migrate } from './migrate.js';
import { addDays, today } from './dates.js';

const AMENITIES = [
  'Cathedral view from the living room',
  'Fast Wi-Fi and a proper desk',
  'Full kitchen with dishwasher',
  'Washer-dryer',
  'Smart TV',
  'Lift to all floors',
  'Fresh linen and towels',
  'Self check-in with a key safe',
];

async function seed() {
  await migrate();

  await query(
    `UPDATE property SET
       name = $1, tagline = $2, description = $3, address = $4,
       bedrooms = 1, bathrooms = 1, max_guests = 4,
       base_rate = 185, cleaning_fee = 65, min_nights = 2, max_nights = 28,
       amenities = $5::jsonb, contact_email = $6
     WHERE id = 1`,
    [
      'Carterlane',
      "A St Paul's view, and a front door of your own.",
      'A calm, high-ceilinged flat a few minutes from the cathedral steps. ' +
        'The living room looks straight out at the dome — floodlit after dark — ' +
        'and the City is quiet at the weekend in a way visitors never expect. ' +
        'Sleeps four, works well for two.',
      'Carter Lane, London EC4',
      JSON.stringify(AMENITIES),
      process.env.OWNER_EMAIL || '',
    ],
  );

  const start = today();
  await query('DELETE FROM rate_rules');
  await query(
    `INSERT INTO rate_rules (name, start_night, end_night, nightly_rate, min_nights, priority)
     VALUES ($1,$2,$3,$4,$5,$6), ($7,$8,$9,$10,$11,$12)`,
    [
      'Summer', addDays(start, 30), addDays(start, 120), 225, 3, 10,
      'Christmas & New Year', `${new Date().getUTCFullYear()}-12-18`,
      `${new Date().getUTCFullYear()}-12-31`, 295, 4, 20,
    ],
  );

  await query('DELETE FROM blocks');
  await query(
    `INSERT INTO blocks (start_night, end_night, reason) VALUES ($1, $2, $3)`,
    [addDays(start, 14), addDays(start, 18), 'Owner stay'],
  );

  console.log('Seeded property, two rate rules and one block.');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
