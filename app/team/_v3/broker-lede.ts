/**
 * The first sentence of a broker's own bio, for the /team index card
 * (VOICE-5 / AEO-5, visibility audit 2026-09-22).
 *
 * WHY. The index printed a name, a title and a license per broker; the three
 * real bios (866, 899 and 1,059 characters in public.brokers.bio, read
 * 2026-09-23) rendered only on /team/<slug>, so a reader and an answer engine
 * reading /team learned nothing that told one broker from another. The 2026-09-08
 * taste table named exactly that ("no bio, specialty, tenure"). The card now
 * carries the bio's own opening sentence, verbatim: the broker's words, never
 * a paraphrase (VOICE.md: quotes are real). Deep bios stay on /team/<slug>.
 *
 * Returns null when there is no bio, so a card never shows a made-up line.
 */

/** Abbreviations that end in a period without ending a sentence. */
const ABBREVIATIONS = ['Mt', 'St', 'Dr', 'Jr', 'Sr', 'Mr', 'Mrs', 'Ms', 'Inc', 'Co', 'Ave', 'No', 'U.S', 'Ft']

export function brokerLede(bio: string | null | undefined): string | null {
  const firstParagraph = (bio ?? '').trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (!firstParagraph) return null
  const re = /[.!?](?=\s+["“A-Z0-9]|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(firstParagraph)) !== null) {
    const end = match.index + 1
    const before = firstParagraph.slice(0, match.index)
    const lastWord = before.split(/\s+/).pop() ?? ''
    if (match[0] === '.' && ABBREVIATIONS.includes(lastWord.replace(/^[("“]/, ''))) continue
    // A single capital initial ("J. Smith") is not a sentence end either.
    if (match[0] === '.' && /^[A-Z]$/.test(lastWord)) continue
    return firstParagraph.slice(0, end).trim()
  }
  return firstParagraph
}
