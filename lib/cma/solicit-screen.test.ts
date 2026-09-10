import { describe, expect, it } from 'vitest'
import { decideSolicitScreen, unitFromAddress, unitToken } from '@/lib/cma/solicit-screen'

function listing(over: Record<string, unknown> = {}) {
  return {
    ListingKey: over.ListingKey ?? 'K1',
    StandardStatus: 'Expired',
    OnMarketDate: '2026-01-10',
    ListDate: '2026-01-10',
    CloseDate: null,
    ...over,
  } as never
}

describe('the solicitation screen (Matt 2026-09-09)', () => {
  it('lets an expired owner through when nothing newer is on record', () => {
    const out = decideSolicitScreen([listing()], { sinceIso: '2026-08-01' })
    expect(out.ok).toBe(true)
  })

  it('never writes to a home that is listed right now', () => {
    for (const status of ['Active', 'Active Under Contract', 'Coming Soon']) {
      const out = decideSolicitScreen(
        [listing({ ListingKey: 'OLD' }), listing({ ListingKey: 'NEW', StandardStatus: status, OnMarketDate: '2026-09-01' })],
        { sinceIso: '2026-08-01' },
      )
      expect(out.ok).toBe(false)
      if (!out.ok) {
        expect(out.reason).toBe('listed')
        expect(out.listingKey).toBe('NEW')
      }
    }
  })

  it('treats under contract as someone else\'s listing', () => {
    const out = decideSolicitScreen([listing({ StandardStatus: 'Pending', OnMarketDate: '2026-09-01' })], {
      sinceIso: '2026-08-01',
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe('pending')
  })

  it('pulls a home that sold after it came off the market', () => {
    const out = decideSolicitScreen(
      [listing({ ListingKey: 'SOLD', StandardStatus: 'Closed', CloseDate: '2026-08-20', OnMarketDate: '2026-06-01' })],
      { sinceIso: '2026-08-01' },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.reason).toBe('sold')
      expect(out.detail).toContain('2026-08-20')
    }
  })

  it('keeps an owner whose sale belongs to an older chapter of the property', () => {
    const out = decideSolicitScreen(
      [
        listing({ ListingKey: 'OLDSALE', StandardStatus: 'Closed', CloseDate: '2019-05-02', OnMarketDate: '2019-01-01' }),
        listing({ ListingKey: 'RECENT', StandardStatus: 'Expired', OnMarketDate: '2026-02-01' }),
      ],
      { sinceIso: '2026-08-01' },
    )
    expect(out.ok).toBe(true)
  })

  it('reads the newest listing first, so a relist beats the expired row it replaced', () => {
    const out = decideSolicitScreen(
      [
        listing({ ListingKey: 'EXPIRED_OLD', StandardStatus: 'Expired', OnMarketDate: '2026-01-01' }),
        listing({ ListingKey: 'RELIST', StandardStatus: 'Active', OnMarketDate: '2026-09-05' }),
      ],
      { sinceIso: '2026-08-15' },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.listingKey).toBe('RELIST')
  })

  it('says nothing is on record for a true FSBO', () => {
    const out = decideSolicitScreen([], {})
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.detail).toContain('No MLS listing on record')
  })

  it('measures "sold since" against the listing we are prospecting when no date is passed', () => {
    // The expired listing came off in 2026; the sale is from 2011. That is the
    // property's history, not a reason to skip the owner.
    const out = decideSolicitScreen([
      listing({ ListingKey: 'OLDSALE', StandardStatus: 'Closed', CloseDate: '2011-03-04', OnMarketDate: '2010-09-01' }),
      listing({ ListingKey: 'EXPIRED_2026', StandardStatus: 'Expired', OnMarketDate: '2026-02-01' }),
    ])
    expect(out.ok).toBe(true)
  })

  it('still blocks a sale that closed after the listing we are prospecting', () => {
    const out = decideSolicitScreen([
      listing({ ListingKey: 'EXPIRED_2026', StandardStatus: 'Expired', OnMarketDate: '2026-02-01' }),
      listing({ ListingKey: 'SOLD_AFTER', StandardStatus: 'Closed', CloseDate: '2026-08-30', OnMarketDate: '2026-05-01' }),
    ])
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe('sold')
  })

  it('with nothing but an old sale on record, stays quiet only if it is recent', () => {
    const old = decideSolicitScreen([listing({ StandardStatus: 'Closed', CloseDate: '2011-03-03', OnMarketDate: '2010-01-01' })])
    expect(old.ok).toBe(true)
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 2)
    const fresh = decideSolicitScreen([
      listing({ StandardStatus: 'Closed', CloseDate: recent.toISOString().slice(0, 10), OnMarketDate: '2026-01-01' }),
    ])
    expect(fresh.ok).toBe(false)
    if (!fresh.ok) expect(fresh.reason).toBe('sold')
  })
})

describe('one address, many homes', () => {
  const unit = (u: string | null, over: Record<string, unknown> = {}) =>
    ({
      ListingKey: over.ListingKey ?? `U${u ?? 'x'}`,
      StandardStatus: 'Expired',
      OnMarketDate: '2026-02-01',
      ListDate: '2026-02-01',
      CloseDate: null,
      unit_number: u,
      ...over,
    }) as never

  it('does not silence unit 14 because unit 12 is listed', () => {
    const rows = [
      unit('14', { ListingKey: 'MINE', StandardStatus: 'Expired', OnMarketDate: '2026-02-01' }),
      unit('12', { ListingKey: 'NEIGHBOUR', StandardStatus: 'Active', OnMarketDate: '2026-09-01' }),
    ]
    const out = decideSolicitScreen(rows, { unit: '14' })
    expect(out.ok).toBe(true)
  })

  it('blocks when the subject\'s own unit is the one that listed', () => {
    const rows = [
      unit('14', { ListingKey: 'MINE_OLD', StandardStatus: 'Expired', OnMarketDate: '2026-02-01' }),
      unit('14', { ListingKey: 'MINE_NEW', StandardStatus: 'Active', OnMarketDate: '2026-09-01' }),
      unit('12', { ListingKey: 'NEIGHBOUR', StandardStatus: 'Active', OnMarketDate: '2026-09-01' }),
    ]
    const out = decideSolicitScreen(rows, { unit: 'Unit 14' })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.listingKey).toBe('MINE_NEW')
  })

  it('never reads a street address as a unit (61304 Wizard, 2026-09-09)', () => {
    // The bug: unitToken fell back to the whole string, so "61304 Wizard,
    // Bend, OR 97702" became a unit that matched no row, the screen saw zero
    // listings on a 15-listing condo complex and cleared an Active listing.
    expect(unitFromAddress('61304 Wizard, Bend, OR 97702')).toBeNull()
    expect(unitFromAddress('363 Bluff #12, Bend, OR 97701')).toBe('12')
    expect(unitFromAddress('1 Main Unit 4B')).toBe('4b')
    expect(unitToken('UNIT 12')).toBe('12')
    expect(unitToken('12 Lot 20')).toBe('12')
    expect(unitToken(null)).toBeNull()
  })

  it('does not let a row recorded without a unit clear a shared address (57655 Aspen)', () => {
    const rows = [
      unit('2', { ListingKey: 'LIVE', StandardStatus: 'Active', OnMarketDate: '2026-08-22' }),
      unit(null, { ListingKey: 'OLD_SALE', StandardStatus: 'Closed', CloseDate: '2023-10-05', OnMarketDate: '2023-06-21' }),
    ]
    const out = decideSolicitScreen(rows, {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe('unverified')
    // With the subject's own unit known, it resolves to the real answer.
    const resolved = decideSolicitScreen(rows, { unit: '2' })
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) {
      expect(resolved.reason).toBe('listed')
      expect(resolved.listingKey).toBe('LIVE')
    }
  })

  it('refuses to guess on a multi-unit address with no unit on the subject', () => {
    const rows = [
      unit('12', { ListingKey: 'A', StandardStatus: 'Active', OnMarketDate: '2026-09-01' }),
      unit('14', { ListingKey: 'B' }),
    ]
    const out = decideSolicitScreen(rows, {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe('unverified')
  })

  it('treats an ordinary house, where no row carries a unit, exactly as before', () => {
    const rows = [unit(null, { ListingKey: 'HOUSE', StandardStatus: 'Active', OnMarketDate: '2026-09-01' })]
    const out = decideSolicitScreen(rows, {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe('listed')
  })
})

describe('a house is not a condo just because a neighbour row carries a number', () => {
  const row = (u: string | null, over: Record<string, unknown> = {}) =>
    ({
      ListingKey: over.ListingKey ?? `R${u ?? 'x'}`,
      StandardStatus: 'Expired',
      OnMarketDate: '2026-03-18',
      ListDate: '2026-03-18',
      CloseDate: null,
      unit_number: u,
      ...over,
    }) as never

  it('clears 21512 Etna, whose only other row carries a lot number', () => {
    const rows = [
      row(null, { ListingKey: 'SUBJ', StandardStatus: 'Canceled', OnMarketDate: '2026-03-18' }),
      row('lot #79', { ListingKey: 'OTHER', StandardStatus: 'Closed', CloseDate: '2025-03-01', OnMarketDate: '2025-01-23' }),
    ]
    // Read from the subject's own row: no unit, so the lot-number row is not this home.
    const out = decideSolicitScreen(rows, { unit: null, unitKnown: true })
    expect(out.ok).toBe(true)
    // Without the subject's row, the screen still refuses to guess.
    const blind = decideSolicitScreen(rows, {})
    expect(blind.ok).toBe(false)
    if (!blind.ok) expect(blind.reason).toBe('unverified')
  })

  it('still blocks the whole-property subject when the whole property is listed', () => {
    const rows = [
      row(null, { ListingKey: 'SUBJ', StandardStatus: 'Expired', OnMarketDate: '2026-01-01' }),
      row(null, { ListingKey: 'LIVE', StandardStatus: 'Active', OnMarketDate: '2026-09-01' }),
      row('Share 4', { ListingKey: 'SHARE', StandardStatus: 'Canceled', OnMarketDate: '2022-06-12' }),
    ]
    const out = decideSolicitScreen(rows, { unit: null, unitKnown: true })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.listingKey).toBe('LIVE')
  })
})
