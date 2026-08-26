/**
 * Canonical whole-number formatting.
 *
 * A count is a figure, so it gets grouped the same way everywhere: 3,655 homes,
 * not 3655 in one sentence and 3,655 in the next. The rule lives here rather
 * than in the component that prints the sentence, because components/site/v3
 * is format-free by law (components/site/v3/index.ts, ci:public-v3 rule 3):
 * every figure arrives already formatted so the string on screen is the string
 * the caller's source trace covers.
 */
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "3655" reads as "3,655". A non-finite value has no honest rendering, so it prints nothing. */
export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return GROUPED.format(Math.round(n))
}
