/**
 * Brokerage Google reviews are not split per broker. A review that names a
 * DIFFERENT broker reads as misattributed on this page, so keep only reviews
 * that name THIS broker or name no broker at all (CLAUDE.md section 0).
 */

const BROKER_FIRST_NAMES = ['matt', 'rebecca', 'paul'] as const

export function namesBroker(text: string, firstName: string): boolean {
  const fn = firstName.trim().toLowerCase()
  if (!fn) return false
  return new RegExp(`\\b${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text.toLowerCase())
}

export function reviewBelongsOnPage(text: string, firstName: string): boolean {
  if (namesBroker(text, firstName)) return true
  const me = firstName.trim().toLowerCase()
  return !BROKER_FIRST_NAMES.some((n) => n !== me && namesBroker(text, n))
}
