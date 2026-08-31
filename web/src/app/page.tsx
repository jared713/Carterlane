import { BookingWidget } from '@/components/BookingWidget';
import { Gallery } from '@/components/Gallery';
import { HeroVideo } from '@/components/HeroVideo';
import { RatesTable } from '@/components/RatesTable';
import { SiteHeader } from '@/components/SiteHeader';
import { getAvailability, getPhotos, getProperty } from '@/lib/api';
import { addDays, formatMoney, today } from '@/lib/dates';
import type { Availability, Photo, Property } from '@/lib/types';

// Availability changes with every booking, so nothing here is cached.
export const dynamic = 'force-dynamic';

const FALLBACK: Property = {
  name: 'Carterlane',
  tagline: "A St Paul's view, and a front door of your own.",
  description:
    'A calm, high-ceilinged flat a few minutes from the cathedral steps.',
  address: 'Carter Lane, London EC4',
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 4,
  minNights: 2,
  maxNights: 28,
  baseRate: 185,
  fromRate: 185,
  cleaningFee: 65,
  currency: 'GBP',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  amenities: [],
  contactEmail: '',
  contactPhone: '',
};

export default async function HomePage() {
  // The site must still render if the API is asleep or redeploying.
  const [property, photos, availability] = await Promise.all([
    getProperty().catch(() => FALLBACK),
    getPhotos().catch((): Photo[] => []),
    // Only the season table needs this; the calendar fetches its own live copy.
    getAvailability(today(), addDays(today(), 540), {
      revalidate: 300,
      timeoutMs: 4_000,
    }).catch((): Availability | null => null),
  ]);

  const facts = [
    { label: 'Sleeps', value: `${property.maxGuests}` },
    { label: 'Bedrooms', value: `${property.bedrooms}` },
    { label: 'Bathrooms', value: `${property.bathrooms}` },
    { label: 'Minimum stay', value: `${property.minNights} nights` },
  ];

  return (
    <div id="top">
      <SiteHeader name={property.name} />

      <main>
        <HeroVideo>
          <div className="max-w-3xl">
            <p className="eyebrow animate-fade-up text-stone-300">
              Carter Lane · City of London
            </p>
            <h1 className="heading-xl mt-5 animate-fade-up text-stone-50 [animation-delay:120ms]">
              {property.tagline}
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-stone-200 [animation-delay:240ms]">
              A quiet flat in the shadow of the dome, let directly by the people who
              look after it. From {formatMoney(property.fromRate, property.currency)} a night.
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3 [animation-delay:360ms]">
              <a href="#book" className="btn bg-stone-50 text-ink hover:bg-white">
                Check availability
              </a>
              <a
                href="#gallery"
                className="btn border border-stone-300/50 text-stone-50 hover:bg-stone-50/10"
              >
                See the flat
              </a>
            </div>
          </div>
        </HeroVideo>

        {/* ------------------------------------------------------- the flat */}
        <section id="the-flat" className="container-page scroll-mt-24 py-20 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div>
              <p className="eyebrow">The flat</p>
              <h2 className="heading-lg mt-4">{property.name}</h2>
              <div className="prose-body mt-6 space-y-4">
                {property.description.split('\n').filter(Boolean).map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>

              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-stone-200 pt-8 sm:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-xs uppercase tracking-wider text-stone-500">
                      {fact.label}
                    </dt>
                    <dd className="mt-1.5 font-display text-xl text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {property.amenities.length > 0 && (
              <div className="lg:pt-14">
                <p className="eyebrow">What is here</p>
                <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
                  {property.amenities.map((amenity) => (
                    <li
                      key={amenity}
                      className="flex items-start gap-3 border-b border-stone-100 pb-3 text-[0.95rem] text-stone-700"
                    >
                      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brass" />
                      {amenity}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* -------------------------------------------------------- gallery */}
        <section id="gallery" className="container-page scroll-mt-24 pb-20 sm:pb-28">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Gallery</p>
              <h2 className="heading-lg mt-4">Have a look round.</h2>
            </div>
          </div>
          <Gallery photos={photos} />
        </section>

        {/* --------------------------------------------------------- rates */}
        <section id="rates" className="scroll-mt-24 border-y border-stone-200 bg-white/60 py-20 sm:py-28">
          <div className="container-page">
            <div className="mb-10 max-w-2xl">
              <p className="eyebrow">Rates</p>
              <h2 className="heading-lg mt-4">Straightforward pricing.</h2>
              <p className="prose-body mt-4">
                One nightly rate per season, a single cleaning charge, and nothing added at
                checkout. Longer stays and last-minute gaps are often negotiable — just ask.
              </p>
            </div>
            <RatesTable property={property} rates={availability?.rates ?? []} />
          </div>
        </section>

        {/* ---------------------------------------------------------- book */}
        <section id="book" className="container-page scroll-mt-24 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="eyebrow">Availability</p>
              <h2 className="heading-lg mt-4">Find your dates.</h2>
              <p className="prose-body mt-5">
                Crossed-out nights are already taken. Choose an arrival and a departure and
                the price appears as you go — no payment is taken here, and nothing is
                confirmed until we reply.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-stone-600">
                <li className="flex gap-3">
                  <span className="text-brass" aria-hidden>1.</span>
                  Pick your nights and send the request.
                </li>
                <li className="flex gap-3">
                  <span className="text-brass" aria-hidden>2.</span>
                  We hold the dates and reply, usually within a day.
                </li>
                <li className="flex gap-3">
                  <span className="text-brass" aria-hidden>3.</span>
                  Payment details and arrival notes come with the confirmation.
                </li>
              </ul>
            </div>
            <BookingWidget property={property} />
          </div>
        </section>

        {/* ------------------------------------------------------ location */}
        <section id="location" className="scroll-mt-24 border-t border-stone-200 bg-white/60 py-20 sm:py-28">
          <div className="container-page grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="eyebrow">Location</p>
              <h2 className="heading-lg mt-4">{property.address}</h2>
              <p className="prose-body mt-5">
                Two minutes from the cathedral, five from the river, and a short walk over
                the Millennium Bridge to Tate Modern and Borough Market. St Paul&rsquo;s and
                Blackfriars stations are both close by, and City Thameslink runs straight to
                Gatwick.
              </p>
              <ul className="mt-8 space-y-2.5 text-sm text-stone-600">
                {[
                  ["St Paul's Cathedral", '3 min walk'],
                  ['Millennium Bridge & Tate Modern', '7 min walk'],
                  ['Blackfriars station', '6 min walk'],
                  ['Borough Market', '15 min walk'],
                ].map(([place, distance]) => (
                  <li key={place} className="flex justify-between border-b border-stone-100 pb-2.5">
                    <span>{place}</span>
                    <span className="text-stone-400">{distance}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <iframe
                title="Map of the area around the flat"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-0.1085%2C51.5100%2C-0.0930%2C51.5175&layer=mapnik&marker=51.5138%2C-0.1007"
                className="h-full min-h-[22rem] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-14">
        <div className="container-page flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="font-display text-xl">{property.name}</p>
            <p className="mt-2 text-sm text-stone-500">{property.address}</p>
          </div>
          <div className="text-sm text-stone-600">
            {property.contactEmail && (
              <p>
                <a className="hover:text-ink" href={`mailto:${property.contactEmail}`}>
                  {property.contactEmail}
                </a>
              </p>
            )}
            {property.contactPhone && <p className="mt-1">{property.contactPhone}</p>}
            <p className="mt-3 text-xs text-stone-400">
              &copy; {new Date().getFullYear()} {property.name}. Booked directly, never
              through an agency.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
