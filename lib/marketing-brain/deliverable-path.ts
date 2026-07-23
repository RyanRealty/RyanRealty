/**
 * deliverable-path — the PURE path algebra for the broker content library.
 *
 * Deliberately dependency-free: no imports, no I/O, no Supabase client. That is
 * not tidiness, it is what lets ci:deliverable-library-scope BUNDLE AND EXECUTE
 * this module against a fixture table instead of grepping its source text.
 *
 * Round 2 of adversarial review killed the previous arrangement twice over:
 *
 *   1. safeSegment preserved '.', so safeSegment('..') === '..'. The
 *      "reconstruct the path" defense then happily rebuilt `slug/../file`,
 *      compared it to itself, and returned true — a signed URL reached an
 *      object outside the caller's prefix (HTTP 200 on a canary at bucket
 *      root). The three-segment API kept it away from another broker's
 *      <slug>/<action>/<file> key, but the invariant the module advertised was
 *      false, and would have become a live cross-broker read the moment any
 *      key grew a fourth segment (versions, thumbnails, subdirectories).
 *
 *   2. The gate that was supposed to hold this asserted
 *      `body.includes('decodeURIComponent')`. Neutering the guard while
 *      leaving that token as dead code kept the gate green, as did deleting
 *      the `parts[0] === slug` comparison — which restores the round-1 defect
 *      exactly and reads like a redundant condition to anyone refactoring.
 *
 * So: every segment is validated AFTER sanitization, a segment that sanitizes
 * to nothing (or to dots) is refused rather than silently collapsed, and the
 * gate proves the behavior by running it.
 */

/**
 * A path segment we are willing to hand to storage, or '' if the input cannot
 * safely become one.
 *
 * Dots are allowed INSIDE a segment (report.v2.json is a legitimate filename)
 * but a segment made only of dots is traversal and is refused outright.
 */
export function safeSegment(value: string): string {
  const cleaned = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  // '.', '..', '...' — traversal in every filesystem that matters.
  if (/^\.+$/.test(cleaned)) return ''
  return cleaned
}

/** True when every segment survived sanitization intact. */
export function segmentsAreSafe(parts: readonly string[]): boolean {
  return parts.length > 0 && parts.every((p) => typeof p === 'string' && p.length > 0 && safeSegment(p) === p)
}

/**
 * The ONE place an object key is constructed: `<brokerSlug>/<actionId>/<filename>`.
 * Returns null when any segment cannot be represented safely — callers must
 * treat null as "refuse", never as "use the raw input".
 */
export function buildDeliverablePath(
  brokerSlug: string,
  actionId: string,
  filename: string,
): string | null {
  const parts = [safeSegment(brokerSlug), safeSegment(actionId), safeSegment(filename)]
  if (!segmentsAreSafe(parts)) return null
  return parts.join('/')
}

/**
 * True if `path` is the canonical key of an object owned by `brokerSlug`.
 *
 * Compares against a REBUILT path rather than pattern-matching the caller's
 * string, and decodes first: Supabase percent-decodes the object key after our
 * check, so `%2e%2e` escaped a naive `startsWith(prefix) && !includes('..')`
 * test and served another broker's bytes (confirmed HTTP 200 in round 1).
 */
export function pathBelongsToBroker(brokerSlug: string, path: string): boolean {
  const slug = safeSegment(brokerSlug)
  if (!slug || typeof path !== 'string' || !path) return false

  let decoded = path
  try {
    // %25252e -> %252e -> %2e -> . : keep decoding until it settles.
    for (let i = 0; i < 5; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return false // malformed encoding is not a key we own
  }
  if (decoded !== path) return false // canonical form only

  const parts = decoded.split('/')
  if (parts.length !== 3) return false
  if (!segmentsAreSafe(parts)) return false
  if (parts[0] !== slug) return false
  return buildDeliverablePath(parts[0], parts[1], parts[2]) === decoded
}
