/**
 * The house mark: C and L inside an open ring, with a rule through its open corner.
 *
 * Drawn in `currentColor` so a single element can hold on the dark video at
 * the top of the page and on pale stone once the header settles — the caller
 * chooses the tone, and nothing here needs a second asset.
 *
 * The ring is deliberately not a circle: its radius wavers by about a percent
 * and it stops short of closing, which is what keeps it from reading as a
 * border. The gap at the lower left is where the rule crosses.
 */

const RING =
  'M29.70 77.49 C30.23 77.81 31.78 78.83 32.87 79.41 C33.95 79.99 35.08 80.51 36.22 80.97 C37.36 81.42 38.53 81.82 39.71 82.15 C40.89 82.48 42.10 82.74 43.30 82.94 C44.51 83.15 45.73 83.28 46.95 83.36 C48.17 83.43 49.39 83.44 50.61 83.38 C51.82 83.33 53.04 83.21 54.24 83.04 C55.44 82.86 56.64 82.62 57.81 82.32 C58.98 82.03 60.14 81.67 61.28 81.26 C62.42 80.85 63.54 80.38 64.62 79.86 C65.71 79.34 66.78 78.77 67.81 78.14 C68.84 77.52 69.85 76.84 70.81 76.12 C71.78 75.40 72.71 74.63 73.60 73.81 C74.49 73.00 75.35 72.14 76.16 71.24 C76.96 70.34 77.73 69.40 78.45 68.42 C79.16 67.44 79.83 66.42 80.45 65.38 C81.06 64.33 81.63 63.25 82.13 62.14 C82.64 61.03 83.09 59.89 83.48 58.73 C83.87 57.58 84.20 56.39 84.46 55.20 C84.73 54.00 84.93 52.79 85.07 51.57 C85.20 50.35 85.27 49.11 85.28 47.88 C85.28 46.65 85.22 45.42 85.09 44.19 C84.95 42.97 84.75 41.74 84.49 40.54 C84.22 39.33 83.89 38.14 83.49 36.97 C83.09 35.80 82.62 34.65 82.10 33.53 C81.57 32.42 80.98 31.32 80.34 30.27 C79.69 29.22 78.98 28.20 78.23 27.23 C77.47 26.26 76.66 25.32 75.80 24.44 C74.94 23.56 74.03 22.72 73.09 21.94 C72.14 21.16 71.15 20.42 70.13 19.75 C69.11 19.07 68.05 18.45 66.97 17.89 C65.88 17.33 64.77 16.82 63.64 16.38 C62.50 15.93 61.34 15.54 60.18 15.22 C59.01 14.89 57.82 14.62 56.63 14.42 C55.43 14.21 54.23 14.06 53.02 13.98 C51.82 13.89 50.60 13.87 49.40 13.90 C48.19 13.93 46.98 14.02 45.79 14.17 C44.59 14.33 43.40 14.54 42.22 14.80 C41.05 15.07 39.88 15.40 38.73 15.78 C37.59 16.16 36.46 16.60 35.35 17.09 C34.25 17.59 33.17 18.14 32.12 18.74 C31.07 19.34 30.04 20.00 29.05 20.70 C28.07 21.41 27.11 22.17 26.20 22.98 C25.29 23.78 24.41 24.64 23.59 25.54 C22.76 26.44 21.98 27.39 21.25 28.37 C20.52 29.35 19.84 30.38 19.22 31.44 C18.60 32.50 18.03 33.60 17.53 34.72 C17.02 35.84 16.58 36.99 16.20 38.17 C15.82 39.34 15.51 40.54 15.26 41.75 C15.01 42.95 14.83 44.18 14.72 45.41 C14.61 46.64 14.56 47.88 14.59 49.12 C14.61 50.35 14.82 52.20 14.87 52.81';

// A single rule crossing the ring's open corner, in place of any ornament.
// It sits on the mid-point of the missing arc and runs out past the ring, so
// it reads as a line passing through the mark rather than propping it up.
const RULE = 'M4 66.5 H31';

export function Monogram({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={name}
      fill="none"
      stroke="currentColor"
    >
      {/* Ring and foliage are hairlines; the letters carry the weight. */}
      <path d={RING} strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
      <path d={RULE} strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />

      {/* Sized to cross the ring without breaking out of it, and set a little
          left of centre, against the open corner on that side. */}
      <text
        x="48.5"
        y="63.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="39"
        fontWeight="300"
        letterSpacing="-0.5"
      >
        CL
      </text>
    </svg>
  );
}
