import { describe, expect, it } from 'vitest'
import type { MarketPulseSnapshot } from '@/lib/data'
import { MOS_PLAIN_LABEL } from '@/lib/market/classify'
import { v3Text } from '@/components/site/v3'
import {
  buildCityInsightSeries,
  buildCityMosPages,
  buildHubChooserItems,
  buildHubExtraPages,
  buildHubTypeSegments,
  buildOpeningFigures,
  formatHubPace,
  hubInstrumentFigures,
  hubLiveDescription,
  hubLiveTitle,
  hubOpeningNote,
  isHubLeadFigure,
  monthlyPaceFromMos,
  shareFromLabel,
  weighExtraItems,
  wholeCountFromLabel,
} from './hub-opening'
import { publicSegmentRowSentence } from '@/lib/data/market-truth/public-segments'
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
    // The verdict is classified from the raw value the caption formats.
    expect(pages[0]?.verdictKind).toBe('balanced')
    expect(pages[1]?.verdictKind).toBe('balanced')
    // No monthly handed in: no card, never a cache fill.
    expect(pages[0]?.series).toBeNull()
  })

  it('draws the city run from its own complete months and omits a thin one', () => {
    const months = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2024, i, 1))
      return { periodStart: d.toISOString().slice(0, 10), medianSalePrice: 600_000 + i * 2_500 }
    })
    const pages = buildCityMosPages(
      [
        snap({ geo_label: 'Bend', geo_slug: 'bend', active_count: 800, months_of_supply: 4.2 }),
        snap({ geo_label: 'Redmond', geo_slug: 'redmond', active_count: 200, months_of_supply: 5.1 }),
      ],
      {
        monthlyBySlug: new Map([
          ['bend', months],
          ['redmond', months.slice(0, 3)],
        ]),
        minSeriesPoints: 6,
      },
    )
    const bend = pages[0]?.series
    expect(bend).not.toBeNull()
    // Trimmed to the last 24 complete months, oldest first, caller-formatted.
    expect(bend?.points).toHaveLength(24)
    expect(bend?.points[0]?.tick).toBe('Jul 2024')
    expect(bend?.points.at(-1)?.tick).toBe('Jun 2026')
    expect(bend?.points.at(-1)?.label).toBe('$673K')
    expect(bend?.source).toMatch(/Oregon Data Share/)
    expect(bend?.source).toMatch(/Jul 2024 to Jun 2026/)
    // Three priced months cannot plot: the card is omitted, not thinned.
    expect(pages[1]?.series).toBeNull()
    expect(buildCityInsightSeries('Bend', [], { minPoints: 6 })).toBeNull()
  })

  it('notes each month against the same month a year earlier, from the run itself', () => {
    const months = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2024, i, 1))
      return { periodStart: d.toISOString().slice(0, 10), medianSalePrice: 600_000 + i * 2_500 }
    })
    const series = buildCityInsightSeries('Bend', months, { minPoints: 6 })
    // Jun 2026 = 600,000 + 29 × 2,500 = 672,500; Jun 2025 = 600,000 + 17 × 2,500 = 642,500 → +4.7%.
    expect(series?.points.at(-1)?.note).toBe('+4.7% against Jun 2025')
    // The first twelve drawn months have no year-ago point inside the run: they read alone.
    expect(series?.points[0]?.note).toBeUndefined()
    expect(series?.points[11]?.note).toBeUndefined()
    expect(series?.points[12]?.note).toMatch(/^\+\d+\.\d% against Jul 2024$/)
  })

  it('writes a Types row as one plain sentence and leaves a missing piece out', () => {
    expect(
      publicSegmentRowSentence({ segment: 'condo', activeCount: 107, closedCount: 105, verdict: 'buyer' }),
    ).toBe("condos for sale, 105 sold in the last 12 months: a buyer's market.")
    expect(publicSegmentRowSentence({ segment: 'farm', activeCount: 40, closedCount: 8, verdict: null })).toBe(
      'farms for sale, 8 sold in the last 12 months.',
    )
    expect(
      publicSegmentRowSentence({ segment: 'land', activeCount: 596, closedCount: null, verdict: 'balanced' }),
    ).toBe('lots for sale: a balanced market.')
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
  it('takes whole counts and exact dollars for beui-number, never compact money or tenths', () => {
    expect(wholeCountFromLabel('215')).toBe(215)
    expect(wholeCountFromLabel('1,531')).toBe(1531)
    expect(wholeCountFromLabel('$749,500')).toBe(749500)
    expect(wholeCountFromLabel('$749K')).toBeUndefined()
    expect(wholeCountFromLabel('4.7')).toBeUndefined()
    expect(wholeCountFromLabel('98.1%')).toBeUndefined()
  })

  it('pages leftover types, pace, and mix and drops empty groups', () => {
    const pages = buildHubExtraPages({
      types: [
        { segment: 'condo', noun: 'condos', count: 180, sentence: '180 condos for sale.', href: '/homes-for-sale/condos' },
        { segment: 'land', noun: 'lots', count: 1200, sentence: '1,200 lots for sale.' },
      ],
      typesSource: { source: 'Oregon Data Share, the metrics.', sourceName: 'Oregon Data Share' },
      pace: [{ value: v3Text('6.2'), label: v3Text('months of supply') }],
      mix: [],
    })
    // The allocation card leads; the plain pace pair follows. The price pair
    // is the Instrument's own row now, so no page repeats it.
    expect(pages.map((page) => page.id)).toEqual(['types', 'pace'])
    const types = pages[0]!
    expect(types.items).toEqual([])
    expect(types.segments?.map((s) => s.id)).toEqual(['land', 'condo'])
    expect(types.segments?.[0]).toMatchObject({
      label: 'Lots',
      value: 1200,
      valueLabel: '1,200',
      shareLabel: '87%',
      note: '1,200 lots for sale.',
    })
    expect(buildHubTypeSegments([{ segment: 'c', noun: 'condos', count: 9, sentence: 'condos for sale.' }])[0]?.note).toBe(
      'Condos for sale.',
    )
    expect(types.segments?.[0]?.share).toBeCloseTo(1200 / 1380)
    expect(types.segments?.[1]).toMatchObject({ label: 'Condos', shareLabel: '13%', href: '/homes-for-sale/condos' })
    expect(types.segmentsSource?.sourceName).toBe('Oregon Data Share')
    // Tenths of a month are not a share of anything: no bar.
    expect(pages[1]?.items[0]?.weight).toBeUndefined()
    expect(pages.every((page) => !/\d/.test(page.claim))).toBe(true)
    expect(pages.every((page) => !/leftover|Market Truth|sample-gated/i.test(page.claim))).toBe(true)
  })

  it('builds type segments as parts of one whole and omits a zero or unnamed type', () => {
    expect(buildHubTypeSegments([])).toEqual([])
    const segments = buildHubTypeSegments([
      { segment: 'a', noun: 'condos', count: 995, sentence: 'x' },
      { segment: 'b', noun: 'farms', count: 5, sentence: 'y' },
      { segment: 'c', noun: 'lots', count: 0, sentence: 'z' },
      { segment: 'd', noun: ' ', count: 40, sentence: 'w' },
    ])
    expect(segments.map((s) => s.id)).toEqual(['a', 'b'])
    expect(segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
    // A sliver is said as under one percent, never rounded to a zero.
    expect(segments[1]?.shareLabel).toBe('under 1%')
  })

  it('keeps the price and the wait as the Instrument row when the bars draw', () => {
    const opening = [
      { value: v3Text('$749,500'), label: v3Text('median list price, single-family') },
      { value: v3Text('1,531'), label: v3Text('homes for sale, single-family'), count: 1531 },
      { value: v3Text('325'), label: v3Text('a month of sales'), count: 325 },
      { value: v3Text('30'), label: v3Text('days to an offer, last 90 days, single-family'), count: 30 },
    ]
    expect(hubInstrumentFigures(opening, true).map((f) => String(f.label))).toEqual([
      'median list price, single-family',
      'days to an offer, last 90 days, single-family',
    ])
    // No bars: every opening figure stands, the two counts included.
    expect(hubInstrumentFigures(opening, false)).toHaveLength(4)
    // Neither price nor wait published: the Instrument keeps its first figure.
    expect(hubInstrumentFigures(opening.slice(1, 3), true)).toHaveLength(2)
  })

  it('weighs published shares over 100 and never a mixed-unit page', () => {
    expect(shareFromLabel('98.1%')).toBeCloseTo(0.981)
    expect(shareFromLabel('at least 62%')).toBeCloseTo(0.62)
    expect(shareFromLabel('$749,500')).toBeUndefined()
    expect(shareFromLabel('130%')).toBeUndefined()
    const shares = weighExtraItems([
      { value: '98.1%', label: 'a' },
      { value: 'at least 62%', label: 'b' },
    ])
    expect(shares.map((item) => item.weight)).toEqual([0.981, 0.62])
    const mixed = weighExtraItems([
      { value: '$749,500', label: 'median list price', count: 749500 },
      { value: '30', label: 'days to an offer' },
    ])
    expect(mixed.every((item) => item.weight == null)).toBe(true)
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
    // Whole dollars ride beui-number and settle on the exact face.
    expect(median?.count).toBe(729875)
    expect(String(median?.value)).toBe('$729,875')
    const fractional = buildSfrFollowFigures({ medianList: 729875.5, active: 1550, daysToPending: 24 }, '4.8')
    expect(fractional.find((f) => String(f.label).includes('median list'))?.count).toBeUndefined()
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
