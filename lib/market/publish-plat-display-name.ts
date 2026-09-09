/**
 * Visitor-facing plat / subdivision name.
 *
 * MLS SubdivisionName is an ingest key. Abbreviations (Oww, DrrhTrs, Bbr,
 * StoneTH, Crr 1) are not place names. Withhold them. Do not invent an
 * expansion.
 *
 * A recorded truncation (MLS "Triple" for Tetherow Triple Knot) may use the
 * independently confirmed visitor name. Do not invent expansions for codes
 * without a recorded full form.
 *
 * Founding case: /subdivisions/river-meadows More areas printed Oww,
 * DrrhTrs, Drrh Trs, OWW2 (fleet ca552556c46f87dbefdbe4ae948f1b68).
 * Triple: /subdivisions/triple printed the cut MLS token (walker-desktop 2026-08-19).
 */

import { displaySubdivision } from '@/lib/slug'

/** MLS ingest token → recorded visitor name. Keys are lowercased. */
const RECORDED_PLAT_DISPLAY: Record<string, string> = {
  triple: 'Triple Knot',
  // Deschutes County records the plat as "Farm (the)" (CSNUM 07193), which
  // title-cases out of the slug as "Farm The". MLS calls it "The Farm". Both
  // spellings map to the recorded visitor name — this is a reordering of the
  // county's own words, not an invented expansion.
  'farm the': 'The Farm',
  'farm (the)': 'The Farm',
}

const KNOWN_MLS_ABBREVIATIONS = new Set(
  [
    'oww',
    'oww2',
    'drrhtrs',
    'drrh trs',
    'bbr',
    'stoneth',
    'crr 1',
    'crr1',
    'crr',
  ].map((s) => s.toLowerCase()),
)

function compactLetters(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '')
}

export function looksLikeMlsAbbreviation(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (KNOWN_MLS_ABBREVIATIONS.has(trimmed.toLowerCase())) return true
  if (/^[A-Z]{2,5}\d{0,2}$/.test(trimmed)) return true
  if (/^[A-Za-z]{2,4}\s+\d+$/.test(trimmed)) return true
  if (/\bVill\b/i.test(trimmed)) return true
  if (!/\s/.test(trimmed) && trimmed.length <= 8) {
    const vowels = (trimmed.match(/[aeiouAEIOU]/g) ?? []).length
    const hasInternalCap = /[a-z][A-Z]/.test(trimmed)
    if (vowels === 0) return true
    if (hasInternalCap) return true
    if (trimmed.length <= 3 && vowels <= 1) return true
  }
  const compact = compactLetters(trimmed)
  if (compact.length <= 8 && (compact.match(/[aeiouAEIOU]/g) ?? []).length === 0) {
    return true
  }
  return false
}

/**
 * Words a place name does not capitalise in the middle of itself.
 *
 * WHY: MLS SubdivisionName capitalises every word, and so did the slug
 * fallback, so /subdivisions/ridge-at-eagle-crest published "Ridge At Eagle
 * Crest" — in the H1, the breadcrumb, the by-the-numbers heading, all five Q&A
 * questions, and the FAQPage JSON-LD Google reads (separate evaluator,
 * 2026-09-08). This is English title case, not a rename: no word is added,
 * removed or reordered, only cased the way the language cases it. It is
 * therefore NOT an invented expansion, which is what this module withholds.
 * One list, used by every path that builds a visitor plat name.
 */
export const TITLE_LOWER_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'de',
  'del',
  'for',
  'in',
  'la',
  'las',
  'los',
  'of',
  'on',
  'or',
  'the',
  'to',
  'van',
  'von',
])

/**
 * Lower an interior connector word. The first and last words always keep their
 * capital, so "The Ridge" keeps its The and a name is never left ending on a
 * dangling preposition. A word that is not exactly a connector is untouched,
 * including anything with internal capitals or digits, so MLS phase markers
 * (Phase 3, 7th) and camel tokens survive unchanged.
 */
export function titleCasePlaceName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return name
  return words
    .map((word, i) => {
      if (i === 0 || i === words.length - 1) return word
      return TITLE_LOWER_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word
    })
    .join(' ')
}

export function publishPlatDisplayName(raw: string | null | undefined): string | null {
  const cleaned = displaySubdivision(raw)
  if (!cleaned) return null
  const recorded = RECORDED_PLAT_DISPLAY[cleaned.toLowerCase()]
  if (recorded) return recorded
  // The abbreviation test runs on the CLEANED name, before casing, because
  // casing must not turn a withheld token into a publishable one.
  if (looksLikeMlsAbbreviation(cleaned)) return null
  return titleCasePlaceName(cleaned)
}
