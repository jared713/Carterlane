'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Falls back to /media/st-pauls.mp4 in the public folder. */
  src?: string;
  /**
   * A still to hold the frame until the video paints. Optional, and best left
   * unset unless it is a frame of the video itself: anything else announces
   * itself as a placeholder in the second before the footage arrives.
   */
  poster?: string;
  children: React.ReactNode;
};

/**
 * Full-bleed motion backdrop of St Paul's. The video is decorative: it is
 * muted, loops, carries no audio track, and is skipped entirely for anyone who
 * has asked for reduced motion or whose connection is slow — they get the dark
 * ground the section already sits on, which the headline is set against in any
 * case, so nothing is lost but the movement.
 */
export function HeroVideo({ src, poster, children }: Props) {
  const videoSrc = src || process.env.NEXT_PUBLIC_HERO_VIDEO_URL || '/media/st-pauls.mp4';

  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Some browsers expose the connection type; skip the video on slow links.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saveData = connection?.saveData === true;
    const slow = connection?.effectiveType ? /2g/.test(connection.effectiveType) : false;

    const apply = () => setShowVideo(!reduced.matches && !saveData && !slow);
    apply();
    reduced.addEventListener('change', apply);
    return () => reduced.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!showVideo) return;
    const video = videoRef.current;
    if (!video) return;
    // Autoplay can still be refused; the dark ground behind stays visible.
    video.play().catch(() => undefined);
  }, [showVideo]);

  return (
    <section className="relative isolate flex min-h-[92svh] items-end overflow-hidden bg-ink">
      {poster && (
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}

      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 -z-10 h-full w-full animate-fade-in object-cover"
          {...(poster ? { poster } : {})}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Two gradients: one to seat the text, one to blend into the page below. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-[5] bg-gradient-to-t from-ink/80 via-ink/30 to-ink/40"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-[5] h-24 bg-gradient-to-t from-stone-50 via-stone-50/40 to-transparent"
      />

      <div className="container-page relative z-10 pb-24 pt-40 sm:pb-28">{children}</div>
    </section>
  );
}
