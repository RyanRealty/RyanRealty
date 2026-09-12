/**
 * Cover owns the recommend dollars. Method / net / clamp copy may point at
 * "that price" instead of reprinting the figure (Matt lock / Cos Falcon
 * follow-up 2026-09-12).
 *
 * Apply only off the photo. Sold/comp prices, failed asks, and worth-range
 * figures are not the recommend echo and stay as written.
 */

import { usd } from '@/lib/cma/render-blocks'

export const THAT_PRICE = 'that price'

/** True when `n` is the same mark as the recommended list (exact or 1k-round). */
export function isRecommendMark(n: number, recommended: number): boolean {
  if (!(recommended > 0) || !(n > 0) || !Number.isFinite(n) || !Number.isFinite(recommended)) {
    return false
  }
  if (Math.round(n) === Math.round(recommended)) return true
  return Math.round(n / 1000) * 1000 === Math.round(recommended / 1000) * 1000
}

/** Dollar strings a letter may reprint for this recommend. Longest first. */
export function recommendUsdForms(recommended: number): string[] {
  if (!(recommended > 0) || !Number.isFinite(recommended)) return []
  const exact = Math.round(recommended)
  const r1k = Math.round(recommended / 1000) * 1000
  const k = Math.round(recommended / 1000)
  const forms = [usd(exact), `$${exact.toLocaleString('en-US')}`, `$${exact}`]
  if (r1k !== exact) {
    forms.push(usd(r1k), `$${r1k.toLocaleString('en-US')}`, `$${r1k}`)
  }
  if (k > 0) {
    forms.push(`$${k}k`, `$${k}K`)
  }
  return [...new Set(forms.filter((f) => f && f !== '—'))].sort((a, b) => b.length - a.length)
}

/**
 * Replace recommend-dollar reprints in method / net / clamp prose.
 * Does not touch cover copy — callers apply this off the photo.
 */
export function deRepeatRecommendDollars(
  text: string,
  recommended: number,
  phrase: string = THAT_PRICE,
): string {
  if (!text || !(recommended > 0)) return text
  let out = text
  for (const form of recommendUsdForms(recommended)) {
    out = out.split(form).join(phrase)
  }
  // "From a $565,000 list" → "From a that price list" → "From that price"
  out = out.replace(/\bFrom an? that price list\b/gi, 'From that price')
  return out
}
