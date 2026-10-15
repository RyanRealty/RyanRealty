import type { PpsfBand } from '@/components/search/ppsf-band'

/**
 * Visible comparison sentence for a search card.
 * Numbers are the same band the pins and the rail already share (SITE-44).
 *
 * UX review F13 (2026-10-15): "$422/sqft · middle half of 436 on this map"
 * repeated the facts line's $/sqft and read as jargon. Say it plainly; the
 * exact band stays in the hover / screen-reader label (ppsf-band bandLabel).
 */
export function bandReadout(band: PpsfBand, value: number | null): string {
  const set = `${band.n.toLocaleString('en-US')} homes on this map`
  if (value == null || !(value > 0)) return 'No living area reported'
  if (value < band.q1) return `Lower $/sqft than most of ${set}`
  if (value > band.q3) return `Higher $/sqft than most of ${set}`
  return `Typical $/sqft for ${set}`
}
