import type {
  Availability,
  BookingConfirmation,
  Photo,
  Property,
  Quote,
} from './types';

/** Railway API base, e.g. https://carterlane-api.up.railway.app */
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
).replace(/\/$/, '');

/** Photo URLs come back relative to the API host. */
export function assetUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(message: string, status: number, details?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type FetchOptions = RequestInit & { revalidate?: number; timeoutMs?: number };

/**
 * A page that renders without its data beats a page that never renders at all,
 * so every request gives up rather than waiting on Node's 300-second default.
 * A Railway service waking from idle is the case that matters: the home page
 * falls back to its built-in copy instead of hanging until the browser gives up.
 */
const DEFAULT_TIMEOUT_MS = 8_000;

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      // Availability and prices change; never serve a stale calendar.
      ...(revalidate === undefined ? { cache: 'no-store' } : { next: { revalidate } }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(`The booking service did not respond in time.`, 504);
    }
    throw new ApiError('The booking service could not be reached.', 503);
  }

  const text = await res.text();

  let body: { error?: string; details?: { field: string; message: string }[] } | null =
    null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Anything that is not our API — a proxy error page, a hosting platform's
    // "host not found" — lands here. Say what actually came back rather than
    // reporting a JSON syntax error against an unknown responder.
    throw new ApiError(
      `Expected JSON from the booking service but got ${res.status}: ` +
        `${text.slice(0, 120).replace(/\s+/g, ' ').trim()}`,
      res.status,
    );
  }

  if (!res.ok) {
    throw new ApiError(
      body?.error || `Request failed (${res.status})`,
      res.status,
      body?.details,
    );
  }
  return body as T;
}

/**
 * Rendering the page and interacting with it want different patience. These
 * two back page content that has a sensible fallback, so they give up quickly;
 * the quote and booking calls a guest is waiting on are allowed far longer.
 */
const RENDER_TIMEOUT_MS = 4_000;

export function getProperty() {
  return request<Property>('/api/property', {
    revalidate: 60,
    timeoutMs: RENDER_TIMEOUT_MS,
  });
}

export function getPhotos() {
  return request<Photo[]>('/api/photos', {
    revalidate: 60,
    timeoutMs: RENDER_TIMEOUT_MS,
  });
}

/**
 * Live by default, for the calendar a guest is actually clicking on. The home
 * page passes a revalidate window instead, because it only needs the rate
 * rules for the season table — so rendering never waits on a live call.
 */
export function getAvailability(
  from: string,
  to: string,
  options: { revalidate?: number; timeoutMs?: number } = {},
) {
  return request<Availability>(
    `/api/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    options,
  );
}

export function getQuote(checkIn: string, checkOut: string, guests: number) {
  return request<Quote>(
    `/api/quote?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
  );
}

export function createBooking(payload: {
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  website?: string;
}) {
  return request<BookingConfirmation>('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // Worth waiting on: a guest who gives up mid-request may submit twice.
    timeoutMs: 25_000,
  });
}

/* -------------------------------------------------------------- admin API */

const TOKEN_KEY = 'carterlane.admin.token';

export const adminToken = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = adminToken.get();
  const isFormData = options.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/admin${path}`, {
      ...options,
      cache: 'no-store',
      // Photo uploads are megabytes over a domestic connection; the rest is JSON.
      signal: options.signal ?? AbortSignal.timeout(isFormData ? 120_000 : 20_000),
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('That took too long. Check your connection and try again.', 504);
    }
    throw new ApiError('Could not reach the booking service.', 503);
  }

  if (res.status === 401) {
    adminToken.clear();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.details);
  }
  return body as T;
}

export async function adminLogin(password: string) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError('Could not reach the booking service. Try again shortly.', 503);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error || 'Sign-in failed.', res.status);
  adminToken.set(body.token);
  return body.token as string;
}
