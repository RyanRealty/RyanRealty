/**
 * Plat legal names are long. The map and chips print a short door, not the
 * county plat line. Empty after stripping falls back to the original.
 *
 * THE THESIS THESE HELPERS SERVE (SITE-07 quality pass, 2026-09-09): a
 * neighborhood's plats read as its own children. "Awbrey Butte Homesites
 * Phase Twenty-two" is the county's name for a plat; on Awbrey Butte's own
 * page the reader already knows where they are, so the door reads "Homesites
 * Phase Twenty-two". Under an 11rem ellipsis every sibling that shared the
 * long prefix printed as ONE identical string ("Awbrey Butte Homesite…"
 * repeated), which the evaluator called information loss. Dropping the prefix
 * leaves the part that differs, and `placeDoorLabels` keeps the phase exactly
 * when the phase IS the part that differs.
 */

/**
 * "Phase 3", "Phases 1 and 2", "Phase One", "Phase Twenty-two", "Phase IV",
 * "Phases I, II & III": a phase is a developer's tranche, not a place, so it
 * leaves a lone door label whether the county wrote it as a digit, a word, or
 * a numeral. The word list runs to the fifties with the hyphenated tens the
 * county actually files (Awbrey Butte Homesites is on Phase Thirty-three,
 * read off /cities/bend/awbrey-butte on 2026-09-09).
 */
const ONES = 'one|two|three|four|five|six|seven|eight|nine'
const TEENS = 'ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen'
const TENS = 'twenty|thirty|forty|fifty'
const WORD_NUMBER = `(?:(?:${TENS})(?:[-\\s](?:${ONES}))?|${TEENS}|${ONES})`
const PHASE_ORDINAL = `(?:\\d+[a-z]?|${WORD_NUMBER}|[ivx]+)`
const PHASE_RE = new RegExp(
  `,?\\s*phases?\\s+${PHASE_ORDINAL}\\b(?:\\s*(?:,|and|&)\\s*(?:and\\s+)?${PHASE_ORDINAL}\\b)*`,
  'gi',
)
/** "Sub-21-01", "Subdivision 22-01": the county's file number, never a name. */
const FILE_NUMBER_RE = /\s*sub(?:division)?[-.\s]+\d{1,2}(?:[-.\s]\d{2,})+/gi

function tidy(s: string): string {
  return s
    .replace(/\s+addition to\s+.+$/i, ' Addition')
    .replace(/\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function shortPlaceLabel(name: string): string {
  const raw = name.trim()
  if (!raw) return raw
  const s = tidy(raw.replace(PHASE_RE, '').replace(FILE_NUMBER_RE, ''))
  return s || raw
}

/**
 * The same door with its phase kept: "Awbrey Butte Homesites Phase Twenty-two
 * Sub-21-01" reads "Awbrey Butte Homesites Phase Twenty-two". The label a
 * sibling set falls back to when the phase is what tells two plats apart.
 */
export function placeLabelWithPhase(name: string): string {
  const raw = name.trim()
  if (!raw) return raw
  const s = tidy(raw.replace(FILE_NUMBER_RE, '').replace(/,\s*(?=phases?\b)/gi, ' '))
  return s || raw
}

/**
 * Drop the containing place's own name when it opens the child's name as a
 * whole word or run of words: inside Awbrey Butte, "Awbrey Butte Homesites
 * Phase 3" is "Homesites Phase 3". Word-boundary safe, so "Awbreyton Heights"
 * keeps its name inside Awbrey. A child named exactly the place, or anything
 * that would strip to nothing, comes back as it went in: the door always has
 * a name.
 *
 * Case-insensitive on purpose: the county writes plats in title case and the
 * MLS in whatever case the agent typed.
 */
export function stripOwnPrefix(childName: string, placeName: string): string {
  const child = childName.trim()
  const place = placeName.trim()
  if (!child || !place) return child
  if (child.length <= place.length) return child
  if (child.slice(0, place.length).toLowerCase() !== place.toLowerCase()) return child
  // The character after the prefix must end a word, or "Awbrey" would eat
  // the front of "Awbreyton".
  if (/[\p{L}\p{N}]/u.test(child.charAt(place.length))) return child
  const rest = child
    .slice(place.length)
    .replace(/^(?:'s|’s)?[\s\-–—,:]+/u, '')
    .trim()
  return rest || child
}

/**
 * One door label per name, for a SET of sibling doors drawn together: the
 * atlas chips, its map labels, a subdivisions ledger.
 *
 * Each name loses the containing place's prefix (`within`) and then its phase
 * and file number. When two or more names in the set would print the same
 * short label, those names keep their phase instead, because on a page like
 * Awbrey Butte twenty-five plats are "Awbrey Butte Homesites Phase N" and a
 * column of twenty-five chips reading "Homesites" is twenty-five doors with
 * one name on them. Names that are identical in full stay identical: that is
 * a fact about the source, not a label to invent around.
 *
 * Positional: `labels[i]` belongs to `names[i]`.
 */
export function placeDoorLabels(names: readonly string[], within?: string | null): string[] {
  const own = within?.trim() ?? ''
  const bare = names.map((n) => (own ? stripOwnPrefix(n, own) : n.trim()))
  const short = bare.map(shortPlaceLabel)
  const seen = new Map<string, number>()
  for (const s of short) {
    const k = s.toLowerCase()
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  return short.map((s, i) => ((seen.get(s.toLowerCase()) ?? 0) > 1 ? placeLabelWithPhase(bare[i]!) : s))
}
