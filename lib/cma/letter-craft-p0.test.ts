/**
 * Tip Ready CMA letter craft P0 (Matt 2026-09-12).
 * Cover headline once, Pricing report mast, screen stack / print matrix,
 * sorry+earn close, draft banner never on finalized owner PDF.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COVER_LIST_PRICE_HEADLINE, immersiveHeroNumberHtml, immersiveAnswerHtml } from './cover-value'
import { OWNER_FACING_PRODUCT_NAME, cmaCoverLabelHtml } from './fsbo-cma-render'
import { CLOSE_EARN_YOUR_BUSINESS, nextStepHeading, nextStepNoteHtml, assembleOpinionPages } from './opinion-pages'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import { immersiveStylesheet } from './immersive-css'
import { inboundImmersiveHeroKick, inboundImmersiveTitle } from './inbound-packet'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject = {
  listingKey: 'S1',
  mlsNumber: '1',
  streetAddress: '15991 Falcon',
  city: 'La Pine',
  state: 'OR',
  postalCode: '97739',
  subdivision: 'Tall Pines',
  latitude: 43.7,
  longitude: -121.5,
  beds: 3,
  baths: 2,
  sqft: 1600,
  lotAcres: 0.25,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/falcon.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
} as CmaSubject

const pricing = {
  conservative: 485000,
  recommended: 497800,
  highEnd: 510000,
  valueLow: 485000,
  valueHigh: 510000,
  predictedClose: 490000,
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

const comp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '12 Pine',
  city: 'La Pine',
  subdivision: 'Tall Pines',
  latitude: 43.71,
  longitude: -121.51,
  beds: 3,
  baths: 2,
  sqft: 1580,
  lotAcres: 0.22,
  propertySubType: null,
  yearBuilt: 1999,
  photoUrl: 'https://cdn.example/c1.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 510000,
  closePrice: 500000,
  closeDate: '2026-06-01',
  daysToOffer: 10,
  domTotal: 20,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 500000,
  ppsfTimeAdjusted: 316,
  sizeAdjustment: 0,
  adjustedPrice: 500000,
  weight: 1,
  listingHistoryLine:
    'Listed May 1, 2026 at $529,000, cut to $510,000, sold Jun 1, 2026 at $500,000 · 20 days on market',
} as unknown as CmaAdjustedComp

function five(): CmaAdjustedComp[] {
  return Array.from({ length: 5 }, (_, i) => ({
    ...comp,
    listingKey: `C${i + 1}`,
    address: `${10 + i} Pine`,
    adjustedPrice: 500000 + i * 1000,
  }))
}

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps: five(),
    market: null,
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,COMPSMAP',
    subjectMapDataUri: 'data:image/png;base64,SUBJECTMAP',
    generatedAtIso: '2026-09-12T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    expiredAudit: {
      findings: [{ code: 'ask-above-range', fact: 'The final asking price was $525,000.' }],
      finalCycle: { initialAsk: 549000, cuts: [] },
    } as never,
    ...over,
  }
}

describe('letter craft P0 — cover headline once', () => {
  it('locks the long cover headline string on letter + immersive', () => {
    expect(COVER_LIST_PRICE_HEADLINE).toBe('Our Recommended List Price for your home')
    const { html } = renderCmaHtml(args())
    expect(html).toContain(COVER_LIST_PRICE_HEADLINE)
    expect(html).toContain('cover-headline')
    expect(html).toContain('hero-trio')
    expect(html).toContain('data-recommend-once')
    expect(html).toContain('>Low<')
    expect(html).toContain('>High<')
    expect(html).toContain('>Recommended<')
    expect(html).not.toContain('cover-price')
    expect(html).not.toContain('We recommend listing at')
    // Fold chapter is not titled with the recommend dollars.
    expect(html).not.toContain('class="section is-answer">$497,800')
    expect(html).toContain('The sales support')
    const hero = immersiveHeroNumberHtml({
      subject,
      comps: five(),
      market: null,
      pricing,
    })
    expect(hero).toContain(COVER_LIST_PRICE_HEADLINE)
    expect(hero).toContain('hero-trio')
    expect(hero).toContain('>Low<')
    expect(hero).toContain('>High<')
    expect(hero).toContain('>Recommended<')
    expect(hero).toContain('$497,800')
    expect(hero).not.toMatch(/>Recommended list</)
    const fold = immersiveAnswerHtml({
      subject,
      comps: five(),
      market: null,
      pricing,
    })
    expect(fold).not.toContain('$497,800')
    expect(fold).not.toContain('Recommended list')
  })
})

describe('letter craft P0 — one product name', () => {
  it('uses Pricing report on mast and titles, never mixes Comparative market analysis there', () => {
    expect(OWNER_FACING_PRODUCT_NAME).toBe('Pricing report')
    expect(cmaCoverLabelHtml()).toContain('Pricing report')
    expect(cmaCoverLabelHtml()).not.toContain('Comparative market analysis')
    expect(inboundImmersiveHeroKick('15991 Falcon')).toBe('Pricing report · 15991 Falcon')
    expect(inboundImmersiveTitle('15991 Falcon')).toContain('Pricing report')
    const { html } = renderCmaHtml(args())
    expect(html).toContain('<title>Pricing report ·')
    expect(html).toContain('cover-label')
    expect(html).toContain('>Pricing report<')
    expect(html.match(/Comparative market analysis/g)?.length ?? 0).toBeLessThanOrEqual(1) // statutory fine print ok
  })
})

describe('comparable matrix photographs', () => {
  it('stays solid when the key-value label fade is on the same table', () => {
    const css = immersiveStylesheet()
    const fade = css.indexOf('.letter-body table.kv th{')
    const solid = css.indexOf('.letter-body table.kv.comp-matrix thead th{opacity:1}')
    expect(fade).toBeGreaterThan(-1)
    expect(solid).toBeGreaterThan(fade)
  })
})

describe('letter craft P0 — screen matrix / print matrix', () => {
  it('CSS shows matrix on default screen; narrow stacks; print keeps matrix', () => {
    const letterCss = readFileSync(join(process.cwd(), 'lib/cma/render-css-sections.ts'), 'utf8')
    const immersiveCss = readFileSync(join(process.cwd(), 'lib/cma/immersive-css.ts'), 'utf8')
    expect(letterCss).toMatch(/\.comp-matrix-wrap \{ display: block;/)
    expect(letterCss).toMatch(/\.comp-stack \{ display: none;/)
    expect(letterCss).toMatch(/@media screen and \(max-width: 700px\)/)
    expect(immersiveCss).toMatch(/\.comp-matrix-wrap\{display:block/)
    expect(immersiveCss).toMatch(/\.comp-stack\{display:none/)
    expect(immersiveCss).toMatch(
      /@media print\{\.comp-stack\{display:none!important\}\.comp-matrix-wrap,\.matrix-group-h\{display:block!important\}/,
    )
  })
})

describe('letter craft P0 — close voice', () => {
  it('keeps sorry heading and adds earn-your-business line', () => {
    const a = {
      subject,
      comps: five(),
      market: null,
      pricing,
      broker,
      generatedAtIso: '2026-09-12T00:00:00.000Z',
      expiredAudit: args().expiredAudit,
    }
    expect(nextStepHeading(a as never)).toBe('Sorry this listing did not sell.')
    const note = nextStepNoteHtml(a as never)
    expect(note).toContain('earn your business')
    expect(note).toContain('second set of eyes on pricing')
    const { html } = renderCmaHtml(args())
    expect(html).toContain('Sorry this listing did not sell.')
    expect(html).toContain('earn your business')
  })
})

describe('letter craft P0 — draft banner never on finalized owner PDF', () => {
  const BLOCKED =
    'This report is under broker review and is not final. Do not rely on the price in it until a broker has signed off.'
  const reviewPricing = {
    ...pricing,
    review: { severity: 'blocked', rendererNotice: BLOCKED },
  } as unknown as CmaPricing

  it('still shows the band on a draft letter', () => {
    const { html } = renderCmaHtml(args({ pricing: reviewPricing, documentStatus: 'needs_review' }))
    expect(html).toContain(BLOCKED)
  })

  it('suppresses the band when documentStatus is finalized or delivered', () => {
    for (const status of ['finalized', 'delivered'] as const) {
      const { html } = renderCmaHtml(args({ pricing: reviewPricing, documentStatus: status }))
      expect(html).not.toContain('under broker review')
      const immersive = renderImmersiveCmaHtml(
        { ...args({ pricing: reviewPricing, documentStatus: status }), broker },
        'https://ryan-realty.com',
      )
      expect(immersive).not.toContain('under broker review')
    }
  })
})

describe('letter craft P0 — one map', () => {
  it('emits exactly one comps pin map', () => {
    const { html } = renderCmaHtml(args())
    expect((html.match(/class="pin-map"/g) ?? []).length).toBe(1)
    expect(html).not.toContain('SUBJECTMAP')
  })
})

describe('letter craft Matt ADD 2026-09-12', () => {
  it('kills how-the-price-moved chart and keeps one pin map', () => {
    const { html } = renderCmaHtml(args())
    expect(html).not.toContain('How the price moved')
    expect((html.match(/class="pin-map"/g) ?? []).length).toBe(1)
  })

  it('prints list $/sqft, sold $/sqft, concession $, and lot size on sold matrix/stack', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toContain('List $/sqft')
    expect(html).toContain('Sold $/sqft')
    expect(html).toContain('Seller concessions')
    expect(html).toContain('Lot size')
  })

  it('prints list $/sf and sold $/sf summaries by status from the selected homes', () => {
    const extras = {
      marketArea: {
        expiredPeers: [
          {
            listingKey: 'E1',
            address: '88 Cedar',
            listPrice: 540000,
            originalListPrice: 540000,
            status: 'Expired',
            daysOnMarket: 90,
            onMarketDate: '2025-12-01',
            photoUrl: null,
            listingHistoryLine: null,
            beds: 3,
            baths: 2,
            sqft: 1500,
            yearBuilt: 1997,
            lotAcres: 0.2,
            propertySubType: 'Single Family Residence',
            latitude: 43.72,
            longitude: -121.52,
          },
        ],
      },
      band: {
        lo: 470000,
        hi: 530000,
        activeCount: 1,
        pendingCount: 0,
        activeMedianAsk: 520000,
        activeMedianDom: 12,
        source: 'test',
        rivals: [
          {
            listingKey: 'A1',
            address: '22 Fir',
            listPrice: 520000,
            status: 'Active' as const,
            daysOnMarket: 12,
            photoUrl: null,
            latitude: 43.705,
            longitude: -121.505,
            beds: 3,
            baths: 2,
            sqft: 1600,
            yearBuilt: 2001,
            lotAcres: 0.21,
            originalListPrice: 520000,
          },
        ],
      },
    }
    const a = args({ extras: extras as never })
    const { html } = renderCmaHtml(a)
    const immersive = renderImmersiveCmaHtml({ ...a, broker }, 'https://ryan-realty.com')
    for (const doc of [html, immersive]) {
      expect(doc).toContain('data-ppsf-status="board"')
      expect(doc).toContain('Dollars a square foot')
      expect(doc).toContain('List $/sf')
      expect(doc).toContain('Sold $/sf')
      expect(doc).toContain('>Sold<')
      expect(doc).toContain('>Active<')
      expect(doc).toContain('>Expired<')
      // 510000/1580 list and 500000/1580 sold on the five closed sales.
      expect(doc).toContain('$323')
      expect(doc).toContain('$316')
      // Active 520000/1600 = 325; expired 540000/1500 = 360.
      expect(doc).toContain('$325')
      expect(doc).toContain('$360')
      expect(doc).not.toMatch(/data-ppsf-status="board"[\s\S]{0,800}months of supply/i)
    }
  })
})

