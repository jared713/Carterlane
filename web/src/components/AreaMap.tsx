/**
 * A drawn map of the few streets that matter, rather than an embedded one.
 *
 * A live map invites panning and zooming, which is not the question this
 * section answers. A guest wants to know roughly where the flat sits and what
 * is within walking distance, and six landmarks say that better than the whole
 * of London does. Being inline SVG it loads with the page, asks nothing of a
 * third party, and takes the site's own colours.
 *
 * The geography is simplified but not invented: the river, the cathedral, the
 * three bridges and the flat sit in their true relationship to one another.
 */

/** North bank of the Thames, west to east. */
const NORTH_BANK = 'M-20 372 C 120 384, 220 396, 320 408 S 560 432, 820 452';
/** South bank, the same curve dropped by the width of the river. */
const SOUTH_BANK = 'M-20 434 C 120 446, 220 458, 320 470 S 560 494, 820 514';

export function AreaMap({ propertyName }: { propertyName: string }) {
  return (
    <svg
      viewBox="0 0 800 600"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby="area-map-title area-map-desc"
    >
      <title id="area-map-title">The area around {propertyName}</title>
      <desc id="area-map-desc">
        A simplified map of this part of the City of London. The flat sits on
        Carter Lane, a few minutes south-west of St Paul&rsquo;s Cathedral. The
        River Thames runs across the south, crossed by Blackfriars Bridge to the
        west, the Millennium Bridge footbridge leading straight to Tate Modern,
        and Southwark Bridge to the east. Borough Market lies beyond, to the
        south-east.
      </desc>

      <defs>
        <linearGradient id="thames" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ccd8dc" />
          <stop offset="100%" stopColor="#b6c5cb" />
        </linearGradient>
        <clipPath id="northOfRiver">
          <path d={`${NORTH_BANK} L 820 -20 L -20 -20 Z`} />
        </clipPath>
        <clipPath id="southOfRiver">
          <path d={`${SOUTH_BANK} L 820 620 L -20 620 Z`} />
        </clipPath>
      </defs>

      <rect width="800" height="600" fill="#f3efe7" />

      {/* City blocks, clipped to the land so none of them float on the water. */}
      <g clipPath="url(#northOfRiver)" fill="#e7e0d2">
        <rect x="30" y="54" width="146" height="96" rx="4" />
        <rect x="238" y="46" width="132" height="88" rx="4" />
        <rect x="470" y="52" width="158" height="94" rx="4" />
        <rect x="654" y="64" width="126" height="112" rx="4" />
        <rect x="34" y="222" width="134" height="94" rx="4" />
        <rect x="238" y="290" width="122" height="76" rx="4" />
        <rect x="500" y="212" width="152" height="98" rx="4" />
        <rect x="676" y="228" width="104" height="104" rx="4" />
        <rect x="430" y="300" width="128" height="70" rx="4" />
        <rect x="60" y="348" width="118" height="70" rx="4" />
        <rect x="606" y="352" width="140" height="76" rx="4" />
      </g>
      <g clipPath="url(#southOfRiver)" fill="#e7e0d2">
        <rect x="40" y="470" width="150" height="90" rx="4" />
        <rect x="220" y="500" width="120" height="80" rx="4" />
        <rect x="500" y="520" width="96" height="76" rx="4" />
        <rect x="720" y="540" width="110" height="70" rx="4" />
      </g>

      {/* Streets */}
      <g stroke="#d3c7b1" strokeWidth="9" strokeLinecap="round" fill="none">
        {/* New Bridge Street, north to Blackfriars */}
        <path d="M212 34 V 384" />
        {/* Peter's Hill, cathedral down to the footbridge */}
        <path d="M430 208 V 416" />
        {/* Queen Victoria Street, cutting diagonally towards the river */}
        <path d="M110 300 Q 330 316 470 356 T 786 424" />
      </g>
      <g stroke="#cdc0a8" strokeWidth="10" strokeLinecap="round" fill="none">
        {/* Ludgate Hill into Cannon Street, the spine past the cathedral */}
        <path d="M-10 196 H 300 Q 380 196 440 206 H 810" />
      </g>
      <g stroke="#d3c7b1" strokeWidth="7" strokeLinecap="round" fill="none">
        {/* Carter Lane */}
        <path d="M182 254 H 300 Q 350 254 392 246 H 452" />
      </g>

      {/* The Thames */}
      <path
        d={`${NORTH_BANK} L 820 514 C 560 494, 560 494, 320 470 S 120 446, -20 434 Z`}
        fill="url(#thames)"
      />
      <path d={NORTH_BANK} fill="none" stroke="#a4b4ba" strokeWidth="1.5" />
      <path d={SOUTH_BANK} fill="none" stroke="#a4b4ba" strokeWidth="1.5" />

      {/* Bridges. The Millennium is a footbridge, so it is drawn finer. */}
      <g stroke="#9a8a6e" strokeWidth="7" strokeLinecap="butt" fill="none">
        <path d="M212 384 L 218 446" />
        <path d="M596 434 L 602 496" />
      </g>
      <g stroke="#9a8a6e" strokeWidth="3.5" strokeLinecap="butt" fill="none">
        <path d="M430 414 L 436 476" />
      </g>

      {/* Tate Modern, with its chimney */}
      <g fill="#cfc2aa">
        <rect x="368" y="492" width="140" height="54" rx="3" />
        <rect x="424" y="450" width="18" height="46" rx="2" />
      </g>

      {/* Borough Market */}
      <rect x="612" y="530" width="120" height="48" rx="3" fill="#cfc2aa" />

      {/* St Paul's, in elevation so it reads at a glance */}
      <g transform="translate(430 168)" fill="#b09a78">
        <rect x="-52" y="12" width="104" height="30" rx="3" />
        <rect x="-44" y="-20" width="88" height="34" rx="2" />
        <path d="M-33 -20 A 33 38 0 0 1 33 -20 Z" />
        <rect x="-6" y="-72" width="12" height="20" rx="1.5" />
        <circle cx="0" cy="-76" r="7" />
        <rect x="-38" y="-8" width="10" height="22" rx="1" />
        <rect x="28" y="-8" width="10" height="22" rx="1" />
      </g>

      {/* The flat, named by its street since nothing else labels it */}
      <text
        x="300"
        y="222"
        textAnchor="middle"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontSize="19"
        fontWeight="500"
        fill="#8a6d2e"
      >
        Carter Lane
      </text>
      <g transform="translate(300 250)">
        <circle r="21" fill="#a8853f" opacity="0.14" />
        <circle r="10" fill="#a8853f" />
        <circle r="3.4" fill="#f3efe7" />
      </g>

      {/* Labels */}
      <g fontFamily="var(--font-display), Georgia, serif" fill="#413a2d">
        <text x="430" y="70" textAnchor="middle" fontSize="28">
          St Paul&rsquo;s Cathedral
        </text>
        <text x="438" y="576" textAnchor="middle" fontSize="24" fill="#5f523d">
          Tate Modern
        </text>
        <text x="672" y="516" textAnchor="middle" fontSize="24" fill="#5f523d">
          Borough Market
        </text>
      </g>

      <text
        x="150"
        y="428"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="26"
        fill="#71858c"
        letterSpacing="1"
      >
        River Thames
      </text>

      <g
        className="hidden sm:block"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fill="#8a7959"
        fontSize="17"
      >
        <text x="212" y="358" textAnchor="middle">
          Blackfriars
        </text>
        <text x="452" y="452">
          Millennium Bridge
        </text>
        <text x="612" y="424">
          Southwark Bridge
        </text>
      </g>

      {/* North */}
      <g transform="translate(752 84)" fill="#a3906c">
        <path d="M0 -24 L 7.5 7 L 0 1.5 L -7.5 7 Z" />
        <text
          x="0"
          y="28"
          textAnchor="middle"
          fontSize="13"
          fontFamily="var(--font-sans), system-ui, sans-serif"
          letterSpacing="2"
        >
          N
        </text>
      </g>
    </svg>
  );
}
