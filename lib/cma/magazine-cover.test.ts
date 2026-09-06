/**
 * Print PDF and immersive web share one visual thesis: the house is the
 * cover, and the recommended list sits on the photo. After the pill cut we
 * shipped a timid letter (280px postage-stamp hero, navy box below, 5-up
 * stat strip). That is the defect this locks.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import { cmaStylesheet } from './render-css'
import { immersiveStylesheet } from './immersive-css'
import { immersiveHeroNumberHtml } from './cover-value'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220126412',
  streetAddress: '648 SE Douglas Street',
  city: 'Bend',
  state: 'OR',
  postalCode: '97702',
  subdivision: 'Clear Sky Estates',
  latitude: 44.05,
  longitude: -121.29,
  beds: 3,
  baths: 1,
  sqft: 1056,
  lotAcres: 0.14,
  propertySubType: null,
  yearBuilt: 1978,
  garageSpaces: 1,
  photoUrl: 'https://cdn.example/douglas.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Closed',
  lastListPrice: 445000,
  lastListDate: '2021-07-01',
  listingHistoryLine: null,
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '220222218',
  address: '947 SE 6th Street',
  city: 'Bend',
  subdivision: 'Clear Sky Estates',
  latitude: 44.05,
  longitude: -121.29,
  beds: 3,
  baths: 1,
  sqft: 1036,
  lotAcres: 0.14,
  propertySubType: null,
  yearBuilt: 1978,
  photoUrl: 'https://cdn.example/6th.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 499000,
  closePrice: 495000,
  closeDate: '2026-06-10',
  daysToOffer: 6,
  domTotal: 10,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 495000,
  ppsfTimeAdjusted: 478,
  sizeAdjustment: 0,
  adjustedPrice: 465744,
  weight: 1,
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

const pricing = {
  method1Low: 440000,
  method1Mid: 450000,
  method1High: 460000,
  method2: 448000,
  method3: 452000,
  conservative: 464000,
  recommended: 472000,
  highEnd: 481000,
  valueLow: 448000,
  valueHigh: 480000,
  predictedClose: 452000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
} as unknown as CmaPricing

function args(): RenderCmaArgs {
  return {
    subject,
    comps: [comp],
    market: null,
    pricing,
    broker,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-08-18T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    tiersUsed: ['subdivision-3mo'],
  }
}

function firstPage(html: string): string {
  const start = html.indexOf('class="page')
  const next = html.indexOf('class="page', start + 1)
  return next > 0 ? html.slice(start, next) : html.slice(start)
}

describe('print CMA magazine cover', () => {
  it('puts the house and the recommended list on one full-bleed stage', () => {
    const { html } = renderCmaHtml(args())
    const cover = firstPage(html)
    expect(cover).toContain('cover-stage')
    expect(cover).toContain('class="hero-photo"')
    expect(cover).toContain('class="cover-title"')
    expect(cover).toContain('648 SE Douglas Street')
    expect(cover).toContain('Recommended list')
    expect(cover).toContain('$472,000')
    expect(cover).not.toContain('Expected close')
    expect(cover.indexOf('cover-stage')).toBeLessThan(cover.indexOf('hero-photo'))
    expect(cover.indexOf('hero-photo')).toBeLessThan(cover.indexOf('vb-price'))
    expect(cover).toContain('3 bedrooms')
    expect(cover).toContain('1 bath')
    expect(cover).toContain('1,056 sq ft')
    expect(cover).not.toContain('stat-strip')
    expect(cover).not.toContain('pg-header')
  })

  it('does not pin the cover photo at a 280px postage stamp', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).toContain('.cover-stage')
    expect(css).toMatch(/\.cover-stage\s*\{[^}]*min-height:\s*9/)
    expect(css).not.toMatch(/\.page-cover\s+\.hero-photo\s*\{[^}]*height:\s*280px/)
  })

  it('crops the cover photo down so MLS location arrows at the top of the frame sit off the page', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).toMatch(/\.hero-photo\s*\{[^}]*height:\s*1[3-9]\d%/)
    expect(css).toMatch(/\.hero-photo\s*\{[^}]*top:\s*-/)
    expect(css).not.toMatch(/\.hero-photo\s*\{[^}]*inset:\s*0/)
  })

  it('hides the cover product bar on a phone so the specs line stays in view', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).toMatch(
      /@media screen and \(max-width: 700px\)[\s\S]*\.page-cover \.cma-product-bar\s*\{[^}]*display:\s*none/,
    )
    expect(css).toMatch(
      /@media screen and \(max-width: 700px\)[\s\S]*\.cover-specs\s*\{[^}]*white-space:\s*nowrap/,
    )
  })

  it('puts an opaque navy field behind the cover title so MLS location type in the photo cannot sit on the address', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).toMatch(/\.cover-mast\s*\{[^}]*background:\s*linear-gradient/)
    expect(css).toMatch(/\.cover-mast\s*\{[^}]*top:\s*0/)
  })
})

describe('immersive CMA first screen', () => {
  it('pays off the recommended list on the hero, not only after a scroll', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    const heroEnd = html.indexOf('id="answer"')
    const hero = html.slice(0, heroEnd)
    expect(hero).toContain('class="sc hero on"')
    expect(hero).toContain('Recommended list')
    expect(hero).toContain('$472,000')
    expect(hero).not.toContain('Expected close')
    expect(hero).toContain('hero-payoff')
    expect(html).toContain('id="answer"')
    expect(html).toContain('Recommended list')
  })

  it('renders the hero number from the same cover facts as print', () => {
    const block = immersiveHeroNumberHtml(args())
    expect(block).toContain('Recommended list')
    expect(block).toContain('$472,000')
    expect(block).not.toContain('Expected close')
    expect(block).not.toContain('data-count')
    expect(block).not.toMatch(/[—;]/)
  })

  it('keeps the scroll cue square and drops white card islands', () => {
    const css = immersiveStylesheet()
    expect(css).not.toMatch(/\.cue\s*\{[^}]*border-radius:\s*1?[1-9]\d*px/)
    expect(css).not.toMatch(/\.comp-row\s*\{[^}]*background:#fff/)
    expect(css).toMatch(/\.comp-row\s*\{[^}]*background:var\(--cream\)/)
  })
})
