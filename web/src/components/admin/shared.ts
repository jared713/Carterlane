import { ApiError } from '@/lib/api';

export type PanelProps = { onExpired: () => void };

/** Turn any thrown value into a message safe to show the owner. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/** Sign the owner out when the token has expired, otherwise report the error. */
export function handleError(error: unknown, onExpired: () => void): string {
  if (error instanceof ApiError && error.status === 401) {
    onExpired();
    return 'Your session expired. Please sign in again.';
  }
  return messageFor(error);
}
