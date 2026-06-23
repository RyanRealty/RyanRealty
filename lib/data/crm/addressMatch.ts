/**
 * addressMatch — pure street-address comparison for the CRM "home they own" panel.
 *
 * The owner-home photo path finds a CANDIDATE listing by lat/lng proximity
 * (a ~40m bounding box). Proximity alone can land on a NEIGHBOR's house, so a
 * candidate photo must never be shown as the owner's home until its street
 * address actually matches the owner's address. This module is that gate.
 *
 * Pure + dependency-free so it is unit-testable in isolation — no Supabase, no
 * Next, no I/O. The proximity query stays the candidate finder; addressMatches
 * is the pass/fail guard the candidate must clear before a photo is returned.
 */

export type StreetAddressParts = {
  streetNumber?: string | null
  streetName?: string | null
}

// Common USPS street-suffix variants -> a single canonical token. The owner side
// stores a freeform "123 NW Bond St"; the MLS side stores "Bond" in street_name
// (often with no suffix at all). Folding both to the same core lets
// "123 NW Bond St" match "123 Bond Street".
const SUFFIX_CANON: Record<string, string> = {
  st: 'st',
  street: 'st',
  ave: 'ave',
  av: 'ave',
  avenue: 'ave',
  blvd: 'blvd',
  boulevard: 'blvd',
  rd: 'rd',
  road: 'rd',
  dr: 'dr',
  drive: 'dr',
  ln: 'ln',
  lane: 'ln',
  ct: 'ct',
  court: 'ct',
  pl: 'pl',
  place: 'pl',
  ter: 'ter',
  terr: 'ter',
  terrace: 'ter',
  cir: 'cir',
  circle: 'cir',
  way: 'way',
  hwy: 'hwy',
  highway: 'hwy',
  pkwy: 'pkwy',
  parkway: 'pkwy',
  loop: 'loop',
  trl: 'trl',
  trail: 'trl',
  sq: 'sq',
  square: 'sq',
  pt: 'pt',
  point: 'pt',
  run: 'run',
  path: 'path',
  row: 'row',
}

// Directional prefixes/suffixes (NW Bond, Bond St N). Stripped before
// comparison so "NW Bond St" and "Bond Street" share the same core. Bend's grid
// is heavily directional, so dropping these avoids false negatives.
const DIRECTIONALS = new Set([
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
])

/** Lowercase, collapse whitespace, strip punctuation to spaces. */
function basicNormalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a street name into its comparable parts: the base (everything that
 * identifies the street) and an optional canonical suffix (st, ave, ...).
 * Directionals are stripped from both ends. Returns empty strings when there is
 * no usable core.
 *
 * The split exists because the two sides disagree on suffix presence: the owner
 * side stores "Bond St" while the MLS street_name column commonly stores just
 * "Bond". Comparing base separately lets those match, while keeping the suffix
 * available so two PRESENT-and-different suffixes ("Bond Ave" vs "Bond St")
 * still fail.
 */
export function splitStreetName(raw: string | null | undefined): { base: string; suffix: string } {
  if (!raw) return { base: '', suffix: '' }
  const tokens = basicNormalize(raw)
    .split(' ')
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return { base: '', suffix: '' }

  // Strip leading directionals (NW Bond -> Bond).
  while (tokens.length > 1 && DIRECTIONALS.has(tokens[0])) tokens.shift()
  // Strip a trailing directional that sits AFTER the suffix (Bond St NW).
  while (tokens.length > 1 && DIRECTIONALS.has(tokens[tokens.length - 1])) tokens.pop()

  // Pull off a trailing suffix token (Street -> st) when the name has more than
  // just the suffix. A lone token ("Bond") is a base, never a suffix.
  let suffix = ''
  const last = tokens[tokens.length - 1]
  if (tokens.length > 1 && SUFFIX_CANON[last]) {
    suffix = SUFFIX_CANON[last]
    tokens.pop()
  }

  return { base: tokens.join(' '), suffix }
}

/**
 * Reduce a street name to a single comparable core string (base + canonical
 * suffix). Mostly for display / debugging — the match logic uses splitStreetName
 * so it can treat a missing suffix as compatible. Returns '' when there is no
 * usable core.
 */
export function normalizeStreetName(raw: string | null | undefined): string {
  const { base, suffix } = splitStreetName(raw)
  if (!base) return ''
  return suffix ? `${base} ${suffix}` : base
}

/** Normalize a street number: trim, lowercase, drop a unit/fraction tail. */
export function normalizeStreetNumber(raw: string | null | undefined): string {
  if (!raw) return ''
  const cleaned = basicNormalize(raw)
  if (!cleaned) return ''
  // Take the first whitespace-delimited token (the civic number); a trailing
  // unit like "123 1/2" or "123 B" is dropped for the comparison.
  const first = cleaned.split(' ')[0]
  return first ?? ''
}

/**
 * Parse a freeform single-line address ("123 NW Bond St, Bend OR") into a
 * street number + street name. Only the street portion is parsed — anything
 * after the first comma (city/state/zip) is discarded. The owner side stores
 * its address as one string, so this turns it into the structured shape
 * addressMatches compares against the MLS row's street_number / street_name.
 */
export function parseStreetAddress(raw: string | null | undefined): StreetAddressParts {
  if (!raw) return { streetNumber: null, streetName: null }
  const street = raw.split(',')[0] ?? ''
  const tokens = basicNormalize(street)
    .split(' ')
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return { streetNumber: null, streetName: null }

  // A leading token that contains a digit is the civic number.
  if (/\d/.test(tokens[0])) {
    const streetNumber = tokens[0]
    const streetName = tokens.slice(1).join(' ')
    return {
      streetNumber: streetNumber || null,
      streetName: streetName || null,
    }
  }
  // No leading number — treat the whole thing as the street name.
  return { streetNumber: null, streetName: tokens.join(' ') || null }
}

/**
 * True only when two addresses are the SAME street address:
 *  - the civic number matches exactly, AND
 *  - the street-name BASE matches exactly (after directional + suffix folding),
 *    AND
 *  - the suffixes are compatible — equal, or at least one side omits it (the
 *    MLS street_name column routinely has no suffix while the owner's address
 *    does; two PRESENT-and-different suffixes like Ave vs St still fail).
 *
 * Missing the number or the name base on either side is a non-match (we never
 * guess). This is the gate a proximity-matched listing photo must clear before
 * it is shown as the owner's home — a near miss returns false so the panel
 * shows no photo rather than the wrong neighbor's house.
 */
export function addressMatches(a: StreetAddressParts, b: StreetAddressParts): boolean {
  const aNum = normalizeStreetNumber(a.streetNumber)
  const bNum = normalizeStreetNumber(b.streetNumber)
  if (!aNum || !bNum) return false
  if (aNum !== bNum) return false

  const aName = splitStreetName(a.streetName)
  const bName = splitStreetName(b.streetName)
  if (!aName.base || !bName.base) return false
  if (aName.base !== bName.base) return false

  // Suffixes only have to agree when BOTH are present.
  if (aName.suffix && bName.suffix && aName.suffix !== bName.suffix) return false
  return true
}
