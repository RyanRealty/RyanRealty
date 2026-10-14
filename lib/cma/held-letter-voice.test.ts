/**
 * ONE VOICE ON A HELD LETTER (reader review 2026-10-08).
 *
 * Ask-below-band always holds. A stored ask-in-band kind holds only when the
 * recommendation is missing, equal to the ask, over it, or more than 15%
 * under it. Those letters label the cover "The price Matt is reviewing" and
 * print none of the settled phrases. A recommendation already under the ask
 * and within 15% (exactly 15% counts) is the sendable letter, "Our
 * Recommended List Price for your home", even when the row still carries
 * kind ask-in-band. 2564 Purcell at $402,000 against a $429,000 ask is that
 * case. 2382 Jackson's held drafts had called a held number settled: "We'd
 * list", "the list price we recommend", "The sales that set this price", a
 * net column headed "At the list price", and a per-foot line with nothing
 * for "that" to point at.
 *
 * These render a whole letter (and its immersive twin) from a committed
 * letter shape with a hold written onto its pricing, and read the visible
 * text.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { competitionEdge } from '@/lib/cma/opinion-pages'
import { HELD_PRICE_HEADLINE } from '@/lib/cma/cover-value'
import { heldInBandLead, whatItsWorthLead } from '@/lib/cma/render-pricing-page'
import type { ExpiredAskExposure, ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import type { CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const broker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
} as CmaBroker

/** 2564 Purcell as stored 2026-09-28 (client scrubbed): $402,000 over a $388,000 to $415,000 band, last ask $429,000. */
function shape(): RenderCmaArgs {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'lib/cma/fixtures/letter-shapes', 'purcell.json'), 'utf8'),
  ) as RenderCmaArgs
  return {
    ...raw,
    broker,
    client: { name: null, email: null, phone: null, notes: null },
    mapDataUri: null,
    subjectMapDataUri: null,
    documentStatus: 'draft',
  } as RenderCmaArgs
}

const ASK = 429_000

/** The failed-ask step's record, as lib/cma/expired-audit.ts applyFailedAskCap writes it. */
function failedAskClamp(before: number, after: number) {
  return {
    kind: 'failed-ask' as const,
    appliedTo: 'recommended' as const,
    before,
    after,
    basis: { ratio: after / ASK, source: 'test' },
    applications: [{ tier: 'recommended' as const, before, after, ratio: after / ASK }],
    sentence: `The sales support a value of $${before.toLocaleString('en-US')}. Because $${ASK.toLocaleString('en-US')} already failed to sell, we recommend the price on the cover, which stays under that ask.`,
  }
}

/** $360,000 is more than 15% under the $429,000 ask (85% is $364,650). */
const DEEP_UNDER_ASK = 360_000

function held(kind: 'ask-in-band' | 'ask-below-band', recommended?: number): RenderCmaArgs {
  const a = shape()
  const p = a.pricing as CmaPricing
  const rec = recommended ?? (kind === 'ask-below-band' ? 380_000 : p.recommended)
  a.pricing = {
    ...p,
    recommended: rec,
    conservative: Math.min(p.conservative, rec),
    failedAsk: ASK,
    clamp: failedAskClamp(415_000, rec),
    hold: {
      kind,
      ask: ASK,
      bandLow: 388_000,
      bandHigh: 430_000,
      ...(kind === 'ask-below-band' ? { recommended: rec } : {}),
      reason: 'test hold',
    },
  } as CmaPricing
  return a
}

/** What a homeowner reads: tags, styles and scripts gone, entities decoded. */
function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/**
 * Every phrase that calls the cover number settled, or points at it with
 * nothing for the pointer to land on. Testimonials ("I'd highly recommend Matt
 * Ryan") are a reviewer's words and match none of these.
 */
const SETTLED: RegExp[] = [
  /\bwe recommend\b/i,
  /\bWe'd list\b/,
  /\bwe would list\b/i,
  /\blist price we recommend\b/i,
  /\brecommended (?:list|price)\b/i,
  /Our Recommended List Price/,
  /\bset this price\b/,
  /\bset this number\b/,
  /At the list price/,
  /\bthat is \$[\d,]+ per square foot\b/,
  /\byour price\b/,
]

function settledPhrases(text: string): string[] {
  return SETTLED.flatMap((re) => {
    const m = text.match(re)
    return m ? [m[0]] : []
  })
}

describe('a held letter reads the cover number as the price under review, everywhere', () => {
  it('ask-below-band: the letter prints none of the settled phrases', () => {
    const text = visible(renderCmaHtml(held('ask-below-band')).html)
    expect(text).toContain(HELD_PRICE_HEADLINE)
    expect(settledPhrases(text)).toEqual([])
    expect(text).not.toContain('List in that range.')
  })

  it('ask-below-band: the immersive twin prints none of them either', () => {
    const text = visible(renderImmersiveCmaHtml(held('ask-below-band') as RenderCmaArgs & { broker: CmaBroker }, 'https://ryan-realty.com'))
    expect(text).toContain(HELD_PRICE_HEADLINE)
    expect(settledPhrases(text)).toEqual([])
    expect(text).not.toContain('List in that range.')
  })

  it('ask-in-band more than 15% under stays a held letter', () => {
    const text = visible(renderCmaHtml(held('ask-in-band', DEEP_UNDER_ASK)).html)
    expect(text).toContain(HELD_PRICE_HEADLINE)
    expect(text).not.toContain('Our Recommended List Price for your home')
    expect(settledPhrases(text)).toEqual([])
    expect(text).not.toContain('List in that range.')
  })

  it('ask-in-band more than 15% under: the immersive twin stays held', () => {
    const text = visible(renderImmersiveCmaHtml(held('ask-in-band', DEEP_UNDER_ASK) as RenderCmaArgs & { broker: CmaBroker }, 'https://ryan-realty.com'))
    expect(text).toContain(HELD_PRICE_HEADLINE)
    expect(text).not.toContain('Our Recommended List Price for your home')
    expect(settledPhrases(text)).toEqual([])
  })

  it('ask-in-band within 15% (2564 Purcell): the recommendation voice, not the held label', () => {
    const text = visible(renderCmaHtml(held('ask-in-band')).html)
    expect(text).toContain('Our Recommended List Price for your home')
    expect(text).not.toContain(HELD_PRICE_HEADLINE)
    expect(text).toContain('The sales that set this price.')
    expect(text).toMatch(/closed sales below set this number/)
    expect(text).not.toContain('The sales that set the range.')
  })

  it('ask-in-band within 15%: the immersive twin uses the recommendation voice', () => {
    const text = visible(renderImmersiveCmaHtml(held('ask-in-band') as RenderCmaArgs & { broker: CmaBroker }, 'https://ryan-realty.com'))
    expect(text).toContain('Our Recommended List Price for your home')
    expect(text).not.toContain(HELD_PRICE_HEADLINE)
  })

  it('ask-in-band within 15%, no clamp: the sales set this price, and the letter says where to list', () => {
    const a = held('ask-in-band')
    a.pricing = { ...(a.pricing as CmaPricing), clamp: null } as CmaPricing
    const text = visible(renderCmaHtml(a).html)
    expect(text).toContain('Our Recommended List Price for your home')
    expect(text).not.toContain(HELD_PRICE_HEADLINE)
    expect(text).toContain('The sales that set this price.')
    expect(text).not.toContain('The sales behind this price.')
    expect(text).toMatch(/closed sales below set this number/)
    expect(text).toContain(
      "The five sales, after seller concessions and adjusted to today's market, run from $388,760 to $415,000. List in that range.",
    )
    expect(text).not.toMatch(/already failed to sell/)
  })

  it('ask-in-band within 15% with the failed-ask ceiling: the sales set this price, and the clamp says why the cover sits under the ask', () => {
    // $402,000 is under the $429,000 ask and within 15%, so the stored
    // ask-in-band kind is not a held letter. The clamp sentence prints, and
    // the sales set the price. The last ask sits above the printed band, so
    // the letter does not say it was inside that range.
    const text = visible(renderCmaHtml(held('ask-in-band')).html)
    const lead =
      "The five sales, after seller concessions and adjusted to today's market, run from $388,760 to $415,000. List in that range. Because $429,000 already failed to sell, we recommend the price on the cover, which stays under that ask."
    expect(text).toContain(lead)
    expect(lead).not.toMatch(/[—–]/)
    expect(lead).not.toMatch(/\bthe \d+ of the \d+\b/i)
    expect(text).toContain('The sales that set this price.')
    expect(text).toContain('Weight in this price')
    expect(text).not.toContain('Weight among these sales')
    expect(text).not.toContain('The sales that set the range.')
    expect(text).not.toContain('It does not set the price on the cover.')
    expect(text).toMatch(/closed sales below set this number/)
    expect(text).not.toContain('support a value of')
    expect(text).not.toContain('The last ask of $429,000 sat 79 days inside that range')
    expect(text).not.toContain('One of the sales that set this price is above that ask.')
    expect(text).not.toMatch(/\bcapped\b|too high/i)
  })

  it('ask-below-band (915 Saginaw shape): the rule 26 lead names the sales that set the range, not the price', () => {
    const text = visible(renderCmaHtml(held('ask-below-band')).html)
    expect(text).toContain(HELD_PRICE_HEADLINE)
    expect(text).toMatch(/The five sales that set the range support \$[\d,]+ to \$[\d,]+\. Your home did not sell at its last ask of \$429,000\. The listing /)
    expect(text).not.toMatch(/\bcapped\b|too high|already failed to sell/i)
    expect(text).not.toContain('List in that range.')
  })
})

describe('heldInBandLead: rule 22 states the two facts rule 26 states', () => {
  const subject = {
    streetAddress: '2382 Jackson',
    city: 'Bend',
    state: 'OR',
    standardStatus: 'Canceled',
    lastListPrice: 639_000,
  } as unknown as CmaSubject
  // 2382 Jackson as stored 2026-10-02 (render_args.pricing, expiredAudit).
  const pricing = {
    recommended: 624_000,
    conservative: 624_000,
    highEnd: 629_000,
    valueLow: 598_620,
    valueHigh: 648_772,
    failedAsk: 639_000,
    hold: { kind: 'ask-in-band', ask: 639_000, bandLow: 598_000, bandHigh: 649_000, reason: 'x' },
  } as unknown as CmaPricing
  const finalCycle = {
    listDate: '2026-02-17',
    initialAsk: 699_000,
    cuts: [
      { date: '2026-03-16', ask: 679_000 },
      { date: '2026-06-02', ask: 659_000 },
      { date: '2026-07-15', ask: 639_000 },
    ],
    offMarketDate: '2026-10-02',
    status: 'Canceled',
    days: 227,
  } as unknown as ExpiredFinalCycle
  const exposure = (ask: number, days: number) =>
    ({ final: { ask, days, from: '2026-07-15', to: '2026-10-02' } }) as unknown as ExpiredAskExposure

  it('2382 Jackson: the band, then the last ask, how long it sat inside it, and how it came off', () => {
    expect(heldInBandLead(subject, pricing, undefined, null, finalCycle, exposure(639_000, 79))).toBe(
      'The sales that set the price support $598,620 to $648,772. The last ask of $639,000 sat 79 days inside that range and did not sell. The listing was canceled after 227 days.',
    )
  })

  it('an ask that was the whole listing says its days once, on the listing', () => {
    expect(
      heldInBandLead(subject, pricing, undefined, null, { ...finalCycle, cuts: [], status: 'Expired', days: 79 } as ExpiredFinalCycle, exposure(639_000, 79)),
    ).toBe(
      'The sales that set the price support $598,620 to $648,772. The last ask of $639,000 was inside that range and did not sell. The listing expired after 79 days.',
    )
  })

  it('says "inside that range" only when the printed band holds the ask', () => {
    const outside = { ...pricing, valueHigh: 638_000 } as CmaPricing
    expect(heldInBandLead(subject, outside, undefined, null, finalCycle, exposure(639_000, 79))).toBe(
      'The sales that set the price support $598,620 to $638,000. The last ask of $639,000 sat 79 days and did not sell. The listing was canceled after 227 days.',
    )
  })

  it('never names days for a step that is not the ask it names', () => {
    expect(heldInBandLead(subject, pricing, undefined, null, finalCycle, exposure(659_000, 43))).toBe(
      'The sales that set the price support $598,620 to $648,772. The last ask of $639,000 was inside that range and did not sell. The listing was canceled after 227 days.',
    )
  })

  it('whatItsWorthLead uses the recommendation voice when the price is within 15%', () => {
    // $624,000 is under $639,000 and within 15%, so a stored ask-in-band kind
    // is not a held letter. No grid is passed, so the lead is the stored band
    // rounded once, then the list instruction. It does not invent days.
    const lead = whatItsWorthLead(subject, pricing, undefined, null, finalCycle, exposure(639_000, 79))
    expect(lead).toBe('The sales support $599,000 to $649,000. List in that range.')
    expect(lead).not.toMatch(/[—–]/)
    expect(lead).not.toMatch(/\bthe \d+ of the \d+\b/i)
    expect(lead).not.toMatch(/\d+ days/)
    expect(lead).not.toContain('sat 79 days inside that range')
  })

  it('whatItsWorthLead stays the held lead, with no list instruction, when the price is more than 15% under', () => {
    const deep = { ...pricing, recommended: 500_000, conservative: 500_000 } as CmaPricing
    const lead = whatItsWorthLead(subject, deep, undefined, null, finalCycle, exposure(639_000, 79))
    expect(lead).toContain('The last ask of $639,000 sat 79 days inside that range and did not sell.')
    expect(lead).not.toMatch(/We'd list|List in that range|expect it to sell/)
    expect(lead).not.toContain('Our Recommended List Price')
  })
})

describe('the competition chapter names the cover number the held way', () => {
  const competitors = [
    { sqft: 1_800, listPrice: 640_000 },
    { sqft: 1_900, listPrice: 700_000 },
  ]
  it('held: "at the price on the cover"; unheld keeps "at the list price we recommend"', () => {
    const held = competitionEdge({ subjectSqft: 2_016, recommended: 624_000, competitors, held: true })
    expect(held?.sentence).toBe(
      'At 2,016 square feet, your home is larger than both homes below, and at the price on the cover it is priced lower per square foot than either of them: $310, against $356 to $368.',
    )
    const unheld = competitionEdge({ subjectSqft: 2_016, recommended: 624_000, competitors })
    expect(unheld?.sentence).toContain('at the list price we recommend')
    // A home listed elsewhere still reads "at this price", held or not.
    expect(
      competitionEdge({ subjectSqft: 2_016, recommended: 624_000, competitors, held: true, nonSoliciting: true })?.sentence,
    ).toContain('at this price it is priced lower')
  })
})

describe('every letter, held or not', () => {
  it('the per-square-foot line names the price it divides', () => {
    for (const a of [shape(), held('ask-in-band')]) {
      const text = visible(renderCmaHtml(a).html)
      expect(text).toContain("The price on the cover comes to $277 per square foot across your home's 1,450 square feet.")
      expect(text).not.toMatch(/Across [\d,]+ square feet, that is/)
    }
  })

  it('the net column head names its price in words, never the cover dollars', () => {
    // The cover owns the recommended dollars (Matt lock 2026-09-12). A
    // sendable letter's head reads "At the list price". A held letter's
    // reads "At the price on the cover", so it is never read as the last ask.
    // Ask-in-band within 15% is sendable. Ask-below-band, and ask-in-band
    // more than 15% under, stay held.
    const plain = visible(renderCmaHtml(shape()).html)
    expect(plain).toContain('At the list price')
    const inBand = visible(renderCmaHtml(held('ask-in-band')).html)
    expect(inBand).toContain('At the list price')
    expect(inBand).not.toContain('At the price on the cover')
    for (const a of [held('ask-below-band'), held('ask-in-band', DEEP_UNDER_ASK)]) {
      const heldText = visible(renderCmaHtml(a).html)
      expect(heldText).toContain('At the price on the cover')
      expect(heldText).not.toContain('At the list price')
    }
    for (const a of [shape(), held('ask-in-band'), held('ask-below-band'), held('ask-in-band', DEEP_UNDER_ASK)]) {
      const text = visible(renderCmaHtml(a).html)
      expect(text).not.toContain(`At $${(a.pricing as CmaPricing).recommended.toLocaleString('en-US')}`)
      expect(text).not.toContain('of the list price, if you offer it')
    }
  })
})

describe('an unheld letter keeps its wording', () => {
  it('recommends, tells the owner where to list, and says the sales set the price', () => {
    const text = visible(renderCmaHtml(shape()).html)
    expect(text).toContain('Our Recommended List Price for your home')
    expect(text).toContain('List in that range.')
    expect(text).toContain('The sales that set this price.')
    expect(text).toMatch(/closed sales below set this number/)
    expect(text).not.toContain(HELD_PRICE_HEADLINE)
    expect(text).not.toMatch(/did not sell, so the price on the cover sits under it/)
  })
})
