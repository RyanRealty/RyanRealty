import { describe, expect, it } from 'vitest'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import {
  buildListingAskClaim,
  buildListingAskHeadline,
  formatAskVsMedianDelta,
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

const GRAIN = { name: 'Tetherow', hubHref: '/communities/tetherow' }

describe('publishAskVsMedianPct', () => {
  it('is (ask - median) / median * 100', () => {
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

describe('buildListingAskHeadline', () => {
  it('is one sentence the figures can support', () => {
    expect(buildListingAskHeadline('Tetherow', 1_200_000, 1_000_000)).toBe(
      'This ask sits 20.0% over the Tetherow median list',
    )
    expect(buildListingAskHeadline('Southeast Bend', 900_000, 1_000_000)).toBe(
      'This ask sits 10.0% under the Southeast Bend median list',
    )
    expect(buildListingAskHeadline('Tetherow', 1_000_000, 1_000_000)).toBe(
      'This ask matches the Tetherow median list',
    )
  })
})

describe('buildListingAskClaim', () => {
  it('prints leftover median and this ask, never a KPI jargon label', () => {
    const claim = buildListingAskClaim({
      ask: 1_200_000,
      wholePropertyPrice: 1_200_000,
      hud: HUD,
      grain: GRAIN,
    })
    expect(claim?.headline).toBe('This ask sits 20.0% over the Tetherow median list')
    expect(claim?.figures[0]?.value).toBe('$1,200,000')
    expect(claim?.figures[0]?.label).toBe('this ask')
    expect(claim?.figures[1]?.value).toBe('$1,000,000')
    expect(claim?.figures[1]?.label).toBe('Tetherow median list')
    expect(claim?.figures.map((f) => f.label).join(' ')).not.toMatch(/Median to pending/)
    expect(claim?.source).toMatch(/leftover membership, active single-family houses in Tetherow/)
    expect(claim?.source).toMatch(/This ask is the published list price/)
    expect(claim?.action.href).toBe('/communities/tetherow')
  })

  it('withholds a share ask against leftover whole-home median', () => {
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

  it('withholds when there is no sale ask', () => {
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
