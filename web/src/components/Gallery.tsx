'use client';

import { useCallback, useEffect, useState } from 'react';
import { assetUrl } from '@/lib/api';
import type { Photo } from '@/lib/types';

/**
 * A mosaic of the flat that opens into a lightbox. Photos come from the API,
 * so the owner can add and reorder them without a redeploy.
 */
export function Gallery({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIndex, close, step]);

  if (!photos.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
        <p className="prose-body">
          Photographs of the flat are on their way. Upload them in the admin area and they
          will appear here.
        </p>
      </div>
    );
  }

  const [lead, ...rest] = photos;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4 sm:grid-rows-2">
        <figure className="group relative overflow-hidden rounded-2xl sm:col-span-2 sm:row-span-2">
          <button
            type="button"
            className="block h-full w-full"
            onClick={() => setOpenIndex(0)}
            aria-label={lead.caption || 'Open photograph'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(lead.url)}
              alt={lead.caption || 'The flat'}
              width={lead.width ?? undefined}
              height={lead.height ?? undefined}
              className="h-full min-h-[18rem] w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </button>
          {lead.caption && (
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 text-sm text-stone-50">
              {lead.caption}
            </figcaption>
          )}
        </figure>

        {rest.slice(0, 4).map((photo, index) => (
          <figure key={photo.id} className="group relative overflow-hidden rounded-2xl">
            <button
              type="button"
              className="block h-full w-full"
              onClick={() => setOpenIndex(index + 1)}
              aria-label={photo.caption || 'Open photograph'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(photo.url)}
                alt={photo.caption || 'The flat'}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                className="h-full min-h-[8.5rem] w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </button>
            {index === 3 && photos.length > 5 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/50 text-sm font-medium text-stone-50">
                +{photos.length - 5} more
              </span>
            )}
          </figure>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photographs of the flat"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4 animate-fade-in"
          onClick={close}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full border border-stone-600 px-4 py-2 text-sm text-stone-100 hover:bg-stone-800"
            onClick={close}
          >
            Close
          </button>
          <button
            type="button"
            className="absolute left-4 rounded-full border border-stone-600 px-3.5 py-2 text-stone-100 hover:bg-stone-800"
            onClick={(event) => {
              event.stopPropagation();
              step(-1);
            }}
            aria-label="Previous photograph"
          >
            <span aria-hidden>&larr;</span>
          </button>
          <figure className="max-h-full" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(photos[openIndex].url)}
              alt={photos[openIndex].caption || 'The flat'}
              className="max-h-[82vh] w-auto rounded-lg object-contain"
            />
            <figcaption className="mt-3 text-center text-sm text-stone-300">
              {photos[openIndex].caption || `${openIndex + 1} of ${photos.length}`}
            </figcaption>
          </figure>
          <button
            type="button"
            className="absolute right-4 rounded-full border border-stone-600 px-3.5 py-2 text-stone-100 hover:bg-stone-800"
            onClick={(event) => {
              event.stopPropagation();
              step(1);
            }}
            aria-label="Next photograph"
          >
            <span aria-hidden>&rarr;</span>
          </button>
        </div>
      )}
    </>
  );
}
