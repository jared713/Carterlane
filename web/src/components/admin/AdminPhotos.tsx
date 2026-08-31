'use client';

import { useCallback, useRef, useState } from 'react';
import { adminRequest, assetUrl } from '@/lib/api';
import { useLoader } from '@/lib/useLoader';
import type { AdminPhoto } from '@/lib/types';
import { handleError, type PanelProps } from './shared';

function readableSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Upload, caption, reorder and delete the photographs of the flat. */
export function AdminPhotos({ onExpired }: PanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetcher = useCallback(() => {
    setError(null);
    return adminRequest<AdminPhoto[]>('/photos');
  }, []);

  const onError = useCallback(
    (err: unknown) => setError(handleError(err, onExpired)),
    [onExpired],
  );

  const { data, setData, reload } = useLoader(fetcher, onError);
  const photos = data ?? [];
  const setPhotos = setData;

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        for (const file of list) form.append('photos', file);
        await adminRequest('/photos', { method: 'POST', body: form });
        await reload();
      } catch (err) {
        onError(err);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [reload, onError],
  );

  async function move(photo: AdminPhoto, delta: number) {
    const index = photos.findIndex((p) => p.id === photo.id);
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setPhotos(reordered);
    try {
      await adminRequest('/photos/reorder', {
        method: 'POST',
        body: JSON.stringify({ order: reordered.map((p) => p.id) }),
      });
    } catch (err) {
      onError(err);
      await reload();
    }
  }

  async function saveCaption(photo: AdminPhoto, caption: string) {
    if (caption === photo.caption) return;
    try {
      await adminRequest(`/photos/${photo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption }),
      });
      setPhotos((current) =>
        (current ?? []).map((p) => (p.id === photo.id ? { ...p, caption } : p)),
      );
    } catch (err) {
      onError(err);
    }
  }

  async function remove(photo: AdminPhoto) {
    if (!window.confirm(`Delete ${photo.filename}? This cannot be undone.`)) return;
    try {
      await adminRequest(`/photos/${photo.id}`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      onError(err);
    }
  }

  return (
    <div className="space-y-8">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          upload(event.dataTransfer.files);
        }}
        className={[
          'rounded-2xl border-2 border-dashed px-6 py-12 text-center transition',
          dragOver ? 'border-brass bg-stone-50' : 'border-stone-300 bg-white/60',
        ].join(' ')}
      >
        <p className="font-display text-lg">Drop photographs here</p>
        <p className="mt-1.5 text-sm text-stone-500">
          Straight from a phone or camera — JPEG, PNG, HEIC and the rest. They are
          resized and converted for the web automatically.
        </p>
        <input
          ref={inputRef}
          type="file"
          // Anything a phone or camera produces. The API is the real gate,
          // and it says clearly what it will not take.
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => event.target.files && upload(event.target.files)}
        />
        <button
          type="button"
          className="btn-secondary mt-5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Choose files'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <p className="text-center text-sm text-stone-500">
          No photographs yet. The first one becomes the large image in the gallery.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(photo.url)}
                alt={photo.caption || photo.filename}
                className="h-48 w-full bg-stone-100 object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>
                    {index === 0 ? 'Lead photograph' : `Position ${index + 1}`}
                    {photo.width ? ` · ${photo.width}×${photo.height}` : ''}
                  </span>
                  <span>{readableSize(photo.byte_size)}</span>
                </div>
                <label className="sr-only" htmlFor={`caption-${photo.id}`}>
                  Caption
                </label>
                <input
                  id={`caption-${photo.id}`}
                  className="field mt-3 text-sm"
                  placeholder="Add a caption"
                  defaultValue={photo.caption}
                  onBlur={(event) => saveCaption(photo, event.target.value.trim())}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5 text-xs"
                      disabled={index === 0}
                      onClick={() => move(photo, -1)}
                      aria-label="Move earlier"
                    >
                      <span aria-hidden>&larr;</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5 text-xs"
                      disabled={index === photos.length - 1}
                      onClick={() => move(photo, 1)}
                      aria-label="Move later"
                    >
                      <span aria-hidden>&rarr;</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-stone-500 underline hover:text-red-700"
                    onClick={() => remove(photo)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
