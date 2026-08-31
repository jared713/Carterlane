import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { migrate } from './migrate.js';
import { pool } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Railway terminates TLS in front of the app; trust it so rate limiting and
// req.ip see the real client address.
app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server calls arrive without an Origin header.
      if (!origin) return callback(null, true);
      if (!allowedOrigins.length) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Every Vercel preview deployment gets its own subdomain.
      if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && /\.vercel\.app$/.test(new URL(origin).hostname)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed.`));
    },
    credentials: false,
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'carterlane-api' });
  } catch {
    res.status(503).json({ ok: false, error: 'database unavailable' });
  }
});

app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That image is too large.' });
  }
  if (err?.message?.includes('is not allowed')) {
    return res.status(403).json({ error: err.message });
  }
  if (err?.message?.startsWith('Only JPEG')) {
    return res.status(415).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on our side.' });
});

async function start() {
  await migrate();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Carterlane API listening on ${PORT}`);
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`${signal} received, shutting down.`);
      server.close(() => pool.end().then(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
