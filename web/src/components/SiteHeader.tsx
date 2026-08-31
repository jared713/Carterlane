'use client';

import { useEffect, useState } from 'react';
import { Monogram } from './Monogram';

const LINKS = [
  { href: '#the-flat', label: 'The flat' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#rates', label: 'Rates' },
  { href: '#location', label: 'Location' },
];

export function SiteHeader({ name }: { name: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-40 transition duration-500',
        scrolled
          ? 'border-b border-stone-200 bg-stone-50/90 backdrop-blur'
          : 'border-b border-transparent',
      ].join(' ')}
    >
      <div className="container-page flex h-16 items-center justify-between sm:h-20">
        <a
          href="#top"
          aria-label={`${name} — back to the top`}
          className={[
            'transition-colors',
            scrolled ? 'text-ink' : 'text-stone-50',
          ].join(' ')}
        >
          <Monogram name={name} />
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={[
                'text-sm transition-colors',
                scrolled ? 'text-stone-600 hover:text-ink' : 'text-stone-200 hover:text-white',
              ].join(' ')}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="#book"
          className={[
            'btn !px-5 !py-2 text-sm',
            scrolled
              ? 'bg-ink text-stone-50 hover:bg-stone-800'
              : 'border border-stone-200/60 text-stone-50 hover:bg-stone-50/10',
          ].join(' ')}
        >
          Check dates
        </a>
      </div>
    </header>
  );
}
