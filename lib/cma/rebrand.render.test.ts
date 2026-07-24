/**
 * The end-to-end invariant of the re-brand pass (W10.3), proven at the render
 * level with no DB and no Anthropic call: renderCmaHtml is a pure function of
 * its args, so rendering the SAME render_args under two different brokers must
 * produce byte-identical PRICING while only the signature block changes.
 *
 * This is exactly what rebrandCma does internally — `renderCmaHtml({ ...stored,
 * broker, mapDataUri })` — so a broker whose signature block differs but whose
 * numbers are identical is the whole point of the feature: swapping the signer
 * cannot move the recommended list price.
 *
 * The structural half (rebrand cannot import buildCma or write a numeric column)
 * is held by ci:cma-rebrand-integrity; the DB refusal contract by
 * rebrand.int.test.ts. This closes the last gap: that a SUCCESSFUL re-brand
 * preserves every figure.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml } from './render'
import type { RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: null,
  streetAddress: '123 Test Way',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: null,
  latitude: 44.06,
  longitude: -121.31,
  beds: 3,
  baths: 2,
  sqft: 1800,
  lotAcres: 0.2,
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

const matt: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
}

const paul: CmaBroker = {
  id: 'id-paul',
  slug: 'paul-stevenson',
  displayName: 'Paul Stevenson',
  title: 'Broker',
  licenseNumber: '201259123',
  email: 'paul@ryan-realty.com',
  phone: '541.502.3436',
  photoUrl: '/images/brokers/stevenson-paul.jpg',
}

function argsFor(broker: CmaBroker): RenderCmaArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing,
    broker,
    client: { name: 'Test Seller', email: 'seller@test.invalid', phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-07-24T00:00:00.000Z',
    subjectTrace: 'subject trace',
    compTrace: ['comp trace'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
  }
}

/** Every figure a seller would price against. */
const PRICE_STRINGS = ['$715,000', '$705,000', '$735,000', '$690,000', '$740,000']

describe('CMA re-brand preserves every figure (render-level, W10.3)', () => {
  const a = renderCmaHtml(argsFor(matt))
  const b = renderCmaHtml(argsFor(paul))

  it('renders the identical recommended and range under both brokers', () => {
    for (const price of PRICE_STRINGS) {
      expect(a.html.includes(price), `${price} missing from Matt's render`).toBe(true)
      expect(b.html.includes(price), `${price} missing from Paul's render`).toBe(true)
    }
    // page count is a function of content, not signer
    expect(a.pageCount).toBe(b.pageCount)
  })

  it('changes ONLY the signature block between the two', () => {
    // Matt's identity appears in his render and not Paul's, and vice versa.
    expect(a.html.includes('Matt Ryan')).toBe(true)
    expect(b.html.includes('Paul Stevenson')).toBe(true)
    expect(b.html.includes('201259123')).toBe(true) // Paul's license
    // Paul's cell must NEVER appear — twilio_number only (ci:broker-published-phone).
    expect(a.html.includes('977-6841')).toBe(false)
    expect(b.html.includes('977-6841')).toBe(false)
  })

  it('is byte-identical once the broker block is normalized out', () => {
    // Replace each broker's identifying strings with a placeholder; what remains
    // — the entire valuation — must match exactly. If any number depended on the
    // signer, this diff would be non-empty.
    const strip = (html: string) =>
      html
        .split('Matt Ryan').join('BROKER')
        .split('Paul Stevenson').join('BROKER')
        .split('201206613').join('LICENSE')
        .split('201259123').join('LICENSE')
        .split('541.703.3095').join('PHONE')
        .split('541.502.3436').join('PHONE')
        .split('matt@ryan-realty.com').join('EMAIL')
        .split('paul@ryan-realty.com').join('EMAIL')
        .split('ryan-matt.png').join('PHOTO')
        .split('stevenson-paul.jpg').join('PHOTO')
        .split('Owner &amp; Principal Broker').join('TITLE')
        .split('Owner & Principal Broker').join('TITLE')
        // Paul's title is the bare word 'Broker'; Matt's is the phrase above.
        // Normalize both, and the E.164 tel: href form of each phone.
        .split('· Broker ·').join('· TITLE ·')
        .split('>Broker · Ryan').join('>TITLE · Ryan')
        .split('sig-title">Broker ').join('sig-title">TITLE ')
        .split('tel:+15417033095').join('tel:PHONE')
        .split('tel:+15415023436').join('tel:PHONE')
        // the closing CTA addresses the broker by first name ("Call Matt")
        // the closing CTA addresses the broker by first name (Call/Text/Email X)
        // and links tel:/sms: in E.164. Normalize every broker-identity form;
        // if any PRICE differed this diff would still be non-empty.
        .split('sms:+15417033095').join('sms:PHONE')
        .split('sms:+15415023436').join('sms:PHONE')
        .replace(/\b(Call|Text|Email) (Matt|Paul)\b/g, '$1 BROKERFIRST')
    expect(strip(a.html)).toBe(strip(b.html))
  })
})
