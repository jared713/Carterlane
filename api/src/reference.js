import crypto from 'node:crypto';

// Unambiguous alphabet: no O/0, I/1, so a reference read over the phone survives.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function bookingReference() {
  const bytes = crypto.randomBytes(6);
  const code = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `CL-${code}`;
}
