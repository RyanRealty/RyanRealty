import { describe, expect, it } from 'vitest'
import {
  cmaQueueFiltersFromSearch,
  cmaQueueHoldLine,
  cmaQueueHref,
  cmaQueueMoneyLine,
  cmaQueueReachFromFacts,
  cmaQueueReachNote,
  cmaQueueWalk,
  cmaQueueWhoLine,
  cmaQueueWhy,
  cmaReviewHref,
  filterCmaQueueRows,
  resolveTheirPrice,
  sliceCmaQueuePage,
  sortCmaQueueRows,
  theirPriceFromBuildSummary,
  type CmaQueueViewRow,
} from '@/lib/cma/queue-view'

function row(over: Partial<CmaQueueViewRow> = {}): CmaQueueViewRow {
  return {
    id: over.id ?? over.address ?? 'row',
    slug: over.slug ?? 'cma-123-main',
    why: over.why ?? 'none',
    address: '123 Main St',
    city: 'Bend',
    origin: 'expired',
    state: 'ready',
    recommendedList: 605_000,
    valueLow: 585_000,
    valueHigh: 625_000,
    theirPrice: 650_000,
    theirPriceLabel: 'Last list',
    theirPriceDelta: (605_000 - 650_000) / 650_000,
    contactName: 'Jane Owner',
    contactEmail: 'jane@example.com',
    createdAt: '2026-09-01T12:00:00.000Z',
    ...over,
  }
}

describe('cmaQueueMoneyLine', () => {
  it('leads with compact rec, then range, then exact last list on an expired', () => {
    const line = cmaQueueMoneyLine(row())
    expect(line.startsWith('Rec $605K')).toBe(true)
    expect(line).toContain('$585K-$625K')
    expect(line).toContain('Last list $650,000')
    expect(line.indexOf('Rec $605K')).toBeLessThan(line.indexOf('$585K-$625K'))
    expect(line.indexOf('$585K-$625K')).toBeLessThan(line.indexOf('Last list'))
  })

  it('does not invent a last list on a requested valuation', () => {
    const line = cmaQueueMoneyLine(
      row({ origin: 'seller-valuation', theirPrice: null, theirPriceLabel: null, theirPriceDelta: null }),
    )
    expect(line.startsWith('Rec $605K')).toBe(true)
    expect(line).toContain('$585K-$625K')
    expect(line).not.toContain('Last list')
  })
})

describe('cmaQueueWhoLine', () => {
  it('drops city when the address already names it', () => {
    expect(cmaQueueWhoLine(row({ address: '3802 Petrosa, Bend, OR 97701', city: 'Bend' }))).toBe('Jane Owner')
  })

  it('keeps city when the address does not name it', () => {
    expect(cmaQueueWhoLine(row({ address: '3802 Petrosa', city: 'Bend' }))).toBe('Bend · Jane Owner')
  })
})

describe('cmaQueueHref', () => {
  it('omits state when the list is on the default ready door', () => {
    expect(cmaQueueHref({})).toBe('/admin/cmas')
    expect(cmaQueueHref({ state: 'ready' })).toBe('/admin/cmas')
    expect(cmaQueueHref({ state: 'work' })).toBe('/admin/cmas?state=work')
    expect(cmaQueueHref({ state: 'audit-failed', city: 'Bend' })).toBe(
      '/admin/cmas?city=Bend&state=audit-failed',
    )
  })
})

describe('filterCmaQueueRows', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z')
  const rows = [
    row(),
    row({
      address: '9 Pine',
      city: 'Redmond',
      origin: 'fsbo',
      state: 'sent',
      recommendedList: 420_000,
      valueLow: 400_000,
      valueHigh: 440_000,
      theirPrice: 449_000,
      theirPriceLabel: 'Their ask',
      createdAt: '2026-08-01T12:00:00.000Z',
    }),
    row({
      address: '2100 NW',
      city: 'Bend',
      origin: 'seller-valuation',
      state: 'ready',
      recommendedList: 1_200_000,
      theirPrice: null,
      theirPriceLabel: null,
      contactName: 'Sam Seller',
      createdAt: '2026-09-04T12:00:00.000Z',
    }),
  ]

  it('defaults to ready, not the whole work pile', () => {
    const extra = [
      row({ address: '1 Audit Ln', state: 'audit-failed', createdAt: '2026-09-03T12:00:00.000Z' }),
      row({ address: '2 Unvetted', state: 'unvetted', createdAt: '2026-09-03T12:00:00.000Z' }),
    ]
    const visible = filterCmaQueueRows([...rows, ...extra], {}, now)
    expect(visible.every((r) => r.state === 'ready')).toBe(true)
    expect(visible.map((r) => r.address)).toEqual(['123 Main St', '2100 NW'])
  })

  it('still opens the work pile when asked', () => {
    const extra = row({ address: '1 Audit Ln', state: 'audit-failed' })
    expect(filterCmaQueueRows([...rows, extra], { state: 'work' }, now).map((r) => r.address)).toEqual([
      '123 Main St',
      '2100 NW',
      '1 Audit Ln',
    ])
  })

  it('filters by city, origin, address, rec band, and created window', () => {
    expect(filterCmaQueueRows(rows, { city: 'Redmond', state: 'all' }, now).map((r) => r.city)).toEqual(['Redmond'])
    expect(filterCmaQueueRows(rows, { origin: 'expired' }, now)).toHaveLength(1)
    expect(filterCmaQueueRows(rows, { q: 'sam' }, now)[0]?.contactName).toBe('Sam Seller')
    expect(filterCmaQueueRows(rows, { rec: 'gt1m' }, now)[0]?.recommendedList).toBe(1_200_000)
    expect(filterCmaQueueRows(rows, { created: '7d', state: 'all' }, now)).toHaveLength(2)
  })
})

describe('sortCmaQueueRows', () => {
  it('sorts by recommended list when asked', () => {
    const rows = [
      row({ recommendedList: 900_000, address: 'hi' }),
      row({ recommendedList: 400_000, address: 'lo' }),
    ]
    expect(sortCmaQueueRows(rows, 'price-asc').map((r) => r.address)).toEqual(['lo', 'hi'])
    expect(sortCmaQueueRows(rows, 'price-desc').map((r) => r.address)).toEqual(['hi', 'lo'])
  })
})

describe('cma queue paging and why', () => {
  it('pages 50 at a time and clamps a page past the end', () => {
    const rows = Array.from({ length: 55 }, (_, i) => row({ id: String(i), slug: `cma-${i}`, address: String(i) }))
    const first = sliceCmaQueuePage(rows, undefined)
    expect(first.pages).toBe(2)
    expect(first.rows).toHaveLength(50)
    expect(first.start).toBe(1)
    expect(first.end).toBe(50)
    const second = sliceCmaQueuePage(rows, 2)
    expect(second.rows.map((r) => r.address)).toEqual(['50', '51', '52', '53', '54'])
    expect(sliceCmaQueuePage(rows, 9).page).toBe(2)
    expect(sliceCmaQueuePage([], 3)).toMatchObject({ page: 1, pages: 0, start: 0, end: 0, rows: [] })
  })

  it('walks the filtered list without skipping', () => {
    const slugs = ['a', 'b', 'c']
    expect(cmaQueueWalk(slugs, 'b')).toMatchObject({ index: 1, prev: 'a', next: 'c', page: 1, total: 3 })
    expect(cmaQueueWalk(slugs, 'missing').index).toBe(-1)
  })

  it('keeps a wide range distinct from an ask that did not sell', () => {
    expect(cmaQueueWhy({ state: 'flagged', reviewReason: 'The value range is wider than 8% of the recommended list' })).toBe(
      'wide-range',
    )
    expect(cmaQueueWhy({ state: 'flagged', reviewReason: 'Comp evidence supported $630,000 against the $625,000 asking that just failed.' })).toBe(
      'failed-ask',
    )
    expect(cmaQueueWhy({ state: 'failed', buildError: 'JUDGE_UNSTABLE. The comparability review did not agree' })).toBe(
      'judge-unstable',
    )
    expect(cmaQueueWhy({ state: 'failed', buildError: 'Not enough comparable sales the review would keep.' })).toBe(
      'short-comps',
    )
    expect(cmaQueueWhy({ state: 'ready', reviewReason: 'wider than 8%' })).toBe('none')
    expect(cmaQueueWhy({ state: 'audit-failed' })).toBe('audit')
  })

  it('filters to one why and puts that why and the page on the url', () => {
    const rows = [
      row({ address: 'wide', state: 'flagged', why: 'wide-range' }),
      row({ address: 'short', state: 'failed', why: 'short-comps' }),
    ]
    expect(filterCmaQueueRows(rows, { state: 'all', why: 'wide-range' }).map((r) => r.address)).toEqual(['wide'])
    expect(cmaQueueHref({ state: 'flagged', why: 'wide-range', page: 2 })).toBe(
      '/admin/cmas?state=flagged&why=wide-range&page=2',
    )
    expect(cmaReviewHref('cma-1', { state: 'flagged', why: 'wide-range', page: 2 })).toBe(
      '/admin/cmas/cma-1?state=flagged&why=wide-range&page=2',
    )
    expect(cmaQueueHref({ page: 1, why: 'none' })).toBe('/admin/cmas')
  })

  it('drops a garbage filter and keeps a real page', () => {
    expect(
      cmaQueueFiltersFromSearch({ state: 'nope', why: 'wide-range', page: '2', rec: 'nope', sort: 'newest' }),
    ).toEqual({
      why: 'wide-range',
      sort: 'newest',
      page: 2,
    })
  })

  it('calls a number a cell only when the line type already confirmed it', () => {
    expect(cmaQueueReachFromFacts({ email: 'a@b.co', hasConfirmedCell: true, hasAnyPhone: true })).toBe('email')
    expect(cmaQueueReachFromFacts({ email: null, hasConfirmedCell: true, hasAnyPhone: true })).toBe('text')
    expect(cmaQueueReachFromFacts({ email: '  ', hasConfirmedCell: false, hasAnyPhone: true })).toBe('unconfirmed-phone')
    expect(cmaQueueReachFromFacts({ email: null, hasConfirmedCell: false, hasAnyPhone: false })).toBe('none')
    expect(cmaQueueReachNote('text')).toBe('text')
    expect(cmaQueueReachNote('unconfirmed-phone')).toBe('phone on file, not a confirmed cell')
    expect(cmaQueueReachNote('none')).toBe('no email')
    expect(cmaQueueReachNote('email')).toBeNull()
  })
})

describe('cmaQueueHoldLine', () => {
  it('puts the hold on the letter and stays quiet when nothing is held', () => {
    expect(
      cmaQueueHoldLine({
        state: 'flagged',
        reviewReason: 'The value range is wider than 8% of the recommended list.',
      }),
    ).toBe('Range is wide. The value range is wider than 8% of the recommended list.')
    expect(
      cmaQueueHoldLine({
        state: 'audit-failed',
        auditSummary: 'The price sits outside the sales.',
        auditCriticalCount: 2,
      }),
    ).toBe('Audit failed. 2 critical. The price sits outside the sales.')
    expect(cmaQueueHoldLine({ state: 'unvetted' })).toBe('Audit did not run. Nothing has checked this one.')
    expect(cmaQueueHoldLine({ state: 'ready' })).toBeNull()
    expect(cmaQueueHoldLine({ state: 'failed', buildError: 'not enough comparable sales' })).toBeNull()
  })
})

describe('theirPriceFromBuildSummary', () => {
  it('reads last list from the summary only for expired and FSBO', () => {
    const summary = { subject: { last_list_price: 749_900 } }
    expect(theirPriceFromBuildSummary(summary, 'expired')).toBe(749_900)
    expect(theirPriceFromBuildSummary(summary, 'fsbo')).toBe(749_900)
    expect(theirPriceFromBuildSummary(summary, 'seller-valuation')).toBeNull()
    expect(theirPriceFromBuildSummary({}, 'expired')).toBeNull()
  })
})

describe('resolveTheirPrice', () => {
  it('prefers the prospect row, then the summary, and never invents one on a request', () => {
    const summary = { subject: { last_list_price: 749_900 } }
    expect(resolveTheirPrice('expired', summary, 774_900)).toBe(774_900)
    expect(resolveTheirPrice('expired', summary, null)).toBe(749_900)
    expect(resolveTheirPrice('expired', {}, null)).toBeNull()
    expect(resolveTheirPrice('seller-valuation', summary, 774_900)).toBeNull()
  })
})
