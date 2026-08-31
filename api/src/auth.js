import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const TOKEN_TTL = process.env.SESSION_TTL || '12h';

// Hash the plaintext password once at boot so every login attempt costs the
// same regardless of whether the submitted password is close to correct.
const RESOLVED_HASH =
  ADMIN_PASSWORD_HASH || (ADMIN_PASSWORD ? bcrypt.hashSync(ADMIN_PASSWORD, 10) : null);

export function authConfigured() {
  return Boolean(SESSION_SECRET && (ADMIN_PASSWORD || ADMIN_PASSWORD_HASH));
}

/** Constant-time-ish comparison so a wrong password leaks no timing signal. */
export async function verifyPassword(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  if (!RESOLVED_HASH) return false;
  return bcrypt.compare(candidate, RESOLVED_HASH);
}

export function issueToken() {
  return jwt.sign({ role: 'admin' }, SESSION_SECRET, { expiresIn: TOKEN_TTL });
}

export function requireAdmin(req, res, next) {
  if (!authConfigured()) {
    return res.status(503).json({
      error: 'Admin access is not configured. Set SESSION_SECRET and ADMIN_PASSWORD.',
    });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    if (payload.role !== 'admin') throw new Error('wrong role');
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}
