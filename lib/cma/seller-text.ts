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
