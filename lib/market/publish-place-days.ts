/**
 * One published days-to-pending figure on a place page.
 *
 * Pulse medians are true medians (`percentile_cont`). An even set lands on
 * .5. Rounding that to an integer on the market card while the hero and FAQ
 * print 39.5 is two numbers for one pulse.
 *
 * Founding case: /communities/black-butte-ranch card 40 days vs FAQ 39.5
 * (fleet 5b1120c4e25c70f0b99e75b956370319). Same class on NorthWest Crossing
 * 11 vs 10.5, Broken Top 9 vs 8.5, Brasada 16 vs 15.5, Redmond 20 vs 19.5,
 * Larkspur 7 vs 6.5.
 *
 * Publish the pulse value at one decimal. Do not invent a second integer.
 * Whole days stay whole ("19 days"). Half days stay half ("39.5 days").
 */

export function publishPlaceDays(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 10) / 10
}

export function formatPlaceDaysNumber(value: number): string {
  const published = publishPlaceDays(value)
  if (published == null) return ''
  return Number.isInteger(published) ? String(published) : published.toFixed(1)
}

export function formatPlaceDays(value: number): string {
  const published = publishPlaceDays(value)
  if (published == null) return ''
  const unit = published === 1 ? 'day' : 'days'
  return `${formatPlaceDaysNumber(published)} ${unit}`
}
