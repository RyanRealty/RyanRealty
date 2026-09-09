/**
 * Falcon pricing beat craft (Matt 2026-09-07): no THE LIST / This list,
 * recommend once on hero, matrix ≥5 on immersive /view screen (not stack-only).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderImmersiveCmaHtml } from './immersive'
import { renderCompMatrixHtml } from './comp-matrix'
import { immersiveAnswerHtml, immersiveHeroNumberHtml } from './cover-value'
import { assembleOpinionScenes } from './opinion-scenes'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { RenderCmaArgs } from './render'

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
  sqft: 1790,
  lotAcres: 0.25,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/falcon.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 575000,
  lastListDate: '2026-01-01',
  listingHistoryLine: null,
} as CmaSubject

const seed = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '12 Pine',
  city: 'La Pine',
  subdivision: 'Tall Pines',
  latitude: 43.71,
  longitude: -121.51,
  beds: 3,
  baths: 2,
  sqft: 1700,
  lotAcres: 0.22,
  propertySubType: null,
  yearBuilt: 1999,
  photoUrl: 'https://cdn.example/c.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 510000,
  closePrice: 500000,
  closeDate: '2026-06-01',
  daysToOffer: 10,
  domTotal: 20,
  selectionTier: 'nearby-5mi-9mo',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 500000,
  ppsfTimeAdjusted: 294,
  sizeAdjustment: 0,
  adjustedPrice: 500000,
  weight: 1,
} as CmaAdjustedComp

const five = Array.from({ length: 5 }, (_, i) => ({
  ...seed,
  listingKey: `C${i + 1}`,
  address: `${10 + i} Pine`,
  adjustedPrice: 500000 + i * 2000,
}))

const pricing = {
  method1Low: 520000,
  method1Mid: 550000,
  method1High: 570000,
  method2: 540000,
  method3: 560000,
  conservative: 522000,
  recommended: 563000,
  highEnd: 575000,
  valueLow: 522000,
  valueHigh: 575000,
  confidence: 'High',
  confidenceReason: 'Five closed sales.',
  needsReview: false,
  reviewReason: null,
  notes: [],
  priceOverride: null,
  predictedClose: 550000,
} as unknown as CmaPricing

function args(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs & { broker: CmaBroker } {
  return {
    subject,
    comps: five,
    market: null,
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,COMPSMAP',
    generatedAtIso: '2026-09-07T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    tiersUsed: ['nearby-5mi-9mo'],
    ...over,
  } as RenderCmaArgs & { broker: CmaBroker }
}

describe('pricing beat craft', () => {
  it('never titles THE LIST / This list; uses the recommend headline', () => {
    const html = renderImmersiveCmaHtml(args(), 'https://ryan-realty.com')
    expect(html).toContain('$563,000.')
    expect(html).not.toMatch(/>\s*THE LIST\s*</i)
    expect(html).not.toMatch(/>\s*The list\s*</)
    expect(html).not.toContain('This list')
    expect(html).not.toContain('This list is')
  })

  it('puts recommend + range once on the hero — no sparse 3-number bar', () => {
    const html = renderImmersiveCmaHtml(args(), 'https://ryan-realty.com')
    expect(html).toContain('hero-payoff')
    expect(html).toContain('$563,000')
    // The recommend is set in type above, so the line under it says what the
    // home is worth — never the same figure twice in two sentences.
    expect(html).toContain('Your home is worth $522,000 to $575,000 today.')
    expect(html).not.toContain('class="range-marks"')
    expect(html).not.toMatch(/class="rm-l">List low</)
    expect(html).not.toContain('id="answer"')
    // Lead sentence appears once (hero), not again under the photo beat.
    const leadHits = html.match(/Your home is worth \$522,000 to \$575,000 today\./g) ?? []
    expect(leadHits.length).toBe(1)
  })

  it('immersiveAnswerHtml no longer restates the three-number strip', () => {
    const html = immersiveAnswerHtml({
      subject,
      comps: five,
      market: null,
      pricing,
      tiersUsed: ['nearby-5mi-9mo'],
    })
    expect(html).not.toContain('class="range-marks"')
    expect(html).not.toMatch(/class="rm-l">List low</)
    expect(html).not.toContain('List $522,000 to $575,000')
    expect(html).toMatch(/opened to 5 mile|5 miles|nearby/i)
  })

  it('immersive /view shows the closed-sales matrix on screen; no Subject/Sale flyer dump', () => {
    expect(renderCompMatrixHtml(subject, five.slice(0, 2))).toBe('')
    const matrix = renderCompMatrixHtml(subject, five)
    expect(matrix).toContain('The sales that set this price')
    expect(matrix).toContain('comp-matrix')
    expect(matrix).toContain('Sale price')
    expect(matrix).toContain('Sold for')
    expect(matrix).toContain('Size')
    expect(matrix).toContain('Days on market')
    expect(matrix).toContain('Sale price today')
    expect(matrix).toContain('data-fact="dom"')
    expect(matrix).not.toContain('data-fact="listing-history"')
    expect(matrix).toContain('Sale price today')
    // Shared HTML still emits stack markup for the letter path; immersive CSS hides it.
    expect(matrix).toContain('comp-stack-card')
    expect(matrix).not.toContain('>Subject</span><span class="h c">Sale<')

    const css = readFileSync(join(process.cwd(), 'lib/cma/immersive-css.ts'), 'utf8')
    expect(css).toMatch(/\.comp-matrix-wrap\{display:block/)
    expect(css).toMatch(/\.comp-stack\{display:none/)
    // F1: below 700px the matrix gives way to the cards. It collapsed the row
    // label column to one character per line at 375 until this landed.
    expect(css).toMatch(/@media screen and \(max-width:700px\)\{\.comp-matrix-wrap,\.matrix-group-h\{display:none\}\.comp-stack\{display:block\}\}/)

    const scenes = assembleOpinionScenes({
      subject,
      comps: five,
      market: null,
      pricing,
      mapDataUri: 'data:image/png;base64,COMPSMAP',
      broker,
      generatedAtIso: '2026-09-07T00:00:00.000Z',
    })
    expect(scenes).toContain('$563,000.')
    expect(scenes).toContain('comp-matrix')
    expect(scenes).toContain('The sales that set this price')
    // A HEADING reading "The list" — not any sentence containing those words,
    // which chapter 2's own title now does ("The listings near you ...").
    expect(scenes).not.toMatch(/>\s*The list\s*</)
    expect(scenes).not.toContain('class="range-marks"')
  })

  it('hero still carries the number; pack CSS cuts cream void', () => {
    const hero = immersiveHeroNumberHtml({
      subject,
      comps: five,
      market: null,
      pricing,
    })
    expect(hero).toContain('$563,000')
    const css = readFileSync(join(process.cwd(), 'lib/cma/immersive-css.ts'), 'utf8')
    expect(css).toContain('.sc.pack{min-height:0')
  })
})
