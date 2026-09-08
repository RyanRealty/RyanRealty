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


function fiveSales(seed: CmaAdjustedComp, n = 5): CmaAdjustedComp[] {
  return Array.from({ length: n }, (_, i) => ({
    ...seed,
    listingKey: seed.listingKey ? `${seed.listingKey}-${i}` : `C${i + 1}`,
    address: i === 0 ? seed.address : `${100 + i} Peer St`,
    adjustedPrice: (seed.adjustedPrice ?? seed.closePrice ?? 500000) + i * 1000,
  }))
}

function args(): RenderCmaArgs {
  return {
    subject,
    comps: fiveSales(comp),
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
  // Blueprint chapter 0: full-bleed listing photo, ONE cream title block over
  // it, the address, one sentence, prepared-for and the date. Everything the
  // old cover also carried — a five-item product bar, a facts blurb, a specs
  // line, a search story, a photo credit and a 72px figure the reader meets
  // again as chapter 3's title — is somewhere it belongs or gone.
  it('puts the house under one cream title block, and one sentence on it', () => {
    const { html } = renderCmaHtml(args())
    const cover = firstPage(html)
    expect(cover).toContain('cover-stage')
    expect(cover).toContain('class="hero-photo"')
    expect(cover).toContain('class="cover-plate"')
    expect(cover).toContain('class="cover-title"')
    expect(cover).toContain('648 SE Douglas Street')
    expect(cover).toContain('Your home is worth $448,000 to $480,000 today.')
    expect(cover).toContain('We recommend listing at $472,000.')
    expect(cover).toContain('Prepared')
    expect(cover).not.toContain('Expected close')
    expect(cover.indexOf('cover-stage')).toBeLessThan(cover.indexOf('hero-photo'))
    expect(cover.indexOf('hero-photo')).toBeLessThan(cover.indexOf('cover-plate'))
    // Cut from the cover, every one of them.
    expect(cover).not.toContain('3 bedrooms')
    expect(cover).not.toContain('1,056 sq ft')
    expect(cover).not.toContain('cma-product-bar')
    expect(cover).not.toContain('vb-price')
    expect(cover).not.toContain('cover-veil')
    expect(cover).not.toContain('stat-strip')
    expect(cover).not.toContain('pg-header')
  })

  it('does not pin the cover photo at a 280px postage stamp', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    expect(css).toContain('.cover-stage')
    expect(css).toMatch(/\.cover-stage\s*\{[^}]*min-height:\s*9/)
    expect(css).not.toMatch(/\.page-cover\s+\.hero-photo\s*\{[^}]*height:\s*280px/)
  })

  it('contains the cover photo rather than cropping type out of it', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    // Cropping to fill cut the landmark callouts off both edges of 2465 7th's
    // annotated aerial, and no URL tells us whether a photo carries type.
    expect(css).toMatch(/\.hero-photo\s*\{[^}]*object-fit:\s*contain/)
    expect(css).not.toMatch(/\.hero-photo\s*\{[^}]*object-fit:\s*cover/)
    expect(css).not.toMatch(/\.hero-photo\s*\{[^}]*top:\s*-/)
  })

  it('lets the presented line wrap on a phone rather than clipping the client name', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    // It used to be nowrap + ellipsis, which cut "Prepared for" off the name
    // of the person the document is addressed to.
    expect(css).toMatch(
      /@media screen and \(max-width: 700px\)[\s\S]*\.cover-presented, \.hero-caption\s*\{[^}]*white-space:\s*normal/,
    )
    expect(css).not.toMatch(/\.cover-specs\s*\{[^}]*white-space:\s*nowrap/)
  })

  it('sets the title on an opaque cream plate, not on the photograph', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    // Nothing sits on the photo any more, so the house needs no scrim over it
    // to keep type legible — the navy masthead and the full-frame veil are
    // both gone and the plate is a solid cream field.
    expect(css).toMatch(/\.cover-plate\s*\{[^}]*background:\s*var\(--cream\)/)
    // Last in the stage's flex column, so the photo takes the rest of the page.
    expect(css).toMatch(/\.cover-stage\s*\{[^}]*flex-direction:\s*column/)
    expect(css).not.toContain('.cover-mast')
    expect(css).not.toContain('.cover-veil')
    expect(css).toMatch(/\.cover-title\s*\{[^}]*color:\s*var\(--navy\)/)
  })

  it('keeps the cover recommended-list figure inside 375 after the desk-size 72px rule', () => {
    const css = cmaStylesheet('https://ryan-realty.com')
    const desk = css.indexOf('.value-block .vb-price')
    expect(desk).toBeGreaterThan(-1)
    // Desk size is a clamp capped at 72 — at 375 the vw floor wins without any
    // media-query cascade fight (b9e5b8c9 restated 44px after desk and prod
    // still clipped; clamp on the base rule cannot lose).
    const deskBlock = css.slice(desk, desk + 600)
    expect(deskBlock).toMatch(/font-size:\s*clamp\([^)]*72px\)/)
    expect(deskBlock).toMatch(/max-width:\s*100%/)
    // Final phone safety appendix must be the LAST vb-price rule in the sheet
    // (after section CSS) so nothing concatenated later can resurrect 72px.
    const lastPrice = css.lastIndexOf('.value-block .vb-price')
    expect(lastPrice).toBeGreaterThan(desk)
    const tail = css.slice(lastPrice - 120, lastPrice + 220)
    expect(tail).toMatch(/@media screen and \(max-width: 700px\)/)
    expect(css.slice(lastPrice, lastPrice + 220)).toMatch(
      /font-size:\s*(?:clamp\([^)]+|4[0-4]px)/,
    )
    expect(css.slice(lastPrice, lastPrice + 220)).toMatch(/max-width:\s*100%/)
  })

  it('ships a device-width viewport so 375 media queries actually match on a phone', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toMatch(/<meta[^>]+name=["']viewport["'][^>]+width=device-width/)
  })
})

describe('immersive CMA first screen', () => {
  it('pays off the recommended list on the hero, not only after a scroll', () => {
    const html = renderImmersiveCmaHtml({ ...args(), broker }, 'https://ryan-realty.com')
    const heroEnd = html.indexOf('id="what-its-worth"')
    const hero = html.slice(0, heroEnd)
    expect(hero).toContain('class="sc hero on"')
    expect(hero).toContain('Recommended list')
    expect(hero).toContain('$472,000')
    expect(hero).not.toContain('Expected close')
    expect(hero).toContain('hero-payoff')
    expect(html).toContain('id="what-its-worth"')
    expect(html).toContain('$472,000.')
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
