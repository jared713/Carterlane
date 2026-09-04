import { formatMoney, formatShort } from '@/lib/dates';
import type { Property, RateWindow } from '@/lib/types';

/**
 * The seasons the owner has priced, plus the standing rate for every other
 * night, so a guest can see the whole year without opening the calendar.
 */
export function RatesTable({
  property,
  rates,
}: {
  property: Property;
  rates: RateWindow[];
}) {
  const seasons = [...rates].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50/70">
          <tr className="text-xs uppercase tracking-wider text-stone-500">
            <th scope="col" className="px-5 py-3.5 font-medium">Season</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Dates</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Minimum stay</th>
            <th scope="col" className="px-5 py-3.5 text-right font-medium">Per night</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {/* The standing rate: named by the owner, like every other row. It
              cannot simply be dropped — it is what prices any night no season
              covers, so hiding it would leave those nights unadvertised. */}
          <tr>
            <td className="px-5 py-4 text-ink">{property.baseRateLabel}</td>
            <td className="px-5 py-4 text-stone-600">{property.baseRateNote}</td>
            <td className="px-5 py-4 text-stone-600">{property.minNights} nights</td>
            <td className="px-5 py-4 text-right font-medium text-ink">
              {formatMoney(property.baseRate, property.currency)}
            </td>
          </tr>
          {seasons.map((season) => (
            <tr key={season.id}>
              <td className="px-5 py-4 text-ink">{season.name}</td>
              <td className="px-5 py-4 text-stone-600">
                {formatShort(season.start)} &ndash; {formatShort(season.end)}
              </td>
              <td className="px-5 py-4 text-stone-600">
                {season.minNights ?? property.minNights} nights
              </td>
              <td className="px-5 py-4 text-right font-medium text-ink">
                {formatMoney(season.nightlyRate, property.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-stone-200 bg-stone-50/70 px-5 py-3.5 text-xs text-stone-500">
        A one-off cleaning charge of {formatMoney(property.cleaningFee, property.currency)} is
        added to every stay. No booking fees, no commission — you book directly with us.
      </p>
    </div>
  );
}
