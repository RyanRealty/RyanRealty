import { describe, expect, it } from 'vitest'
import { thisMarketBodyHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { sizeRefusalReason, UNSEATED_PRINT_REASON } from '@/lib/pricing/price-set'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { NotSettingSale } from '@/lib/pricing/price-set'

/** 1,634 sq ft is 36% larger than 1,201, past the one 35% cutoff. */
const PAST_BAND = sizeRefusalReason(1201, 1634)

function args(over: Partial<OpinionPageArgs> = {}): OpinionPageArgs {
  const subject = {
    streetAddress: '2745 Aldrich',
    city: 'Redmond',
    propertySubType: 'Single Family Residence',
    sqft: 1201,
    lotAcres: 0.14,
  } as CmaSubject
  const setter = {
    listingKey: 'SETTER',
    mlsNumber: '220199999',
    address: '2799 Aldrich',
    closePrice: 470000,
    adjustedPrice: 475000,
    weight: 1,
  } as CmaAdjustedComp
  return {
    subject,
    comps: [setter],
    market: null,
    pricing: { recommended: 479000 } as CmaPricing,
    mapDataUri: null,
    generatedAtIso: '2026-10-08T00:00:00.000Z',
    subdivisionStory: {
      facts: {
        name: 'Obsidian Ridge',
        totalSales: 12,
        years: [{ year: 2024, count: 2, medianClose: 480000, medianPpsf: 400 }],
        recordHigh: null,
        recordLow: null,
        medianDomRecent: null,
        saleToListRecentPct: null,
        subjectSqftPercentile: null,
        vintageSpan: null,
        source: 'test',
      },
      sections: [],
      notableSales: [
        {
          listNumber: '220206710',
          address: '2764 Spring Water',
          closePrice: 525000,
          closeDate: '2025-11-12',
          sqft: 1634,
          photoUrl: null,
          line: '',
        },
        {
          listNumber: '220199999',
          address: '2799 Aldrich Ln',
          closePrice: 470000,
          closeDate: '2024-12-04',
          sqft: 1200,
          photoUrl: null,
          line: '',
        },
        {
          listNumber: '220188888',
          address: '2700 Kept Aside',
          closePrice: 610000,
          closeDate: '2025-06-01',
          sqft: 1220,
          photoUrl: null,
          line: '',
        },
        {
          listNumber: '220177777',
          address: '2710 Near',
          closePrice: 460000,
          closeDate: '2025-03-01',
          sqft: 1180,
          photoUrl: null,
          line: '',
        },
      ],
      model: null,
      costUsd: null,
      photoSalesReviewed: 0,
    },
    ...over,
  }
}

function chip(html: string, address: string): string {
  const hits = html.match(/<span class="street-sale-wrap">[\s\S]*?<\/span><\/span>|<a class="street-sale"[\s\S]*?<\/a>/g) ?? []
  return hits.find((hit) => hit.includes(`>${address}`)) ?? ''
}

describe('a printed sale that does not set the price says why, once, beside it (rule 29)', () => {
  const html = thisMarketBodyHtml(
    args({
      pricing: {
        recommended: 479000,
        setAside: [
          {
            listingKey: 'ASIDE-KEY',
            address: '2700 Kept Aside',
            reason: 'lowest of the adjusted sales, set aside so one sale cannot set the range',
          },
        ],
      } as unknown as CmaPricing,
    }),
    'h3',
  )

  it('prints the engine size sentence beside a sale past 35%, and does not size-refuse 31%', () => {
    expect(html.split(PAST_BAND).length - 1).toBe(1)
    const spring = chip(html, '2764 Spring Water')
    expect(spring).toContain('street-sale-why')
    expect(spring).toContain(PAST_BAND)
    const anchor = spring.match(/<a class="street-sale"[\s\S]*?<\/a>/)?.[0] ?? ''
    expect(anchor).not.toContain(PAST_BAND)
    expect(anchor).toContain('2764 Spring Water')
    // The real Spring Water gap, 1,574 against 1,201, is 31%. That sets the
    // price. A history row at that size that is not in the grid says it is
    // not one of the sales, and does not invent a size refusal.
    const inside = thisMarketBodyHtml(
      args({
        subdivisionStory: {
          ...args().subdivisionStory!,
          notableSales: [
            {
              listNumber: '220206710',
              address: '2764 Spring Water',
              closePrice: 525000,
              closeDate: '2025-11-12',
              sqft: 1574,
              photoUrl: null,
              line: '',
            },
          ],
        },
      }),
      'h3',
    )
    const fitted = chip(inside, '2764 Spring Water')
    expect(fitted).toContain(UNSEATED_PRINT_REASON)
    expect(fitted).not.toContain('31%')
    expect(fitted).not.toContain('more than 25%')
    expect(fitted).not.toContain('more than 35%')
  })

  it('does not label a sale that sets the price', () => {
    const setter = chip(html, '2799 Aldrich')
    expect(setter.startsWith('<a class="street-sale"')).toBe(true)
    expect(setter).not.toContain('street-sale-why')
    expect(setter).not.toContain(UNSEATED_PRINT_REASON)
  })

  it('prints the set-aside record beside a sale the range trimmed, even when that record has a listing key', () => {
    const aside = chip(html, '2700 Kept Aside')
    expect(aside).toContain('lowest of the adjusted sales, set aside so one sale cannot set the range')
    expect(aside).not.toContain(UNSEATED_PRINT_REASON)
  })

  it('says a near sale the letter did not seat is not one of the sales that set the price', () => {
    expect(chip(html, '2710 Near')).toContain(UNSEATED_PRINT_REASON)
  })

  it('prints the walk record and does not recompute the gap', () => {
    const note: NotSettingSale = {
      listingKey: 'WALK',
      listNumber: '220206710',
      address: '2764 Spring Water',
      code: 'size',
      reason: 'RECORDED BY THE WALK',
    }
    const recorded = thisMarketBodyHtml(args({ excludedSaleNotes: [note] }), 'h3')
    const spring = chip(recorded, '2764 Spring Water')
    expect(spring).toContain('RECORDED BY THE WALK')
    expect(spring).not.toContain('31%')
    expect(recorded.split('RECORDED BY THE WALK').length - 1).toBe(1)
  })
})
