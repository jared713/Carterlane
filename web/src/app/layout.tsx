import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://carterlane.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Carterlane — a St Paul's view in the City of London",
    template: '%s · Carterlane',
  },
  description:
    "A quiet one-bedroom flat a few minutes from the steps of St Paul's Cathedral. " +
    'Check availability and book directly with the owner.',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: siteUrl,
    siteName: 'Carterlane',
    title: "Carterlane — a St Paul's view in the City of London",
    description:
      "A quiet one-bedroom flat a few minutes from the steps of St Paul's Cathedral.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans">
        <a
          href="#book"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-2 focus:text-sm focus:text-stone-50"
        >
          Skip to booking
        </a>
        {children}
      </body>
    </html>
  );
}
