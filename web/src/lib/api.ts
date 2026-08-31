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

type FetchOptions = RequestInit & { revalidate?: number };

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate, ...init } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    // Availability and prices change; never serve a stale calendar.
    ...(revalidate === undefined ? { cache: 'no-store' } : { next: { revalidate } }),
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(
      body?.error || `Request failed (${res.status})`,
      res.status,
      body?.details,
    );
  }
  return body as T;
}

export function getProperty() {
  return request<Property>('/api/property', { revalidate: 60 });
}

export function getPhotos() {
  return request<Photo[]>('/api/photos', { revalidate: 60 });
}

export function getAvailability(from: string, to: string) {
  return request<Availability>(
    `/api/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
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
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

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
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error || 'Sign-in failed.', res.status);
  adminToken.set(body.token);
  return body.token as string;
}
