/**
 * What a seller actually READS in a rendered CMA, and the words that may not
 * appear in it.
 *
 * Blueprint: docs/plans/CMA_REIMAGINED_2026-09-07.md § Words. Matt 2026-09-07:
 * "no one says band." The list is the jargon a pricing engine leaks into a
 * document a homeowner opens on a phone with no context.
 *
 * WHY THIS IS NOT IN `scripts/brand-voice-vocabulary.cjs`. That file has no
 * per-surface scope: `BANNED_WORDS` is mirrored by
 * `scripts/gen-brand-voice-consumers.mjs` into
 * `lib/brand-voice/generated-vocabulary.ts`, which `lib/voice/check.ts` reads
 * to HARD-FAIL every live send path in the shop, and `check-brand-voice.mjs`
 * scans the whole repo with it. "band" is legitimate elsewhere (a price band
 * in admin instrumentation, a market band in a DAL comment), so putting it
 * there would fail unrelated public copy and change runtime send behaviour
 * against stored rows this pass cannot read. The ban is enforced here instead,
 * over the RENDERED seller document, by `lib/cma/mannered-prose.test.ts` and
 * by `scripts/cma-lookpass.ts --check`. Same mechanism the rest of the CMA
 * document contract uses: assert the artifact, not the source.
 */

/**
 * Strip a rendered document down to the words a reader sees.
 *
 * Scripts and styles go (class names are not prose). Tags go, which drops
 * every attribute EXCEPT the two that are read aloud — `alt` and `aria-label`
 * — because a screen reader is a seller too: `aria-label="Listings in this
 * band that did not sell"` is the document saying "band" out loud.
 *
 * SVG survives tag-stripping as its `<text>` content, which is exactly right:
 * a chart label is seller-facing copy.
 */
export function sellerVisibleText(html: string): string {
  const spoken: string[] = []
  for (const m of html.matchAll(/\b(?:alt|aria-label)="([^"]*)"/gi)) {
    if (m[1]?.trim()) spoken.push(m[1])
  }
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(`${stripped} ${spoken.join(' ')}`).replace(/\s+/g, ' ').trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * The banned list, as patterns over the visible text.
 *
 * Two of the blueprint's words are ordinary English in another grammatical
 * role and are matched in their JARGON role only:
 *
 * - `set` — the blueprint's OWN approved sentence is "the sales that set the
 *   price". The verb stays. "this set", "the set", "in this comparable set"
 *   is the pricing engine's noun and goes.
 * - `comp` — "comparable sales" is what a licensed broker calls them in the
 *   ORS 696 disclosure and stays. The clipped trade word does not.
 */
/**
 * The overpricing folklore, banned outright.
 *
 * docs/research/cma-professional-practice-2026-09-07.md §4 went looking for the
 * dataset behind each of these and found none. They are training-deck graphics
 * and blog restatements with no original author, no sample, and in one case an
 * explicit disclaimer from the body they are attributed to:
 *
 *  - the pricing / buyer-activity pyramid ("at market = 60% of buyers")
 *  - "the first 30 days are the most important"
 *  - "buyers assume something is wrong with it" — Taylor (1999) is a
 *    theoretical signalling model, not a measurement of buyer behavior
 *  - showings-to-offer ratios, whose published figures contradict each other
 *  - 15% net / 25% gross adjustment caps, which Fannie Mae B4-1.3-09
 *    (eff. 06/04/2025, VERIFIED) explicitly disclaims
 *
 * Chapter 2b makes the same argument from Central Oregon rows with a count and
 * a source block beside every figure, which is why none of this is needed —
 * and §0 outranks a persuasive sentence anyway. The patterns match the CLAIM,
 * not the words: "30 days" in a date range and "showing" as a verb are fine.
 */
const OVERPRICING_FOLKLORE: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\b(?:pricing|buyer(?:'s)?\s+activity)\s+pyramid\b/i, label: 'the pricing pyramid' },
  {
    re: /\bthe first (?:30|thirty) days\b[^.]{0,60}\b(?:most important|matter most|are critical|are the most)\b/i,
    label: '"the first 30 days are the most important"',
  },
  {
    re: /\b(?:most important|first)\s+(?:30|thirty)\s+days\s+(?:on|of)\s+the\s+market\b/i,
    label: '"the most important 30 days on the market"',
  },
  {
    re: /\bbuyers?\b[^.]{0,40}\bassume\b[^.]{0,40}\b(?:something|there)(?:'s| is)?\s*(?:is\s+)?wrong\b/i,
    label: '"buyers assume something is wrong"',
  },
  { re: /\bshowings?\s+(?:per|to an?|before an?)\s+offer\b/i, label: 'showings-to-offer ratio' },
  {
    re: /\b(?:15|25)\s*(?:%|percent)\s+(?:net|gross)\s+adjustment\b/i,
    label: 'the 15% / 25% adjustment cap',
  },
  { re: /\badjustment (?:cap|caps|limit|limits)\b/i, label: 'adjustment caps' },
]

export const SELLER_BANNED_WORDS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bbands?\b/i, label: 'band' },
  { re: /\bcomps?\b/i, label: 'comp' },
  { re: /\bcomp-\w+/i, label: 'comp-' },
  { re: /\bsubjects?\b/i, label: 'subject' },
  { re: /\badjusted close\b/i, label: 'adjusted close' },
  { re: /\bbrought to (?:today|your\b|this house)/i, label: 'brought to today / brought to your size' },
  { re: /\bkept\b/i, label: 'kept' },
  { re: /\b(?:this|the|comparable)\s+set\b/i, label: 'set (noun)' },
  { re: /\btiers?\b/i, label: 'tier' },
  { re: /\bladder\b/i, label: 'ladder' },
  { re: /\bdispersion\b/i, label: 'dispersion' },
  { re: /\bsupportable\b/i, label: 'supportable' },
  { re: /\bthe recommend\b(?!ed)/i, label: 'the recommend (noun)' },
  ...OVERPRICING_FOLKLORE,
]

export type SellerWordHit = { label: string; excerpt: string }

/** Every banned word present in a rendered document, with the words around it. */
export function findSellerBannedWords(html: string): SellerWordHit[] {
  const text = sellerVisibleText(html)
  const hits: SellerWordHit[] = []
  for (const banned of SELLER_BANNED_WORDS) {
    const re = new RegExp(banned.re.source, `${banned.re.flags.replace('g', '')}g`)
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      hits.push({
        label: banned.label,
        excerpt: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60),
      })
      if (hits.length > 200) return hits
    }
  }
  return hits
}
