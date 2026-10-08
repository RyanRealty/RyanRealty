/**
 * A STRONGER CLOSE (Matt 2026-10-07, workstream C).
 *
 *  1. One next step: a primary "Pick a time with <broker>" on the broker's
 *     calendar, with Call and Text beside it on the published line, each a
 *     44px tap target, in both documents.
 *  2. The close is the heading plus two short paragraphs, and says "earn your
 *     business" once.
 *  3. Reviews sit in the palette: no white card, no gold star, no Georgia.
 *  4. The competition chapter says the home's size and $/sqft edge only when
 *     the homes it draws prove it (CLAUDE.md §0).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { trackedDocLink } from './doc-links'
import { immersiveStylesheet } from './immersive-css'
import { renderImmersiveCmaHtml } from './immersive'
import {
  competitionBodyMatrixHtml,
  competitionEdge,
  nextStepActionsHtml,
  nextStepButtonsHtml,
  nextStepNoteHtml,
  type OpinionPageArgs,
} from './opinion-pages'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { findSellerBannedWords } from './seller-text'
import type { CmaBandRival, CmaBandRivalSet } from './band-rivals'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const EM_DASH = new RegExp(String.fromCharCode(0x2014))
/** The old star gold, and the retired v1 golds and cream (CLAUDE.md §3). */
const GOLD = /#?(?:E1B04A|D4AF37|C8A864|F2EBDD)\b/i

/** 2566 Keats as its stored render_args carry it (cmas.slug cma-2566-keats). */
const keatsSubject = {
  listingKey: 'S-KEATS',
  mlsNumber: '1',
  streetAddress: '2566 Keats',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'Hampton Park',
  latitude: 44.0754,
  longitude: -121.2939,
  beds: 4,
  baths: 3,
  sqft: 2388,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2000,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/keats.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Canceled',
  lastListPrice: 649900,
  lastListDate: '2026-04-01',
  listingHistoryLine: null,
} as CmaSubject

const pricing = {
  conservative: 620000,
  recommended: 639000,
  highEnd: 655000,
  valueLow: 620000,
  valueHigh: 655000,
  predictedClose: 630000,
  confidence: 'High',
  confidenceReason: 'Tight',
  notes: [],
} as unknown as CmaPricing

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

function rival(
  listingKey: string,
  address: string,
  status: 'Active' | 'Pending',
  listPrice: number,
  sqft: number | null,
): CmaBandRival {
  return {
    listingKey,
    address,
    listPrice,
    status,
    daysOnMarket: 10,
    photoUrl: null,
    latitude: 44.07,
    longitude: -121.29,
    beds: 3,
    baths: 2,
    sqft,
    yearBuilt: 1998,
    propertySubType: 'Single Family Residence',
    originalListPrice: listPrice,
  }
}

/** The six homes the Keats competition chapter draws, list price and living area as stored. */
const KEATS_RIVALS: CmaBandRival[] = [
  rival('A1', '2813 North Pilot Butte', 'Active', 569999, 1604),
  rival('A2', '1892 Maker', 'Active', 709900, 1968),
  rival('A3', '3065 Quiet Canyon', 'Active', 675000, 1748),
  rival('A4', '408 Hawthorne', 'Active', 685000, 1864),
  rival('P1', '538 Soaring', 'Pending', 565000, 1807),
  rival('P2', '825 Wiest', 'Pending', 579000, 1627),
]

function bandRivals(rivals: CmaBandRival[]): CmaBandRivalSet {
  return {
    area: null as never,
    lo: 544000,
    hi: 736000,
    activeCount: rivals.filter((r) => r.status === 'Active').length,
    pendingCount: rivals.filter((r) => r.status === 'Pending').length,
    rivals,
    sentence: '',
    source: 'Homes for sale and under contract in Orchard District, from the Oregon Data Share MLS.',
    widenedFrom: null,
    ringsTried: [],
  }
}

const comp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '10 Keats',
  city: 'Bend',
  subdivision: 'Hampton Park',
  latitude: 44.075,
  longitude: -121.293,
  beds: 4,
  baths: 3,
  sqft: 2300,
  lotAcres: 0.14,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2001,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 640000,
  closePrice: 630000,
  closeDate: '2026-08-01',
  daysToOffer: 10,
  domTotal: 20,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 630000,
  ppsfTimeAdjusted: 274,
  sizeAdjustment: 0,
  adjustedPrice: 635000,
  weight: 1,
} as unknown as CmaAdjustedComp

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject: keatsSubject,
    comps: Array.from({ length: 5 }, (_, i) => ({
      ...comp,
      listingKey: `C${i + 1}`,
      address: `${10 + i} Keats`,
      adjustedPrice: 630000 + i * 2000,
    })),
    market: null,
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-10-06T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    bandRivals: bandRivals(KEATS_RIVALS),
    docLinks: { brokerSlug: 'matt', personId: null, cmaSlug: 'cma-2566-keats' },
    expiredAudit: {
      findings: [{ code: 'ask-above-range', fact: 'The final asking price was $649,900.' }],
      finalCycle: { initialAsk: 699000, cuts: [] },
    } as never,
    ...over,
  } as RenderCmaArgs
}

const opinion = (over: Partial<RenderCmaArgs> = {}) => args(over) as unknown as OpinionPageArgs

describe('the close has one next step', () => {
  it('leads with one primary button to the broker calendar, then Call and Text', () => {
    const a = opinion()
    const html = nextStepButtonsHtml(a)
    const anchors = html.match(/<a [^>]*>[^<]*<\/a>/g) ?? []
    expect(anchors).toHaveLength(3)
    expect((html.match(/class="btn pri/g) ?? []).length).toBe(1)
    expect(anchors[0]).toContain('class="btn pri next-btn"')
    expect(anchors[0]).toContain('data-rr-track="cma-book"')
    expect(anchors[0]).toContain('>Pick a time with Matt<')
    expect(anchors[1]).toContain('href="tel:+15417033095"')
    expect(anchors[1]).toContain('>Call<')
    expect(anchors[2]).toContain('href="sms:+15417033095"')
    expect(anchors[2]).toContain('>Text<')
    for (const a2 of anchors) expect(a2).toContain('next-btn')
  })

  it('keeps the calendar link exactly as the contact table built it', () => {
    const a = opinion()
    const expected = new URL(trackedDocLink('book', '', a.docLinks!))
    expected.searchParams.set('agent', 'matt')
    const href = /href="([^"]+)" data-rr-track="cma-book"/.exec(nextStepButtonsHtml(a))?.[1]
    expect(href?.replace(/&amp;/g, '&')).toBe(expected.toString())
    expect(href).toContain('utm_campaign=cma-letter')
    expect(href).toContain('rr_doc=cma-2566-keats')
    expect(href).toContain('/book?')
  })

  it('books the signing broker, not Matt, on a Paul document', () => {
    const a = opinion({
      broker: { ...broker, slug: 'paul-stevenson', displayName: 'Paul Stevenson', phone: '5415023436' },
    })
    const html = nextStepButtonsHtml(a)
    expect(html).toContain('>Pick a time with Paul<')
    expect(html).toContain('agent=paul')
    expect(html).not.toContain('agent=paul-stevenson')
    expect(html).toContain('tel:+15415023436')
    expect(html).not.toContain('5417033095')
  })

  it('drops Call and Text, not the calendar, when the broker has no published line', () => {
    const html = nextStepButtonsHtml(opinion({ broker: { ...broker, phone: null } }))
    expect(html).toContain('cma-book')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('sms:')
  })

  it('puts the same row in the letter, under the heading', () => {
    expect(nextStepActionsHtml(opinion())).toMatch(/^<div class="cta-actions next-cta">/)
    const { html } = renderCmaHtml(args())
    const close = html.slice(html.indexOf("We&#39;re sorry your home didn&#39;t sell"))
    expect(close.indexOf('next-cta')).toBeGreaterThan(-1)
    expect(close.indexOf('next-cta')).toBeLessThan(close.indexOf('next-note'))
    expect(close).toContain('>Pick a time with Matt<')
  })

  it('puts the same row in the web report, under the heading', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    const close = html.slice(html.indexOf('id="next-step"'))
    expect(close).toContain('class="cta next-cta r"')
    expect(close.indexOf('next-cta')).toBeLessThan(close.indexOf('next-note'))
    expect(close).toContain('>Pick a time with Matt<')
    expect(close).toContain('>Call<')
    expect(close).toContain('>Text<')
  })

  it('holds every button and contact row to a 44px tap target in both stylesheets', () => {
    const immersive = immersiveStylesheet()
    expect(immersive).toMatch(/\.btn\.next-btn\{[^}]*min-height:48px/)
    expect(immersive).toMatch(/\.reach dd a\{[^}]*min-height:44px/)
    expect(immersive).toMatch(/\.reach-row\{[^}]*min-height:44px/)
    const letterCss = readFileSync(join(process.cwd(), 'lib/cma/render-css.ts'), 'utf8')
    expect(letterCss).toMatch(/\.cta-actions a\.next-btn \{[^}]*min-height: 44px/)
    expect(letterCss).toMatch(/\.cta-actions a\.next-btn \{[^}]*text-transform: none/)
  })

  it('does not repeat the calendar or the number as extra contact rows', () => {
    const note = nextStepNoteHtml(opinion())
    expect(note).not.toContain('>Calendar<')
    expect(note).not.toContain('Pick a time')
    expect((note.match(/541\.703\.3095/g) ?? []).length).toBe(1)
    expect((note.match(/class="reach-row"/g) ?? []).length).toBe(5)
  })
})

describe('the close copy', () => {
  it('is two short paragraphs, warm, and says earn your business once', () => {
    const note = nextStepNoteHtml(opinion())
    const paragraphs = [...note.matchAll(/<p class="next-note">([^<]*)<\/p>/g)].map((m) => m[1]!)
    expect(paragraphs).toEqual([
      'If you decide to list again, we would love the opportunity to earn your business. We&#39;d like to sit down with you, go through the house, and show you the detailed marketing plan we use.',
      'There is nothing to sign and no obligation. Who you list with is your decision, and we&#39;re here for any questions about this report.',
    ])
    expect(note).not.toMatch(EM_DASH)
    expect(nextStepButtonsHtml(opinion())).not.toMatch(EM_DASH)
  })

  it('keeps the not-an-appraisal line on both documents', () => {
    const { html } = renderCmaHtml(args())
    const web = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    for (const doc of [html, web]) {
      expect(doc).toContain('This is a comparative market analysis. It is not an appraisal.')
    }
  })
})

describe('the reviews sit in the palette', () => {
  it('prints the reviews as written, with the Google link', () => {
    const note = nextStepNoteHtml(opinion())
    expect(note).toContain('You will not be disappointed ....')
    expect(note).toContain('Matt is the best!!')
    expect(note).toContain('Read the rest of the Google reviews')
    expect(note).toContain('data-rr-track="cma-reviews"')
  })

  it('has no gold star, no white card and no Georgia italic on either document', () => {
    const immersive = immersiveStylesheet()
    const rules = (css: string) =>
      css
        .split(/\n/)
        .filter((l) => /close-(?:quote|lead|line|stars|review)|reach|next-/.test(l))
        .join('\n')
    const letterCss = readFileSync(join(process.cwd(), 'lib/cma/render-css-sections.ts'), 'utf8')
    for (const css of [rules(immersive), rules(letterCss)]) {
      expect(css).not.toMatch(GOLD)
      expect(css).not.toMatch(/Georgia/)
      expect(css).not.toMatch(/font-style:\s*italic/)
      expect(css).not.toMatch(/\.close-quote[^{]*\{[^}]*background:\s*#fff/)
    }
    expect(immersive).toMatch(/\.close-reviews \.close-quote p\.close-stars\{[^}]*color:inherit/)
    expect(immersive).toMatch(/\.close-lead\{[^}]*font-family:Geist/)
  })
})

describe('the competition chapter says the size and price edge only when it is true', () => {
  const keats = KEATS_RIVALS.map((r) => ({ sqft: r.sqft ?? null, listPrice: r.listPrice }))

  it('Keats: larger than all six and lowest per square foot at the recommended list', () => {
    // §0 trace: 639,000 / 2,388 = 267.59 -> $268. Theirs, rounded as the
    // matrix rounds: 569,999/1,604 = 355; 709,900/1,968 = 361; 675,000/1,748 =
    // 386; 685,000/1,864 = 367; 565,000/1,807 = 313; 579,000/1,627 = 356.
    const edge = competitionEdge({ subjectSqft: 2388, recommended: 639000, competitors: keats })
    expect(edge).toEqual({
      sentence:
        'At 2,388 square feet, your home is larger than all 6 homes below, and at the list price we recommend it is priced lower per square foot than any of them: $268, against $313 to $386.',
      largest: true,
      lowestPpsf: true,
      subjectPpsf: 268,
      competitorPpsf: { lo: 313, hi: 386 },
    })
    expect(edge!.sentence).not.toMatch(EM_DASH)
    // recommend-once: the cover owns $639,000.
    expect(edge!.sentence).not.toContain('639')
  })

  it('not the largest: says only the price edge', () => {
    const edge = competitionEdge({
      subjectSqft: 1700,
      recommended: 450000,
      competitors: keats,
    })
    // 450,000 / 1,700 = 264.7 -> $265, under every one of them; 1,700 is not
    // more than 1,968.
    expect(edge?.largest).toBe(false)
    expect(edge?.lowestPpsf).toBe(true)
    expect(edge?.sentence).toBe(
      'At the list price we recommend, your home is priced lower per square foot than any of the 6 homes below: $265, against $313 to $386.',
    )
  })

  it('not the lowest per square foot: says only the size edge', () => {
    const edge = competitionEdge({ subjectSqft: 2388, recommended: 800000, competitors: keats })
    // 800,000 / 2,388 = 335 -> above 313, so no price claim.
    expect(edge?.largest).toBe(true)
    expect(edge?.lowestPpsf).toBe(false)
    expect(edge?.sentence).toBe('At 2,388 square feet, your home is larger than all 6 homes below.')
  })

  it('neither: says nothing (61404 Skene against its three)', () => {
    // 3,596,000 / 4,420 = 814; Hosmer Lake homes are 5,000 and 5,140 sqft at 800 and 778.
    expect(
      competitionEdge({
        subjectSqft: 4420,
        recommended: 3596000,
        competitors: [
          { sqft: 3282, listPrice: 3865000 },
          { sqft: 5000, listPrice: 3999900 },
          { sqft: 5140, listPrice: 3999000 },
        ],
      }),
    ).toBeNull()
  })

  it('makes no claim it cannot check against every home shown', () => {
    expect(
      competitionEdge({
        subjectSqft: 2388,
        recommended: 639000,
        competitors: [...keats.slice(0, 5), { sqft: null, listPrice: 579000 }],
      }),
    ).toBeNull()
    expect(competitionEdge({ subjectSqft: null, recommended: 639000, competitors: keats })).toBeNull()
    expect(competitionEdge({ subjectSqft: 2388, recommended: 639000, competitors: [] })).toBeNull()
    // A tie is not "larger", and a rounded tie is not "lower".
    expect(
      competitionEdge({ subjectSqft: 2000, recommended: 600000, competitors: [{ sqft: 2000, listPrice: 600000 }] }),
    ).toBeNull()
    // Without a list price on every home the size edge still stands alone.
    expect(
      competitionEdge({
        subjectSqft: 2388,
        recommended: 639000,
        competitors: [...keats.slice(0, 5), { sqft: 1627, listPrice: null }],
      })?.sentence,
    ).toBe('At 2,388 square feet, your home is larger than all 6 homes below.')
  })

  it('reads naturally with one or two homes, and never says "we recommend" to a home listed elsewhere', () => {
    expect(
      competitionEdge({ subjectSqft: 2388, recommended: 639000, competitors: keats.slice(0, 1) })?.sentence,
    ).toBe(
      'At 2,388 square feet, your home is larger than the one home below, and at the list price we recommend it is priced lower per square foot than that home: $268, against $355.',
    )
    expect(
      competitionEdge({ subjectSqft: 2388, recommended: 639000, competitors: keats.slice(0, 2) })?.sentence,
    ).toBe(
      'At 2,388 square feet, your home is larger than both homes below, and at the list price we recommend it is priced lower per square foot than either of them: $268, against $355 to $361.',
    )
    expect(
      competitionEdge({ subjectSqft: 2388, recommended: 639000, competitors: keats, nonSoliciting: true })
        ?.sentence,
    ).toContain('and at this price it is priced lower')
  })

  it('prints in the chapter on both documents, from the homes the chapter draws', () => {
    const sentence =
      'At 2,388 square feet, your home is larger than all 6 homes below, and at the list price we recommend it is priced lower per square foot than any of them: $268, against $313 to $386.'
    expect(competitionBodyMatrixHtml(opinion())).toContain(`<p class="compete-edge">${sentence}</p>`)
    const { html } = renderCmaHtml(args())
    const web = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    for (const doc of [html, web]) {
      expect(doc).toContain(sentence)
      expect(findSellerBannedWords(doc).map((h) => h.label)).toEqual([])
    }
  })

  it('stays silent in the chapter when the subject is neither', () => {
    const body = competitionBodyMatrixHtml(
      opinion({
        bandRivals: bandRivals([
          rival('A1', '61456 Weinhard', 'Active', 3865000, 3282),
          rival('A2', '61594 Hosmer Lake', 'Active', 3999900, 5000),
        ]),
        subject: { ...keatsSubject, sqft: 4420 },
        pricing: { ...pricing, recommended: 3596000 } as CmaPricing,
      }),
    )
    expect(body).not.toContain('compete-edge')
    expect(body).not.toContain('square feet, your home')
  })
})
