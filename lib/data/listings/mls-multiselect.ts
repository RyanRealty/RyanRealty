/**
 * Pure formatters for the MLS free-text + multi-select fields the RETS feed
 * stores on a listing. Extracted from getListingDetail so the parsing is
 * unit-testable without pulling in next/cache + the Supabase client.
 *
 * The MLS encodes a multi-select attribute as a JSON object of {Label: true} —
 * e.g. roof = '{"Composition": true, "Membrane": true}', sewer =
 * '{"Septic Tank": true, "Standard Leach Field": true}', levels = '{"One": true}'.
 * Rendering that string verbatim leaks raw JSON onto the listing detail page
 * (Matt report 2026-06-19 for style/roof/view; recurred 2026-06-24 for
 * levels/foundation/sewer/water — the same class on the fields the first fix
 * missed). formatMlsMultiSelect parses the truthy labels into a comma list; a
 * plain scalar string passes through unchanged; the privacy sentinel / empty /
 * unparseable object all collapse to null so nothing raw ever renders.
 */

/**
 * Strip the MLS `'********'` privacy sentinel out of a free-text field. MLS
 * masks suppressed values with a run of asterisks; rendering that verbatim
 * leaks a placeholder into the UI. Returns null for any value that's empty or
 * starts with `***` so the renderer omits the field entirely.
 */
export function cleanText(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s.trim()
  if (t.length === 0 || t.startsWith('***')) return null
  return t
}

/**
 * Format an MLS multi-select field stored as a JSON object of {Label: true}.
 * Returns the truthy labels joined ("Craftsman, Northwest"), a plain string
 * as-is, or null for the privacy sentinel / empty / unparseable. A `{...}` or
 * `[...]`-shaped string that fails to parse returns null rather than rendering
 * raw JSON.
 */
export function formatMlsMultiSelect(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) {
        const labels = parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        return labels.length ? labels.join(', ') : null
      }
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        const labels = Object.keys(obj).filter((k) => obj[k] === true || obj[k] === 'true')
        return labels.length ? labels.join(', ') : null
      }
      return null
    } catch {
      return null // an object/array-shaped string we cannot parse must not render raw
    }
  }
  return t
}
