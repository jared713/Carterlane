/**
 * The house mark: C and L set in the display serif inside a hairline rule.
 *
 * Everything is drawn in `currentColor`, because the mark sits on the dark
 * video at the top of the page and on pale stone once you scroll, and it has
 * to hold on both without a second asset. The rule is laid behind the letters
 * rather than on the same element so it can be softened to a hairline while
 * the letters stay at full strength — a faded border with faded letters reads
 * as washed out, not delicate.
 */
export function Monogram({ name }: { name: string }) {
  return (
    <span
      role="img"
      aria-label={name}
      // 44px square: the smallest comfortable tap target, and this mark is the
      // only thing in the header a thumb aims for on the way back to the top.
      className="relative inline-flex h-11 w-11 items-center justify-center"
    >
      <span aria-hidden className="absolute inset-0 border border-current opacity-30" />
      <span
        aria-hidden
        className="flex items-baseline font-display text-[1.15rem] font-light leading-none sm:text-[1.25rem]"
      >
        <span>C</span>
        {/* Tucked close enough to read as one mark, clear of the C's terminal.
            Any tighter and the two strokes merge into a smudge at header size. */}
        <span className="-ml-[0.06em]">L</span>
      </span>
    </span>
  );
}
