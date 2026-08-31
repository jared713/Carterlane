'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Fetch on mount, and again on demand after a change has been saved.
 *
 * The fetcher and the error handler must be stable (wrap them in useCallback),
 * because a new identity re-runs the request. State is only ever set once the
 * request has resolved, and a result that arrives after the component has gone
 * is discarded.
 */
export function useLoader<T>(
  fetcher: () => Promise<T>,
  onError: (error: unknown) => void,
) {
  const [data, setData] = useState<T | null>(null);

  const run = useCallback(
    (isCurrent: () => boolean) =>
      fetcher().then(
        (result) => {
          if (isCurrent()) setData(result);
        },
        (error) => {
          if (isCurrent()) onError(error);
        },
      ),
    [fetcher, onError],
  );

  useEffect(() => {
    let active = true;
    run(() => active);
    return () => {
      active = false;
    };
  }, [run]);

  const reload = useCallback(() => run(() => true), [run]);

  return { data, setData, reload };
}
