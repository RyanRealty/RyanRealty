/**
 * SAY IT ONCE PER LETTER (reader review 2026-10-09, 915 Saginaw).
 *
 * The chapter on the homes that came off unsold and the chapter on the homes
 * for sale at this price each carry the same two disclosures, written by the
 * build for each set on its own:
 *
 *  - "No dollar value is applied to the room." (a home kept one room apart on
 *    the subject's own ground, rule 4), and
 *  - "... nothing from outside Park Place, Miller Heights, Kenwood, West Hills
 *    and Bend View was added to make up the number." (a set short of its count
 *    inside the sales area, rule 24).
 *
 * On a letter where both sets carried them, each printed word for word in
 * both chapters. The letter is one document, and only it knows which chapter
 * a reader meets first (OPINION_CHAPTER_ORDER), so the second chapter's
 * sentence is read against what the first already printed: the room line is
 * not said again, and the short-count line says that the same holds here,
 * without repeating the area. Pure; delivered letters re-render through it.
 */

/** The room disclosure, as `roomNotedSentence` (lib/cma/same-area-fit.ts) closes it. */
export const NO_DOLLAR_FOR_ROOM = 'No dollar value is applied to the room.'

/** The short-count disclosure, in either chapter's form. */
const NOTHING_ADDED = /\bnothing from .+? was added to make up the number\b/i
/** The competition chapter's own sentence for it. */
const NOTHING_ADDED_SENTENCE = /\s*Nothing from .+? was added to make up the number\./

/** Said in place of the short-count line when an earlier chapter said it. */
export const NOTHING_ADDED_HERE_EITHER = 'Nothing from further out was added here either.'

/**
 * `sentence` with what `earlier` (the plain text an earlier chapter printed)
 * already said taken out.
 */
export function sayOnceAfter(sentence: string, earlier: string): string {
  let out = sentence
  if (earlier.includes(NO_DOLLAR_FOR_ROOM)) {
    out = out.replace(` ${NO_DOLLAR_FOR_ROOM}`, '').replace(NO_DOLLAR_FOR_ROOM, '')
  }
  if (NOTHING_ADDED.test(earlier) && NOTHING_ADDED_SENTENCE.test(out)) {
    out = out.replace(NOTHING_ADDED_SENTENCE, ` ${NOTHING_ADDED_HERE_EITHER}`)
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

/** An HTML fragment's words, as a reader reads them, for `sayOnceAfter`. */
export function plainTextOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
