import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@/lib/data/client', () => ({ supabaseAnon: vi.fn() }))
vi.mock('@/lib/data/cache/unstable-cache', () => ({
  CACHE_WINDOWS: { listingDetail: 60 },
  cacheTag: { listings: 'listings' },
}))
vi.mock('./resolveCanonicalListingKey', () => ({
  resolveCanonicalListingKey: vi.fn(async (k: string) => k.trim()),
}))

import { getListingCanonicalPathFields } from './getListingCanonicalPathFields'
import { supabaseAnon } from '@/lib/data/client'
import { resolveCanonicalListingKey } from './resolveCanonicalListingKey'

const slimRow = {
  ListingKey: 'RK-1',
  ListNumber: '220189422',
  StreetNumber: '123',
  StreetName: 'Main',
  City: 'Bend',
  State: 'OR',
  PostalCode: '97701',
  SubdivisionName: 'Westside',
  boundary_city: 'Bend',
  boundary_neighborhood: 'Old Bend',
  boundary_subdivision: 'Westside',
}

let lastSelect = ''

function mockSb(data: unknown) {
  const maybeSingle = vi.fn(async () => ({ data, error: null }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn((cols: string) => {
    lastSelect = cols
    return { eq }
  })
  const from = vi.fn(() => ({ select }))
  return { from, select, eq, maybeSingle }
}

const setSb = (v: unknown) => (supabaseAnon as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v)

describe('getListingCanonicalPathFields', () => {
  beforeEach(() => {
    lastSelect = ''
    vi.clearAllMocks()
    ;(resolveCanonicalListingKey as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (k: string) => k.trim()
    )
  })

  it('returns null for a blank key without touching the client', async () => {
    setSb(mockSb(null))
    expect(await getListingCanonicalPathFields('   ')).toBeNull()
    expect(supabaseAnon).not.toHaveBeenCalled()
  })

  it('resolves the key then selects only path columns (never *)', async () => {
    const sb = mockSb(slimRow)
    setSb(sb)
    const row = await getListingCanonicalPathFields('220189422')
    expect(resolveCanonicalListingKey).toHaveBeenCalledWith('220189422')
    expect(sb.from).toHaveBeenCalledWith('listings')
    const selectArg = lastSelect
    expect(selectArg).toContain('ListingKey')
    expect(selectArg).toContain('ListNumber')
    expect(selectArg).toContain('StreetNumber')
    expect(selectArg).toContain('StreetName')
    expect(selectArg).toContain('City')
    expect(selectArg).toContain('State')
    expect(selectArg).toContain('PostalCode')
    expect(selectArg).toContain('SubdivisionName')
    expect(selectArg).toContain('boundary_neighborhood')
    expect(selectArg).not.toMatch(/(^|[,\s])\*(?=$|[,\s])/)
    expect(selectArg).not.toContain('PhotoURL')
    expect(selectArg).not.toContain('public_remarks')
    expect(selectArg).not.toContain('ListAgentName')
    expect(sb.eq).toHaveBeenCalledWith('ListingKey', '220189422')
    expect(row).toEqual(slimRow)
  })

  it('returns null when the resolved key has no row', async () => {
    setSb(mockSb(null))
    expect(await getListingCanonicalPathFields('missing')).toBeNull()
  })

  /**
   * IDX display permissions (ODS Rule B/G, NAR 7.58) — added 2026-08-19.
   *
   * getListingDetail already refuses these rows, so the detail page renders
   * "This home may no longer be on the market". This lookup did not, and it
   * feeds /listing/by-key, whose generateMetadata publishes the street address
   * in the <title> and a self-canonical to the pretty URL. Measured live before
   * the gate: https://ryan-realty.com/homes-for-sale/listing/220215050 (MLS
   * 220215050, permit_internet_yn = false) served
   * `<title>1801 Rosa Parks, Portland | …</title>`. 110 rows carry one of these
   * flags today (68 of them Active), so this is a class, not one row.
   */
  it('selects the display-permission columns so the gate has data to read', async () => {
    setSb(mockSb(slimRow))
    await getListingCanonicalPathFields('220189422')
    expect(lastSelect).toContain('permit_internet_yn')
    expect(lastSelect).toContain('permit_address_internet_yn')
    expect(lastSelect).toContain('idx_participant')
  })

  it.each([
    ['permit_internet_yn', 'seller opted out of internet display'],
    ['permit_address_internet_yn', 'seller opted out of address display'],
    ['idx_participant', 'listing broker is not an IDX participant'],
  ])('returns null when %s is false (%s)', async (flag) => {
    setSb(mockSb({ ...slimRow, [flag]: false }))
    expect(await getListingCanonicalPathFields('220189422')).toBeNull()
  })

  it('still returns the row when the permission flags are absent or true', async () => {
    setSb(
      mockSb({
        ...slimRow,
        permit_internet_yn: true,
        permit_address_internet_yn: null,
        idx_participant: null,
      })
    )
    expect(await getListingCanonicalPathFields('220189422')).toEqual(slimRow)
  })

  it('returns null when the client is unavailable', async () => {
    setSb(null)
    expect(await getListingCanonicalPathFields('RK-1')).toBeNull()
  })
})

/**
 * /listing/by-key is a ROUTE HANDLER, not a page (2026-08-19). As a page it
 * ended in permanentRedirect() after two awaits, and the loading.tsx Suspense
 * boundary had already flushed HTTP 200 — measured on production:
 * /listing/by-key/20200228140308644050000000 returned 200, Location: null,
 * zero <h1>. Only the MISS branch worked, which is why the route-smoke gate was
 * green. A route handler owns its whole response and can set Location.
 */
describe('listing by-key handler uses the slim lookup', () => {
  const src = readFileSync(resolve('app/listing/by-key/[listingKey]/route.ts'), 'utf8')

  it('is a route handler, not a page', () => {
    expect(existsSync(resolve('app/listing/by-key/[listingKey]/page.tsx'))).toBe(false)
    expect(src).toMatch(/export async function GET\(/)
  })

  it('imports getListingCanonicalPathFields from the DAL', () => {
    expect(src).toMatch(/import \{ getListingCanonicalPathFields \} from '@\/lib\/data\/listings\/getListingCanonicalPathFields'/)
    expect(src).toMatch(/getListingCanonicalPathFields\(/)
  })

  it('does not pay the wide listing or photo/agent fetch', () => {
    expect(src).not.toMatch(/getListingByKey/)
    expect(src).not.toMatch(/getListingDetailData/)
    expect(src).not.toMatch(/getListingRawRowByKey/)
    expect(src).not.toMatch(/generateListingMetadata/)
    expect(src).not.toMatch(/select\(['"]\*['"]\)/)
  })

  it('builds listingDetailPath from the slim columns and 308s to it', () => {
    expect(src).toMatch(/listingDetailPath\(/)
    expect(src).toMatch(/boundary_neighborhood/)
    expect(src).toMatch(/redirectTo\(canonicalPathFromFields\(row\), 308\)/)
  })

  /**
   * The Location must be ROOT-RELATIVE, the way middleware.ts and next.config.ts
   * redirects() already emit on this site (production 2026-08-20:
   * /subdivisions/tetherow -> `location: /communities/tetherow`).
   *
   * An absolute Location built in a route handler does not track the request.
   * Measured on a production build at :3140: `request.nextUrl.clone()` returned
   * http://localhost:3140/... for a request carrying `Host: ryan-realty.com`,
   * and https://localhost:3140/... once `x-forwarded-proto: https` was added.
   * `new URL(path, request.url)` reads the same origin.
   */
  it('emits a root-relative Location, never an absolute one', () => {
    // Assert on CODE, not on the comment that explains the measurement.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).toMatch(/headers:\s*\{\s*location:/)
    expect(code).not.toMatch(/NextResponse\.redirect\(/)
    expect(code).not.toMatch(/request\.nextUrl/)
    expect(code).not.toMatch(/new URL\(/)
  })

  it('never renders a body — a miss hands off to the /listing refusal page', () => {
    expect(src).not.toMatch(/from 'next\/navigation'/)
    expect(src).toMatch(/redirectTo\(`\/listing\//)
    expect(src).toMatch(/307/)
  })
})

