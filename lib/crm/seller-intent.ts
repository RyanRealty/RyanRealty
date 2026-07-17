/**
 * Seller-intent detection for inbound lead messages (admin-rebuild v2, D8).
 *
 * Two pure helpers used by the CMA litmus path:
 *   - hasSellerIntent(text): does an inbound message read like a home-value /
 *     CMA request? Drives the `?intent=cma` deep link on the new-lead broker
 *     alert so the notification lands the broker one tap from the kick-off.
 *   - extractAddressCandidate(text): best-effort street-address pull from a
 *     free-text message ("what's my home at 123 Delaware Ave in Bend worth")
 *     to pre-fill the kick-off form. Conservative by design — a null just
 *     means the broker types/edits the address; a WRONG guess is worse than
 *     none, so the pattern requires a street number + a street-type word.
 *     The broker always confirms the field before the build fires.
 */

const STREET_TYPES = [
  'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln',
  'court', 'ct', 'way', 'place', 'pl', 'loop', 'boulevard', 'blvd', 'circle',
  'cir', 'terrace', 'ter', 'highway', 'hwy', 'parkway', 'pkwy', 'alley', 'aly',
  'trail', 'trl', 'crossing', 'xing',
]

const SELLER_INTENT_RE =
  /\b(worth|value|valuation|valuate|cma|apprais\w*|market analysis|home.?value|sell (?:my|our) (?:house|home|place|property)|list (?:my|our) (?:house|home|property))\b/i

/** Words that can trail a city capture but are never part of a city name. */
const CITY_STOP_WORDS = new Set([
  'worth', 'value', 'valued', 'going', 'sell', 'selling', 'for', 'today',
  'now', 'please', 'thanks', 'or', 'oregon',
])

export function hasSellerIntent(text: string | null | undefined): boolean {
  if (!text) return false
  return SELLER_INTENT_RE.test(text)
}

/**
 * Pull "123 Delaware Ave" (+ optional ", Bend" / "in Bend") out of free text.
 * Returns "123 Delaware Ave, Bend" style, or null when no confident match.
 */
export function extractAddressCandidate(text: string | null | undefined): string | null {
  if (!text) return null
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  const streetRe = new RegExp(
    String.raw`\b(\d{1,6})\s+((?:[A-Za-z0-9.'-]+\s+){0,4}?(?:${STREET_TYPES.join('|')}))\.?\b`,
    'i',
  )
  const m = streetRe.exec(cleaned)
  if (!m) return null
  const street = `${m[1]} ${m[2].replace(/\s+/g, ' ').trim()}`

  // Optional city, only when explicitly marked with a comma or " in ".
  const rest = cleaned.slice(m.index + m[0].length)
  const cityRe = /^\s*(?:,\s*|in\s+)([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*)?)/i
  const cm = cityRe.exec(rest)
  if (cm) {
    // Truncate at the first stop word — "worth anything" is not a city, and a
    // partial like "Bend worth" must resolve to just "Bend".
    const words: string[] = []
    for (const w of cm[1].split(/\s+/)) {
      if (CITY_STOP_WORDS.has(w.toLowerCase())) break
      words.push(w)
    }
    if (words.length > 0) {
      const city = words
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
      return `${street}, ${city}`
    }
  }
  return street
}
