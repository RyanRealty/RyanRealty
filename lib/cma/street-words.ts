/**
 * The small vocabulary of a US street address: the words that end a street name
 * ("Rd", "Road", "Loop", "Cir") and the directionals that lead one ("NW", "SE").
 *
 * One list for the places in lib/cma that must agree on what these are. The
 * address parser (subject.ts) drops a suffix off a typed address so it can match
 * the MLS street name, which the Central Oregon feeds store without one, and it
 * reads a leading directional. The owner-name check (street-context.ts) reads a
 * suffix after a name word, and a directional between a house number and a name
 * word, as proof that the word is a street. Dependency-free and lower case, so
 * any runtime can import it.
 *
 * lib/cma-delivery.ts still carries its own copy of the suffix words. It sits
 * behind server-only and a PDF renderer, so it is left as it was.
 */

export const STREET_SUFFIXES: ReadonlySet<string> = new Set([
  'rd', 'road', 'st', 'street', 'ave', 'avenue', 'dr', 'drive', 'ln', 'lane',
  'ct', 'court', 'pl', 'place', 'blvd', 'boulevard', 'hwy', 'highway',
  'pkwy', 'parkway', 'cir', 'circle', 'way', 'trail', 'trl', 'ter', 'terrace', 'loop',
])

/** Leading directional tokens ("1204 NW Iowa" -> direction nw, name iowa). */
export const STREET_DIRECTIONALS: ReadonlySet<string> = new Set([
  'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest',
])

/**
 * Every word a PRINTED address can end in: the parser's suffixes plus street
 * types the parser must leave on (dropping "Ridge" off a typed "Awbrey Ridge"
 * would shorten the prefix subject.ts matches against the MLS street name, and
 * widen it): mkt, market, pass, butte, ridge, rim. Then the words
 * lib/data/crm/addressMatch.ts already folds as suffixes (av, terr, sq, square,
 * pt, point, run, path, row). Read by the owner-name check, never by the parser.
 */
export const PRINTED_STREET_SUFFIXES: ReadonlySet<string> = new Set([
  ...STREET_SUFFIXES,
  'mkt', 'market', 'pass', 'butte', 'ridge', 'rim',
  'av', 'terr', 'sq', 'square', 'pt', 'point', 'run', 'path', 'row',
])

/**
 * The printed suffixes that are also ordinary words a title or a sentence can
 * put after a name: "Russell Market Report", "Russell Run is the plan", "Ada Way
 * ahead". The owner-name check asks more of these than of "Rd" or "Road".
 */
export const AMBIGUOUS_STREET_SUFFIXES: ReadonlySet<string> = new Set([
  'way', 'place', 'point', 'run', 'path', 'row', 'pass', 'market', 'square', 'rim', 'ridge', 'butte',
])
