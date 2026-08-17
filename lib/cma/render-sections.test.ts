/**
 * No-empty-shell contract for the capability sections (zoning, buildability,
 * buyer options, rental, HOA, marketing highlights).
 *
 * The defect this locks is the one that got ClimateRiskBlock deleted from the
 * listing page on 2026-07-28: a section that renders its heading and its
 * framing paragraph when its data resolved to nothing, so the reader sees a
 * promise with no content under it. Every block here returns '' on empty input
 * and the renderer drops the whole page — not a heading with a blank body.
 */
import { describe, expect, it } from 'vitest'
import {
  buyerOptionsBlock,
  chunk,
  cleanText,
  collectHighlights,
  developmentItemsBlock,
  hoaBlock,
  marketingHighlightsBlock,
  rentalIncomeBlock,
  rentalTenuresBlock,
  verifyResourcesBlock,
  zoningExplainerBlock,
} from './render-blocks'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: null,
  streetAddress: '123 Test Way',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'N/A',
  latitude: 44.06,
  longitude: -121.31,
  beds: 3,
  baths: 2,
  sqft: 1800,
  lotAcres: 0.2,
  propertySubType: null,
  yearBuilt: 2005,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: 4200,
  standardStatus: null,
  lastListPrice: null,
  lastListDate: null,
  listingHistoryLine: null,
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '220000001',
  address: '456 Comp St',
  city: 'Bend',
  subdivision: null,
  latitude: 44.05,
  longitude: -121.3,
  beds: 3,
  baths: 2,
  sqft: 1850,
  lotAcres: 0.22,
  propertySubType: null,
  yearBuilt: 2006,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: 4300,
  listPrice: 720000,
  closePrice: 712000,
  closeDate: '2026-05-15',
  daysToOffer: 12,
  domTotal: 12,
  selectionTier: 'primary',
  proximity: '1.75 miles NW',
  competingArea: null,
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 712000,
  ppsfTimeAdjusted: 385,
  sizeAdjustment: -2000,
  adjustedPrice: 710000,
  weight: 1,
}

const pricing: CmaPricing = {
  method1Low: 690000,
  method1Mid: 715000,
  method1High: 740000,
  method2: 718000,
  method3: 712000,
  convergenceSpreadPct: 1.2,
  converged: true,
  conservative: 705000,
  recommended: 715000,
  highEnd: 735000,
  valueLow: 690000,
  valueHigh: 740000,
  confidence: 'High',
  confidenceReason: 'tight comp set',
  needsReview: false,
  reviewReason: null,
  compPpsfCv: 0.04,
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
}

const broker: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
}

const bareArgs: RenderCmaArgs = {
  subject,
  comps: [comp],
  market: null,
  pricing,
  broker,
  client: { name: 'Test Seller', email: null, phone: null, notes: null },
  mapDataUri: null,
  generatedAtIso: '2026-07-30T00:00:00.000Z',
  subjectTrace: 'subject trace',
  compTrace: ['comp trace'],
  excludedOutliers: [],
  sellerImprovementsText: null,
  site: null,
  expiredAudit: null,
  development: null,
  rental: null,
}

describe('capability blocks return nothing when their data is absent', () => {
  it('every block is empty for null / empty input', () => {
    for (const out of [
      zoningExplainerBlock(null),
      developmentItemsBlock(null),
      buyerOptionsBlock(null),
      hoaBlock(null),
      rentalTenuresBlock([]),
      rentalIncomeBlock([]),
      marketingHighlightsBlock([]),
      verifyResourcesBlock(null),
    ]) {
      expect(out).toBe('')
    }
    expect(collectHighlights(null, null)).toEqual([])
  })

  it('a document with no development and no rental prints no capability headings', () => {
    const { html } = renderCmaHtml(bareArgs)
    for (const heading of [
      'Zoning, In Plain Language',
      'What You Can Build Here',
      'What A Buyer Could Do With It',
      'Renting It Out',
      'What It Could Bring In',
      'HOA and CC&amp;Rs',
      'What We Lead With',
      'What this property can do',
      'What You Can Do With This Property',
      'Verify It Yourself',
    ]) {
      expect(html).not.toContain(heading)
    }
  })

  it('the contents page numbers match the pages that actually render', () => {
    const { html, pageCount } = renderCmaHtml(bareArgs)
    // Every contents row points at a page that exists.
    const rows = [...html.matchAll(/<span class="p">(\d+)<\/span>/g)].map((m) => Number(m[1]))
    expect(rows.length).toBeGreaterThan(4)
    for (const n of rows) expect(n).toBeLessThanOrEqual(pageCount)
    // The cover carries the recommended price as the page's largest element.
    expect(html).toContain('class="vb-price">$715,000')
  })
})

describe('render helpers', () => {
  it('scrubs MLS placeholder values instead of printing them', () => {
    expect(cleanText('N/A')).toBeNull()
    expect(cleanText('none')).toBeNull()
    expect(cleanText('Other')).toBeNull()
    expect(cleanText('  ')).toBeNull()
    expect(cleanText('Stone Creek')).toBe('Stone Creek')
    // The subject's subdivision is the literal string 'N/A' above, so it must
    // not reach the cover as "· N/A".
    expect(renderCmaHtml(bareArgs).html).not.toContain('· N/A')
    expect(renderCmaHtml(bareArgs).html).not.toMatch(/\bN\/A\b/)
  })

  it('balances chunks so a section never ends on a one-item page', () => {
    expect(chunk([1, 2, 3, 4, 5], 3).map((g) => g.length)).toEqual([3, 2])
    expect(chunk([1, 2, 3, 4], 5).map((g) => g.length)).toEqual([4])
    expect(chunk([], 3)).toEqual([])
  })

  it('prints the comp proximity, which is the answer to "why these comps"', () => {
    const { html } = renderCmaHtml(bareArgs)
    expect(html).toContain('1.75 miles NW')
  })
})

describe('use-of-property and pricing pages in the assembled document', () => {
  it('prints the zone board and the pricing explanation when development data is present', () => {
    const { html } = renderCmaHtml({
      ...bareArgs,
      development: {
        jurisdiction: 'City of Redmond',
        zone: 'R-2',
        verifiedAsOf: '2026-07-30',
        zoningExplainer: {
          zone: 'R-2',
          zoneName: 'Limited Residential',
          purpose: 'Redmond R-2 holds single-unit homes at a limited density.',
          permittedOutright: ['Single-unit dwelling'],
          conditional: [],
          dimensional: [],
          citation: 'RDC 8.135',
          url: 'https://www.codepublishing.com/OR/Redmond/',
        },
        items: [
          {
            topic: 'ADU',
            verdict: 'yes',
            headline: 'An accessory dwelling is allowed on this lot.',
            detail: 'The lot meets the size test.',
            citation: 'RDC 8.141',
            url: 'https://www.codepublishing.com/OR/Redmond/',
          },
        ],
        buyerOptions: [],
        hoa: null,
        marketingHighlights: [],
        disclaimer: 'This is a preliminary read of published code, not a land-use decision.',
        resources: [],
      },
    })
    expect(html).not.toContain('What this property can do')
    expect(html).not.toContain('class="zm-code">R-2')
    expect(html).toContain('How this home is priced')
    expect(html).toContain('How we priced this')
    expect(html).not.toContain('What You Can Do With This Property')
  })
})
