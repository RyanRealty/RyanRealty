import { describe, expect, it } from 'vitest'
import type { MarketPulseSnapshot } from '@/lib/data'
import { MOS_PLAIN_LABEL } from '@/lib/market/classify'
import { v3Text } from '@/components/site/v3'
import {
  buildCityMosPages,
  buildHubChooserItems,
  buildHubExtraPages,
  buildOpeningFigures,
  formatHubPace,
  hubLiveDescription,
  hubLiveTitle,
  hubOpeningNote,
  isHubLeadFigure,
  monthlyPaceFromMos,
  wholeCountFromLabel,
} from './hub-opening'
import { buildSfrFollowFigures } from './hub-sections'
import { HUB_FOLD_LABEL } from './hub-opening'

function snap(partial: Partial<MarketPulseSnapshot> & Pick<MarketPulseSnapshot, 'geo_label'>): MarketPulseSnapshot {
  return {
    geo_slug: partial.geo_slug ?? partial.geo_label.toLowerCase(),
    geo_label: partial.geo_label,
    active_count: partial.active_count ?? null,
    median_list_price: partial.median_list_price ?? null,
    months_of_supply: partial.months_of_supply ?? null,
    market_health_label: null,
    sold_count_30d: 0,
    sold_count_90d: 0,
    new_count_7d: 0,
    median_active_dom: null,
    median_days_to_pending: null,
    price_reduction_share: null,
    methodology_version: 'v3-2026-05-07',
    updated_at: partial.updated_at ?? '2026-09-12T12:00:00.000Z',
  }
}

describe('monthlyPaceFromMos', () => {
  it('rounds to a counted month and omits a miss', () => {
    expect(monthlyPaceFromMos(1550, 4.8)).toBe(323)
    expect(monthlyPaceFromMos(1550, null)).toBeNull()
    expect(monthlyPaceFromMos(0, 4.8)).toBeNull()
  })
})

describe('buildCityMosPages — city grain, miss omits', () => {
  it('publishes Bend and Redmond when MOS and actives agree, and drops a city with no MOS', () => {
    const pages = buildCityMosPages([
      snap({ geo_label: 'Bend', geo_slug: 'bend', active_count: 800, months_of_supply: 4.2 }),
      snap({ geo_label: 'Redmond', geo_slug: 'redmond', active_count: 200, months_of_supply: 5.1 }),
      snap({ geo_label: 'Sisters', geo_slug: 'sisters', active_count: 40, months_of_supply: null }),
    ])
    expect(pages.map((p) => p.label)).toEqual(['Bend', 'Redmond'])
    expect(pages[0]?.homesValue).toBe(800)
    expect(pages[0]?.salesValue).toBe(190)
    expect(pages[0]?.href).toBe('/housing-market/bend')
    expect(pages[0]?.source).toContain('Oregon Data Share')
    expect(pages[0]?.source).not.toMatch(/leftover|Market Truth|sample-gated/i)
  })

  it('omits a city whose displayed active disagrees with the pulse active', () => {
    const pages = buildCityMosPages([
      snap({
        geo_label: 'Bend',
        geo_slug: 'bend',
        active_count: 800,
        months_of_supply: 4.2,
      }),
    ])
    expect(pages).toHaveLength(1)
  })
})

describe('hub live title and description', () => {
  it('keeps the Layer A head term even when leftover HUD published a count', () => {
    expect(hubLiveTitle(1550)).toBe('Central Oregon Housing Market')
    expect(hubLiveTitle(null)).toBe('Central Oregon Housing Market')
  })

  it('keeps MOS out of the title and only into the description when present', () => {
    const withMos = hubLiveDescription(1550, '4.8')
    expect(withMos).toContain('1,550 single-family homes for sale')
    expect(withMos).toContain('4.8 months')
    expect(hubLiveDescription(12345, '12.4').length).toBeLessThanOrEqual(155)
    expect(withMos).toContain('Oregon Data Share')
    expect(withMos.length).toBeLessThanOrEqual(155)
    expect(hubLiveDescription(null, null)).not.toMatch(/\d{3,}/)
    expect(hubLiveDescription(null, null).length).toBeLessThanOrEqual(155)
  })
})

describe('extra leftover pages — pager, not a closed cream fold', () => {
  it('takes only whole counts for beui-number', () => {
    expect(wholeCountFromLabel('215')).toBe(215)
    expect(wholeCountFromLabel('1,531')).toBe(1531)
    expect(wholeCountFromLabel('$749K')).toBeUndefined()
    expect(wholeCountFromLabel('4.7')).toBeUndefined()
    expect(wholeCountFromLabel('98.1%')).toBeUndefined()
  })

  it('pages leftover types, pace, and mix and drops empty groups', () => {
    const pages = buildHubExtraPages({
      priceAndWait: [{ value: v3Text('$749K'), label: v3Text('typical sale, last 12 months') }],
      types: [
        { value: v3Text('1,200'), label: v3Text('houses for sale'), count: 1200 },
        { value: v3Text('180'), label: v3Text('condos and townhomes'), count: 180 },
      ],
      pace: [{ value: v3Text('6.2'), label: v3Text('months of supply') }],
      mix: [],
    })
    expect(pages.map((page) => page.id)).toEqual(['price', 'types', 'pace'])
    expect(pages[0]?.items[0]?.count).toBeUndefined()
    expect(pages[1]?.items[0]?.count).toBe(1200)
    expect(pages.every((page) => !/\d/.test(page.claim))).toBe(true)
    expect(pages.every((page) => !/leftover|Market Truth|sample-gated/i.test(page.claim))).toBe(true)
  })

  it('keeps only homes and a month of sales as the opening tiles', () => {
    expect(
      isHubLeadFigure({ value: v3Text('1,531'), label: v3Text('homes for sale, single-family') }),
    ).toBe(true)
    expect(isHubLeadFigure({ value: v3Text('326'), label: v3Text('a month of sales') })).toBe(true)
    expect(
      isHubLeadFigure({ value: v3Text('$749K'), label: v3Text('median list, last 12 months') }),
    ).toBe(false)
  })
})

describe('opening figures', () => {
  it('prints a month of sales as an integer, never a trailing tenth', () => {
    const follow = buildSfrFollowFigures(
      { medianList: 729875, active: 1550, daysToPending: 24 },
      '4.8',
    )
    const figures = buildOpeningFigures({ follow, monthOfSales: 323 })
    const sales = figures.find((f) => String(f.label) === 'a month of sales')
    expect(sales?.value).toBe('323')
    expect(String(sales?.value)).not.toMatch(/\.0$/)
    expect(sales?.count).toBe(323)
    expect(sales?.sentence).toBeTruthy()
    expect(String(sales?.sentence)).not.toMatch(/\d/)
  })

  it('lead follow figures carry a sentence and a count on whole numbers', () => {
    const follow = buildSfrFollowFigures(
      { medianList: 729875, active: 1550, daysToPending: 24 },
      '4.8',
    )
    const homes = follow.find((f) => String(f.label) === 'homes for sale, single-family')
    expect(homes?.count).toBe(1550)
    expect(homes?.sentence).toBeTruthy()
    expect(String(homes?.sentence)).not.toMatch(/\d/)
    const median = follow.find((f) => String(f.label).includes('median list'))
    expect(median?.sentence).toBeTruthy()
    expect(median?.count).toBeUndefined()
  })
})

describe('chooser stays a door list, not a first-viewport substitute', () => {
  it('Live market points at #market and omits a zero active', () => {
    const items = buildHubChooserItems({
      active: null,
      cityRowCount: 0,
      closedSoldCount: null,
      closedYear: null,
      mosText: null,
      verdictLabel: 'unknown',
      verdictKind: 'unknown',
      newestWeeklyLabel: null,
      refreshedAt: null,
      cityRefreshedAt: null,
    })
    const live = items.find((item) => 'label' in item && item.label === 'Live market')
    expect(live && 'href' in live ? live.href : null).toBe('#market')
    expect(live && 'figure' in live ? live.figure : undefined).toBeUndefined()
  })
})

describe('fold label', () => {
  it('names the tail without a count and stays short for 375', () => {
    expect(HUB_FOLD_LABEL).not.toMatch(/\d/)
    expect(HUB_FOLD_LABEL.length).toBeLessThan(48)
    expect(HUB_FOLD_LABEL).toBe('Pace, types, and features')
  })
})

describe('opening note', () => {
  it('does not invent a figure', () => {
    expect(hubOpeningNote('sellers', 3)).not.toMatch(/\d/)
    expect(hubOpeningNote('unknown', 0)).toContain('omitted')
  })
})

describe('formatHubPace', () => {
  it('never prints a trailing tenth', () => {
    expect(formatHubPace(322)).toBe('322')
    expect(formatHubPace(322.0)).toBe('322')
  })
})

describe('v3Text still rejects empty', () => {
  it('MOS label is the house phrase', () => {
    expect(MOS_PLAIN_LABEL).toBe('homes for sale vs a month of sales')
    expect(String(v3Text(MOS_PLAIN_LABEL))).toBe(MOS_PLAIN_LABEL)
  })
})
