import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BANNED_BUY_PATHS, H1, TITLE } from './constants'
import { copyHasBannedClaim, nextItems, under500kCopy } from './copy'
import type { Under500kSnapshot, Under500kTownRow } from './data'

function town(over: Partial<Under500kTownRow> & Pick<Under500kTownRow, 'slug' | 'name'>): Under500kTownRow {
  return {
    footnote: false,
    listingsHref: `/homes-for-sale/${over.slug}/under-500k`,
    marketHref: `/housing-market/${over.slug}`,
    lotsHref: `/homes-for-sale/${over.slug}/lots-and-land`,
    under400Href: `/homes-for-sale/${over.slug}/under-400k`,
    under300Href: `/homes-for-sale/${over.slug}/under-300k`,
    residential: 0,
    sfr: 0,
    townhouse: 0,
    condo: 0,
    condoTownhome: 0,
    manufacturedOnLand: 0,
    sharedOrLeased: 0,
    otherResidential: 0,
    sfrMedianList: null,
    sfrMedianN: 0,
    daysToOffer90: null,
    monthsSupply: null,
    priceCutShare: null,
    ...over,
  }
}

function snap(over: Partial<Under500kSnapshot> = {}): Under500kSnapshot {
  const towns = over.towns ?? [
    town({
      slug: 'redmond',
      name: 'Redmond',
      residential: 180,
      sfr: 71,
      townhouse: 63,
      condo: 4,
      condoTownhome: 67,
      manufacturedOnLand: 5,
      sharedOrLeased: 37,
      sfrMedianList: 599_700,
      sfrMedianN: 266,
      daysToOffer90: 33,
      monthsSupply: 4.0,
      priceCutShare: 0.447,
    }),
    town({
      slug: 'bend',
      name: 'Bend',
      residential: 158,
      sfr: 33,
      townhouse: 26,
      condo: 50,
      condoTownhome: 76,
      manufacturedOnLand: 32,
      sharedOrLeased: 17,
      sfrMedianList: 850_000,
      sfrMedianN: 711,
      daysToOffer90: 33,
      monthsSupply: 3.5,
      priceCutShare: 0.454,
    }),
    town({
      slug: 'la-pine',
      name: 'La Pine',
      residential: 144,
      sfr: 94,
      townhouse: 1,
      condoTownhome: 1,
      manufacturedOnLand: 49,
      daysToOffer90: 53,
      monthsSupply: null,
      priceCutShare: 0.562,
    }),
    town({
      slug: 'prineville',
      name: 'Prineville',
      residential: 120,
      sfr: 90,
      manufacturedOnLand: 27,
      sharedOrLeased: 3,
      daysToOffer90: 69,
      monthsSupply: 7.5,
      priceCutShare: 0.49,
    }),
    town({
      slug: 'sisters',
      name: 'Sisters',
      footnote: true,
      residential: 16,
      sfr: 3,
    }),
    town({
      slug: 'sunriver',
      name: 'Sunriver',
      footnote: true,
      residential: 40,
      sfr: 1,
      sharedOrLeased: 29,
    }),
  ]
  return {
    published: true,
    asOfIso: '2026-10-13T19:16:00.000Z',
    asOfLabel: 'Oct 13, 2026',
    headlineResidential: 602,
    headlineSfr: 288,
    towns,
    headlineTowns: towns.filter((t) => !t.footnote),
    footnoteTowns: towns.filter((t) => t.footnote),
    ...over,
  }
}

function publicText(copy: ReturnType<typeof under500kCopy>): string {
  return [
    copy.title,
    copy.metaDescription,
    copy.h1,
    copy.eyebrow,
    ...copy.answer,
    copy.leverageLine,
    copy.methodLine,
    copy.tableCaption,
    copy.lotsLine,
    ...copy.faqs.map((f) => `${f.question} ${f.answer}`),
    ...nextItems().map((item) => `${item.href} ${item.label} ${item.detail ?? ''}`),
  ]
    .filter(Boolean)
    .join(' ')
}

describe('under500kCopy', () => {
  it('prints the Oct 13 four-city split and withholds the $745K trap', () => {
    const copy = under500kCopy(snap())
    expect(copy.title).toBe(TITLE)
    expect(copy.h1).toBe(H1)
    expect(copy.title.length + ' | Ryan Realty'.length).toBeLessThanOrEqual(60)
    expect(copy.metaDescription.length).toBeLessThanOrEqual(155)
    const text = publicText(copy)
    expect(text).toContain('602')
    expect(text).toContain('288')
    expect(text).toContain('158')
    expect(text).toContain('33')
    expect(text).toContain('$850,000')
    expect(text).toContain('buyers have leverage')
    expect(copyHasBannedClaim(text)).toBe(false)
    expect(text.toLowerCase()).not.toContain("buyer's market")
    expect(text.toLowerCase()).not.toContain('$745')
    expect(text.toLowerCase()).not.toContain('745,000')
    expect(text).not.toContain('\u2014')
    expect(text).not.toContain('/buy/alerts')
    expect(text).not.toContain('/buy/leverage')
    expect(text).not.toMatch(/\/buy\/first-time(?!-home-buyer)/)
  })

  it('does not claim leverage for Redmond or Bend from the Oct 13 MOS cells', () => {
    const copy = under500kCopy(snap())
    expect(copy.leverageLine).toBe('Buyers have leverage in Prineville and La Pine on price.')
    expect(copy.leverageLine).not.toContain('Redmond')
    expect(copy.leverageLine).not.toContain('Bend')
  })

  it('withholds a mixed-type median that lands in the $745K band', () => {
    const copy = under500kCopy(
      snap({
        towns: snap().towns.map((t) => (t.slug === 'bend' ? { ...t, sfrMedianList: 745_000 } : t)),
      }),
    )
    expect(publicText(copy)).not.toContain('$745')
    expect(publicText(copy)).not.toContain('745,000')
  })

  it('does not invent a zero-count answer when inventory did not publish', () => {
    const copy = under500kCopy(
      snap({
        published: false,
        headlineResidential: 0,
        headlineSfr: 0,
        asOfLabel: null,
      }),
    )
    const text = publicText(copy)
    expect(text).toContain('not published')
    expect(text).not.toMatch(/0 residential listings are for sale/)
    expect(copyHasBannedClaim(text)).toBe(false)
  })
})

describe('public files stay off the unshipped buy doors', () => {
  it('does not link /buy/alerts, /buy/leverage, or /buy/first-time', () => {
    const files = [
      'app/buy/homes-under-500k-central-oregon/page.tsx',
      'app/buy/homes-under-500k-central-oregon/_v3/copy.ts',
      'app/buy/homes-under-500k-central-oregon/_v3/constants.ts',
    ]
    for (const file of files) {
      const src = readFileSync(resolve(file), 'utf8')
      if (file.endsWith('constants.ts')) {
        expect(src).toContain("'/buy/alerts'")
        continue
      }
      for (const path of ['/buy/alerts', '/buy/leverage', '/buy/first-time']) {
        if (path === '/buy/first-time') {
          expect(src).not.toMatch(/\/buy\/first-time(?!-home-buyer)/)
        } else {
          expect(src).not.toContain(path)
        }
      }
    }
  })
})
