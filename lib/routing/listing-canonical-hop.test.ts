/**
 * P14 (visibility audit 2026-09-22, gsc-trend-6). Two contracts, both replayed
 * against real listings rows pinned in ./listing-canonical-pins.json:
 *
 *   1. STABLE: a listing's canonical path does not change unless the pin file
 *      names the change. The polygon classifier can reclassify a home any
 *      number of times; its URL does not move.
 *   2. ONE URL: every other path that names the listing (the pre-P14 canonical,
 *      every variant Search Console showed, and the shapes the rewrites accept)
 *      308s to the canonical, and the canonical itself passes through. No
 *      destination redirects again (no loops).
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { listingCanonicalHref, listingTileHref, type ListingUrlSubject } from '@/lib/slug'
import type { ListingCanonicalPathFields } from '@/lib/data/listings/listingCanonicalPathCore'
import { listingIdFromRequestPath, resolveListingCanonicalHop } from './listing-canonical-hop'

type Fixture = {
  id: string
  note: string | null
  input: Required<Pick<ListingUrlSubject, 'listingKey' | 'listNumber' | 'streetNumber' | 'streetName' | 'city' | 'subdivisionName' | 'boundaryCity' | 'boundaryNeighborhood'>>
  pinned: string
  indexedVariants: string[]
}
type Migration = { id: string; from: string; to: string; change: string; date: string }

const PINS = JSON.parse(readFileSync(resolve(__dirname, 'listing-canonical-pins.json'), 'utf8')) as {
  fixtures: Fixture[]
  migrations: Migration[]
}

/** pinned, then every migration for the id in file order. */
function chainFor(f: Fixture): string[] {
  const chain = [f.pinned]
  for (const m of PINS.migrations) if (m.id === f.id) chain.push(m.to)
  return chain
}

function rowOf(f: Fixture): ListingCanonicalPathFields {
  return {
    ListingKey: String(f.input.listingKey),
    ListNumber: f.input.listNumber ?? null,
    StreetNumber: f.input.streetNumber ?? null,
    StreetName: f.input.streetName ?? null,
    City: f.input.city ?? null,
    State: 'OR',
    PostalCode: null,
    SubdivisionName: f.input.subdivisionName ?? null,
  }
}

/** A lookup that answers exactly like the Edge reader: by ListNumber or ListingKey. */
function tableLookup(fixtures: Fixture[]) {
  const byId = new Map<string, ListingCanonicalPathFields>()
  for (const f of fixtures) {
    const row = rowOf(f)
    if (row.ListNumber) byId.set(row.ListNumber, row)
    byId.set(row.ListingKey, row)
  }
  return vi.fn(async (id: string) => byId.get(id) ?? null)
}

describe('listing canonical pins (contract 1: the canonical does not move)', () => {
  it('the pin file holds the fixture set the gate expects', () => {
    expect(PINS.fixtures.length).toBeGreaterThanOrEqual(12)
    expect(new Set(PINS.fixtures.map((f) => f.id)).size).toBe(PINS.fixtures.length)
  })

  it('every migration continues its fixture chain and names its change', () => {
    const end = new Map(PINS.fixtures.map((f) => [f.id, f.pinned]))
    for (const m of PINS.migrations) {
      expect(end.has(m.id), `migration names unknown fixture ${m.id}`).toBe(true)
      expect(m.from, `migration for ${m.id} must start where its chain ends`).toBe(end.get(m.id))
      expect(m.to).not.toBe(m.from)
      expect(m.change).toBeTruthy()
      expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      end.set(m.id, m.to)
    }
  })

  for (const f of PINS.fixtures) {
    it(`${f.id}: the builder output equals the pinned canonical after its named migrations`, () => {
      const expected = chainFor(f).at(-1)
      const actual = listingTileHref(f.input)
      // A failure here means a builder or input change moved a published URL.
      // If the move is intended, add {id, from: <current end>, to: <new>,
      // change, date} to listing-canonical-pins.json; middleware then 308s the
      // old path because it is no longer the canonical.
      expect(actual).toBe(expected)
      expect(listingCanonicalHref({ ...f.input, listingKey: String(f.input.listingKey) })).toBe(expected)
    })

    it(`${f.id}: reclassifying the polygon fields never moves the canonical`, () => {
      const expected = listingTileHref(f.input)
      const cities = [null, 'Outside Boundaries', 'outside-boundaries', 'Sisters', 'Powell Butte', f.input.boundaryCity]
      const hoods = [null, 'Three Rivers', 'outside-boundaries', 'Westside', 'Mountain View', f.input.boundaryNeighborhood]
      for (const boundaryCity of cities) {
        for (const boundaryNeighborhood of hoods) {
          expect(listingTileHref({ ...f.input, boundaryCity, boundaryNeighborhood })).toBe(expected)
        }
      }
    })
  }

  it('no fixture canonical carries a polygon-only segment', () => {
    for (const f of PINS.fixtures) {
      const path = listingTileHref(f.input)
      expect(path).not.toContain('outside-boundaries')
      // /homes-for-sale/{city}/[{community}/]{street}-{mls}: at most 3 segments.
      expect(path.split('/').length - 2).toBeLessThanOrEqual(3)
    }
  })
})

describe('listing canonical hop (contract 2: one URL, every variant 308s)', () => {
  const lookup = tableLookup(PINS.fixtures)

  for (const f of PINS.fixtures) {
    const canonical = listingTileHref(f.input)
    const tail = canonical.split('/').at(-1) as string
    const citySeg = canonical.split('/')[2] as string
    const keyTail = tail.replace(/-\d+$/, `-${f.input.listingKey}`)

    const variants = new Set<string>([
      ...chainFor(f),
      ...f.indexedVariants,
      `/homes-for-sale/outside-boundaries/${tail}`,
      `/homes-for-sale/outside-boundaries/some-community/${tail}`,
      `/homes-for-sale/${citySeg}/${tail}`,
      `/homes-for-sale/${citySeg}/some-neighborhood/some-community/${tail}`,
      `/homes-for-sale/portland/${tail}`,
      `/homes-for-sale/${citySeg.toUpperCase()}/${tail}`,
      `/homes-for-sale/${citySeg}/${keyTail}`,
      `/listing/${f.input.listingKey}`,
      `/listing/${f.input.listNumber}`,
      `/listing/by-address${canonical.replace('/homes-for-sale', '')}`,
    ])
    variants.delete(canonical)

    it(`${f.id}: the canonical passes through`, async () => {
      expect(await resolveListingCanonicalHop(canonical, lookup)).toBeNull()
      expect(await resolveListingCanonicalHop(`${canonical}/`, lookup)).toBeNull()
    })

    it(`${f.id}: every non-canonical variant (${variants.size}) 308s to the canonical, and the destination is a fixed point`, async () => {
      for (const v of variants) {
        const dest = await resolveListingCanonicalHop(v, lookup)
        expect(dest, v).toBe(canonical)
        expect(await resolveListingCanonicalHop(dest as string, lookup), `${v} -> ${dest} loops`).toBeNull()
      }
    })
  }

  it('an unknown key keeps today\'s behavior: no hop', async () => {
    const miss = vi.fn(async () => null)
    expect(await resolveListingCanonicalHop('/homes-for-sale/bend/rr-smoke-no-such-listing-999999999', miss)).toBeNull()
    expect(await resolveListingCanonicalHop('/listing/20200101000000000000000000', miss)).toBeNull()
    expect(miss).toHaveBeenCalledTimes(2)
  })

  it('a lookup that throws is a pass-through, never an error', async () => {
    const boom = vi.fn(async () => {
      throw new Error('upstream timeout')
    })
    expect(await resolveListingCanonicalHop('/homes-for-sale/bend/1522-locksley-220226356', boom)).toBeNull()
  })

  it('never bounces to the key-form hop: a row with no MLS City is left alone', async () => {
    const noCity = vi.fn(async () => ({
      ListingKey: '20260101000000000000000001',
      ListNumber: '220000009',
      StreetNumber: '1',
      StreetName: 'Main',
      City: null,
      State: null,
      PostalCode: null,
      SubdivisionName: null,
    }))
    expect(await resolveListingCanonicalHop('/homes-for-sale/bend/1-main-220000009', noCity)).toBeNull()
    expect(await resolveListingCanonicalHop('/listing/220000009', noCity)).toBeNull()
  })

  it('never hops to a path the rewrites would not render as this listing (a row with no street)', async () => {
    const noStreet = vi.fn(async () => ({
      ListingKey: '20260101000000000000000002',
      ListNumber: '220000010',
      StreetNumber: null,
      StreetName: null,
      City: 'Bend',
      State: 'OR',
      PostalCode: null,
      SubdivisionName: 'Tetherow',
    }))
    // The builder's output, /homes-for-sale/bend/tetherow/220000010, has no
    // "-<digits>" tail, so next.config.ts would route it to search, not here.
    expect(listingIdFromRequestPath(listingTileHref({ listingKey: '20260101000000000000000002', listNumber: '220000010', city: 'Bend', subdivisionName: 'Tetherow' }))).toBeNull()
    expect(await resolveListingCanonicalHop('/listing/20260101000000000000000002', noStreet)).toBeNull()
    expect(await resolveListingCanonicalHop('/homes-for-sale/bend/lot-220000010', noStreet)).toBeNull()
    expect(noStreet).toHaveBeenCalledTimes(2)
  })

  it('paths that are not listing detail never trigger a lookup', async () => {
    const spy = vi.fn(async () => null)
    for (const p of [
      '/',
      '/homes-for-sale',
      '/homes-for-sale/bend',
      '/homes-for-sale/bend/tetherow',
      '/homes-for-sale/bend/luxury',
      '/homes-for-sale/bend/northwest-crossing/under-500k',
      '/homes-for-sale/listing/220226356',
      '/homes-for-sale/listing/foo-220226356',
      '/homes-for-sale/bend/phase-1234',
      '/listing/by-key/220226356',
      '/listing/odsmls/220213420/Bend/60749-Willow-Creek-Loop',
      '/listing/not-a-key',
      '/communities/tetherow',
      '/cities/bend/larkspur',
    ]) {
      expect(listingIdFromRequestPath(p), p).toBeNull()
      expect(await resolveListingCanonicalHop(p, spy)).toBeNull()
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('parses the id every rewrite shape carries, the way the by-address page does', () => {
    expect(listingIdFromRequestPath('/homes-for-sale/bend/1522-locksley-220226356')).toBe('220226356')
    expect(listingIdFromRequestPath('/homes-for-sale/bend/providence/1522-locksley-220226356')).toBe('220226356')
    expect(listingIdFromRequestPath('/homes-for-sale/bend/mountain-view/providence/1522-locksley-220226356')).toBe('220226356')
    expect(listingIdFromRequestPath('/homes-for-sale/bend/providence/20260731160357907738000000~1522-locksley')).toBe(
      '20260731160357907738000000',
    )
    expect(listingIdFromRequestPath('/homes-for-sale/bend/55550-heidi-20260418234131878480000000')).toBe(
      '20260418234131878480000000',
    )
    expect(listingIdFromRequestPath('/listing/20260731160357907738000000')).toBe('20260731160357907738000000')
    expect(listingIdFromRequestPath('/homes-for-sale/bend/1522%2Dlocksley-220226356/')).toBe('220226356')
    // Five-digit tail: the page reads it as a legacy zip form, not a key.
    expect(listingIdFromRequestPath('/homes-for-sale/bend/123-main-st-97702')).toBeNull()
  })
})
