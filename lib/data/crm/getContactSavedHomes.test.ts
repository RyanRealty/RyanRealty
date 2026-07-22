import { describe, it, expect } from 'vitest'
import {
  rollupSavedHomeRows,
  buildHomesPanelUnion,
  type ConsumerStoreRow,
  type ContactSavedHome,
} from './getContactSavedHomes'
import type { ViewedListing } from './getViewedListings'

function viewed(partial: Partial<ViewedListing>): ViewedListing {
  return {
    listingKey: '220100001',
    address: '123 Main St',
    city: 'Bend',
    status: 'Active',
    photoUrl: null,
    listPrice: 500000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    addressSlug: null,
    views: 2,
    saved: false,
    lastViewedAt: '2026-07-10T00:00:00.000Z',
    ...partial,
  }
}

function savedHome(partial: Partial<ContactSavedHome>): ContactSavedHome {
  return {
    listingKey: '220100001',
    address: '123 Main St',
    city: 'Bend',
    status: 'Active',
    photoUrl: null,
    listPrice: 500000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    addressSlug: null,
    sources: ['saved'],
    savedAt: '2026-07-12T00:00:00.000Z',
    ...partial,
  }
}

describe('rollupSavedHomeRows', () => {
  it('rolls both stores up per key with source badges', () => {
    const likes: ConsumerStoreRow[] = [
      { listing_key: 'A', created_at: '2026-07-01T00:00:00.000Z' },
      { listing_key: 'B', created_at: '2026-07-02T00:00:00.000Z' },
    ]
    const saves: ConsumerStoreRow[] = [{ listing_key: 'A', created_at: '2026-07-03T00:00:00.000Z' }]
    const out = rollupSavedHomeRows(likes, saves)
    expect(out.get('A')).toEqual({ sources: ['liked', 'saved'], savedAt: '2026-07-03T00:00:00.000Z' })
    expect(out.get('B')).toEqual({ sources: ['liked'], savedAt: '2026-07-02T00:00:00.000Z' })
  })

  it('keeps the most recent created_at across duplicate rows and skips empty keys', () => {
    const likes: ConsumerStoreRow[] = [
      { listing_key: 'A', created_at: '2026-07-05T00:00:00.000Z' },
      { listing_key: 'A', created_at: '2026-07-01T00:00:00.000Z' },
      { listing_key: '', created_at: '2026-07-01T00:00:00.000Z' },
    ]
    const out = rollupSavedHomeRows(likes, [])
    expect(out.size).toBe(1)
    expect(out.get('A')!.savedAt).toBe('2026-07-05T00:00:00.000Z')
    expect(out.get('A')!.sources).toEqual(['liked'])
  })
})

describe('buildHomesPanelUnion', () => {
  it('flags a viewed home that also lives in a real consumer store', () => {
    const out = buildHomesPanelUnion(
      [viewed({ listingKey: 'X', saved: false })],
      [savedHome({ listingKey: 'X', sources: ['liked'] })],
    )
    expect(out).toHaveLength(1)
    expect(out[0].saved).toBe(true)
    expect(out[0].consumerSources).toEqual(['liked'])
    expect(out[0].views).toBe(2) // view count from the trail is preserved
  })

  it('a liked-but-never-viewed home still appears (views 0, saved)', () => {
    const out = buildHomesPanelUnion(
      [viewed({ listingKey: 'V' })],
      [savedHome({ listingKey: 'L', sources: ['liked'], savedAt: '2026-07-15T00:00:00.000Z' })],
    )
    expect(out.map((h) => h.listingKey)).toEqual(['L', 'V']) // most recent first
    const liked = out.find((h) => h.listingKey === 'L')!
    expect(liked.views).toBe(0)
    expect(liked.saved).toBe(true)
    expect(liked.consumerSources).toEqual(['liked'])
  })

  it('sorts by most recent activity across both signals and caps', () => {
    const out = buildHomesPanelUnion(
      [
        viewed({ listingKey: 'old', lastViewedAt: '2026-07-01T00:00:00.000Z' }),
        viewed({ listingKey: 'new', lastViewedAt: '2026-07-18T00:00:00.000Z' }),
      ],
      [savedHome({ listingKey: 'mid', savedAt: '2026-07-10T00:00:00.000Z' })],
      2,
    )
    expect(out.map((h) => h.listingKey)).toEqual(['new', 'mid'])
  })

  it('a save more recent than the last view bumps the row activity time', () => {
    const out = buildHomesPanelUnion(
      [viewed({ listingKey: 'X', lastViewedAt: '2026-07-01T00:00:00.000Z' })],
      [savedHome({ listingKey: 'X', savedAt: '2026-07-19T00:00:00.000Z' })],
    )
    expect(out[0].lastViewedAt).toBe('2026-07-19T00:00:00.000Z')
  })

  it('handles empty inputs', () => {
    expect(buildHomesPanelUnion([], [])).toEqual([])
    expect(buildHomesPanelUnion([viewed({})], [])).toHaveLength(1)
    expect(buildHomesPanelUnion([], [savedHome({})])).toHaveLength(1)
  })
})
