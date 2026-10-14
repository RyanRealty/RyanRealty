/**
 * The place name a seller letter prints for a sale.
 *
 * The map labels a recorded plat ("Tara View Estates"). The MLS subdivision
 * field on the same sale can be a bare code ("CLAB"). The letter uses one
 * name. A mixed-case MLS name is already a name (Northwest Townsite Co 2nd
 * Addt, Foxborough) and is left as written. A slug is title-cased only when
 * the MLS value is a bare code and no recorded label was supplied.
 */

import { printedPlatName } from '@/lib/cma/map-outlines'

/** Two to eight capitals, nothing else. "CLAB" is a code. "Foxborough" is not. */
const BARE_MLS_CODE = /^[A-Z]{2,8}$/

export function bareMlsCode(name: string | null | undefined): boolean {
  return BARE_MLS_CODE.test((name ?? '').trim())
}

/**
 * "tara-view-estates" → "Tara View Estates".
 * A one-word slug is not a place name. A slug that is not hyphenated words
 * is not title-cased.
 */
export function nameFromPlatSlug(slug: string | null | undefined): string | null {
  const parts = (slug ?? '').trim().split('-').filter(Boolean)
  if (parts.length < 2) return null
  if (!parts.every((p) => /^[a-z0-9]+$/i.test(p))) return null
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
}

/**
 * The name to print. `recorded` is a plat label or the words of a slug.
 * A bare MLS code yields to that name. Anything else stays the MLS name.
 */
export function letterPlaceName(mls: string | null | undefined, recorded: string | null | undefined): string {
  const name = (mls ?? '').trim()
  if (!bareMlsCode(name)) return name
  const printed = printedPlatName(recorded)
  if (printed && printed.toLowerCase() !== name.toLowerCase()) return printed
  return name
}

export type PlaceNamedComp = {
  subdivision?: string | null
  subdivisionSlug?: string | null
  platLabel?: string | null
}

/** Bare MLS codes on these sales, mapped to the recorded place name. */
export function recordedPlaceNames(comps: readonly PlaceNamedComp[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const c of comps) {
    const mls = (c.subdivision ?? '').trim()
    if (!bareMlsCode(mls) || map.has(mls)) continue
    const recorded = (c.platLabel ?? '').trim() || nameFromPlatSlug(c.subdivisionSlug)
    const place = letterPlaceName(mls, recorded)
    if (place && place !== mls) map.set(mls, place)
  }
  return map
}

/**
 * Replace each bare code with the recorded name, as a whole word, longer
 * codes first. The renderer runs this on the finished HTML so a stored
 * sentence, an area line, and a competition line all say the same name the
 * map already draws. It does not change a name the pricing logic matched on.
 */
export function applyRecordedPlaceNames(html: string, comps: readonly PlaceNamedComp[]): string {
  const map = recordedPlaceNames(comps)
  const codes = [...map.keys()].sort((a, b) => b.length - a.length)
  let out = html
  for (const code of codes) {
    const place = map.get(code)
    if (!place) continue
    out = out.replace(new RegExp(`\\b${code}\\b`, 'g'), place)
  }
  return out
}
