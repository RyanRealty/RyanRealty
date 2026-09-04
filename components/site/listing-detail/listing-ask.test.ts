import { describe, expect, it } from 'vitest'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import {
  buildListingAskClaim,
  buildListingAskHeadline,
  formatAskVsMedianDelta,
  leftoverMarketReportHref,
  publishAskVsMedianPct,
} from './listing-ask'

const HUD: LeftoverHudKpis = {
  active: 12,
  pending: 3,
  closed30: 4,
  new30: null,
  medianList: 1_000_000,
  saleToList: 98.2,
  daysToPending: 19,
  monthsSupply: 4.4,
  sold12mo: 40,
}

const GRAIN = { name: 'Tetherow', hubHref: '/communities/tetherow', geoSlug: 'tetherow' }
const SUNRIVER = { name: 'Sunriver', hubHref: '/communities/sunriver', geoSlug: 'sunriver' }

describe('publishAskVsMedianPct', () => {
  it('is (price - median) / median * 100', () => {
    expect(publishAskVsMedianPct(1_200_000, 1_000_000)).toBe(20)
    expect(publishAskVsMedianPct(900_000, 1_000_000)).toBe(-10)
    expect(publishAskVsMedianPct(1_000_000, 1_000_000)).toBe(0)
  })

  it('withholds when a operand is missing', () => {
    expect(publishAskVsMedianPct(0, 1_000_000)).toBeNull()
    expect(publishAskVsMedianPct(1_000_000, 0)).toBeNull()
  })
})

describe('formatAskVsMedianDelta', () => {
  it('names a match, over, and under from the same math', () => {
    expect(formatAskVsMedianDelta(1_000_000, 1_000_000)).toEqual({ kind: 'match' })
    expect(formatAskVsMedianDelta(1_200_000, 1_000_000)).toEqual({ kind: 'over', label: '20.0%' })
    expect(formatAskVsMedianDelta(900_000, 1_000_000)).toEqual({ kind: 'under', label: '10.0%' })
  })

  it('uses dollars when one tenth would print 0.0% on a real gap', () => {
    expect(formatAskVsMedianDelta(1_000_400, 1_000_000)).toEqual({
      kind: 'over',
      label: '$400',
    })
  })
})

describe('leftoverMarketReportHref', () => {
  it('is /housing-market/{slug} for a core grain and omitted otherwise', () => {
    expect(leftoverMarketReportHref('sunriver')).toBe('/housing-market/sunriver')
    expect(leftoverMarketReportHref('bend')).toBe('/housing-market/bend')
    expect(leftoverMarketReportHref('tetherow')).toBeNull()
    expect(leftoverMarketReportHref('larkspur')).toBeNull()
  })
})

describe('buildListingAskHeadline', () => {
  it("is one sentence the figures can support, and never says ask", () => {
    expect(buildListingAskHeadline('Tetherow', 1_200_000, 1_000_000)).toBe(
      "This home's price sits 20.0% over the Tetherow median list",
    )
    expect(buildListingAskHeadline('Southeast Bend', 900_000, 1_000_000)).toBe(
      "This home's price sits 10.0% under the Southeast Bend median list",
    )
    expect(buildListingAskHeadline('Sunriver', 697_000, 1_000_000)).toBe(
      "This home's price sits 30.3% under the Sunriver median list",
    )
    expect(buildListingAskHeadline('Tetherow', 1_000_000, 1_000_000)).toBe(
      "This home's price matches the Tetherow median list",
    )
    expect(buildListingAskHeadline('Sunriver', 697_000, 1_000_000)).not.toMatch(/ask/i)
  })
})

describe('buildListingAskClaim', () => {
  it('prints leftover median and this price, never a KPI jargon label', () => {
    const claim = buildListingAskClaim({
      ask: 1_200_000,
      wholePropertyPrice: 1_200_000,
      hud: HUD,
      grain: GRAIN,
    })
    expect(claim?.headline).toBe("This home's price sits 20.0% over the Tetherow median list")
    expect(claim?.figures[0]?.value).toBe('$1,200,000')
    expect(claim?.figures[0]?.label).toBe('this price')
    expect(claim?.figures[1]?.value).toBe('$1,000,000')
    expect(claim?.figures[1]?.label).toBe('Tetherow median list')
    expect(claim?.figures.map((f) => f.label).join(' ')).not.toMatch(/Median to pending/)
    expect(claim?.source).toMatch(/leftover membership, active single-family houses in Tetherow/)
    expect(claim?.source).toMatch(/This price is the published list price/)
    expect(claim?.source).not.toMatch(/\bask\b/i)
    expect(claim?.headline).not.toMatch(/ask/i)
    expect(claim?.action).toBeUndefined()
  })

  it('sends a core grain to its market report, not search', () => {
    const claim = buildListingAskClaim({
      ask: 697_000,
      wholePropertyPrice: 697_000,
      hud: HUD,
      grain: SUNRIVER,
    })
    expect(claim?.action).toEqual({ label: 'Sunriver market', href: '/housing-market/sunriver' })
    expect(claim?.action?.href).not.toMatch(/homes-for-sale/)
  })

  it('withholds a share price against leftover whole-home median', () => {
    expect(
      buildListingAskClaim({
        ask: 1,
        wholePropertyPrice: 1_600_000,
        hud: HUD,
        grain: GRAIN,
      }),
    ).toBeNull()
  })

  it('withholds when leftover median is missing', () => {
    expect(
      buildListingAskClaim({
        ask: 1_200_000,
        wholePropertyPrice: 1_200_000,
        hud: { ...HUD, medianList: null },
        grain: GRAIN,
      }),
    ).toBeNull()
  })

  it('withholds when there is no sale price', () => {
    expect(
      buildListingAskClaim({
        ask: null,
        wholePropertyPrice: null,
        hud: HUD,
        grain: GRAIN,
      }),
    ).toBeNull()
  })
})
