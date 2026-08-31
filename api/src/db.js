import pg from 'pg';

// Postgres returns DATE columns as JS Date objects in the server's timezone,
// which silently shifts a night by a day. Keep them as plain YYYY-MM-DD strings.
pg.types.setTypeParser(1082, (value) => value);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Add a Postgres database to the Railway project.');
  process.exit(1);
}

const needsSsl =
  process.env.PGSSL === 'require' ||
  (!/localhost|127\.0\.0\.1|\.railway\.internal/.test(connectionString) &&
    process.env.PGSSL !== 'disable');

export const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 8),
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres client error', err);
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
