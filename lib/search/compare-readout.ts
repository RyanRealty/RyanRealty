import type { PpsfBand } from '@/components/search/ppsf-band'

/**
 * Visible comparison sentence for a search card.
 * Numbers are the same band the pins and the rail already share (SITE-44).
 */
export function bandReadout(band: PpsfBand, value: number | null): string {
  const set = `${band.n.toLocaleString('en-US')} on this map`
  if (value == null || !(value > 0)) return `No living area vs ${set}`
  const dollars = `$${Math.round(value).toLocaleString('en-US')}/sqft`
  if (value < band.q1) return `${dollars} · below middle half of ${set}`
  if (value > band.q3) return `${dollars} · above middle half of ${set}`
  return `${dollars} · middle half of ${set}`
}
