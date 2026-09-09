/**
 * Shared title + description builders for the four content-registry detail
 * families: /parks/[slug], /central-oregon/trails/[slug],
 * /central-oregon/events/[slug], /central-oregon/venues/[slug].
 *
 * WHY THIS FILE EXISTS (SITE-25). Each family had its own fill-in-the-blank
 * template whose only variable was the entity name, so siblings shipped
 * byte-identical descriptions — /parks/sawyer-park and /parks/big-sky-park
 * differed by two words — and each one closed with a 24-character brokerage
 * tail that pushed several past the 155-char cap into a trailing "…". Every
 * registry row already carries a hand-written, sourced `blurb` that reaches the
 * Place JSON-LD and the on-page prose. It never reached generateMetadata.
 *
 * THE RULE:
 *   title       = the entity name, nothing else. No category label, no region.
 *                 app/layout.tsx's suffix supplies "Ryan Realty — Central
 *                 Oregon", so the page-level title carries zero copies of
 *                 "Central Oregon" and the document carries exactly one.
 *   description = as much of the entity's own blurb as fits 155 characters, cut
 *                 at a sentence boundary. Real prose that is already on the
 *                 page and already sourced (§0) — nothing invented, nothing
 *                 boilerplate, distinct by construction because the blurbs are.
 *
 * generateMetadata in all four families stays registry-only: these take a
 * string and return a string, no DAL call, so the page contract and
 * scripts/check-prerender-db-safety.mjs are unaffected.
 */

/** og/meta description cap. Matches lib/share-metadata.ts. */
export const MAX_DESC = 155

/**
 * Abbreviations that end in a period without ending a sentence — a NAMED list,
 * not a shape. "any short capitalized token" looked right and swallowed the
 * sentence break after "Broken Top.", which then shipped a description ending
 * in "..".
 */
const ABBREVIATION_END =
  /(?:^|\s)(?:[A-Z]|St|Mt|Ft|Dr|Ave|Blvd|Rd|Hwy|Jr|Sr|No|Co|Inc|vs|etc|approx|U\.S)\.$/

/** Function words a cut clause must not end on. Lower-case only — see clauseCut. */
const ORPHAN_TAIL =
  /\s+(?:and|but|or|nor|so|yet|with|that|which|while|when|where|as|to|of|in|on|at|for|from|by|a|an|the|its|their)$/

/** Split prose into sentences, without breaking on "St. Francis" or "Mt. Bachelor". */
export function sentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const pieces = normalized.split(/(?<=[.!?])\s+/)
  const out: string[] = []
  for (const piece of pieces) {
    const prev = out[out.length - 1]
    if (prev != null && ABBREVIATION_END.test(prev)) out[out.length - 1] = `${prev} ${piece}`
    else out.push(piece)
  }
  return out
}

/**
 * Cut one over-long sentence back to a clause boundary and close it with a
 * period. Never emits "…" — an ellipsis in a meta description is the tell that
 * the copy was written without a budget.
 */
function tidy(cut: string): string {
  let out = cut.replace(/[\s.,;:—–-]+$/, '')
  // A clause that ends on a conjunction or a preposition reads as a broken
  // sentence once the period lands. Drop the orphan word, and keep dropping —
  // "filmmaker Q and As" losing "As" leaves "and" behind. Case-SENSITIVE on
  // purpose: "As" there is a plural noun, not the conjunction.
  for (;;) {
    const next = out.replace(ORPHAN_TAIL, '').replace(/[\s.,;:—–-]+$/, '')
    if (next === out) break
    out = next
  }
  return out
}

function clauseCut(sentence: string, max: number): string {
  if (sentence.length <= max) return sentence
  const room = max - 1 // one char for the period
  const window = sentence.slice(0, room)
  let boundary = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' — '))
  if (boundary < 0) {
    // No punctuation to cut on. A coordinating conjunction is the next-best
    // seam: the South Sister blurb has neither comma nor dash, and cutting at
    // " and " ends on "…about 29 miles west of Bend." where the word boundary
    // ends on "…the tallest peak you can walk."
    for (const seam of [' and ', ' but ', ' while ', ' which ', ' where ']) {
      boundary = Math.max(boundary, window.lastIndexOf(seam))
    }
  }
  const byWord = tidy(window.slice(0, Math.max(0, window.lastIndexOf(' '))))
  const byClause = boundary > 0 ? tidy(window.slice(0, boundary)) : ''
  // A clause boundary almost always reads as a finished thought where a word
  // boundary does not ("…Oregon's largest ponderosa pine." beats "…thought to
  // be more than 500."), so the clause wins by default. The one shape it loses
  // on is a COORDINATE-ADJECTIVE comma — Pilot Butte's "trades a short, steep
  // effort" cuts to "trades a short.", an article and a bare adjective with no
  // noun. That stub is detectable, and only then does the word cut win.
  const stub = /\b(?:a|an|the|its|their|his|her|our|your)\s+\S+$/
  const cut =
    byClause && !(stub.test(byClause) && byWord.length > byClause.length) ? byClause || byWord : byWord
  return `${cut}.`
}

/**
 * The meta description for a registry detail page: the entity's own blurb, cut
 * to whole sentences inside `max`. Falls back to a clause cut when even the
 * first sentence overflows.
 */
export function registryDescription(blurb: string, max: number = MAX_DESC): string {
  const parts = sentences(blurb)
  if (parts.length === 0) return ''
  let out = ''
  for (const s of parts) {
    const next = out ? `${out} ${s}` : s
    if (next.length > max) break
    out = next
  }
  if (out) return out
  return clauseCut(parts[0], max)
}

/**
 * The page-level title for a registry detail page. The entity name and nothing
 * else — the layout suffix carries the brand and the region.
 */
export function registryTitle(name: string): string {
  return name.trim()
}
