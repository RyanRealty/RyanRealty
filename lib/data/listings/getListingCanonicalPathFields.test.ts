import { readFileSync } from 'node:fs'
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

function mockSb(data: unknown) {
  const maybeSingle = vi.fn(async () => ({ data }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { from, select, eq, maybeSingle }
}

const setSb = (v: unknown) => (supabaseAnon as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v)

describe('getListingCanonicalPathFields', () => {
  beforeEach(() => {
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
    const selectArg = sb.select.mock.calls[0]?.[0] as string
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

  it('returns null when the client is unavailable', async () => {
    setSb(null)
    expect(await getListingCanonicalPathFields('RK-1')).toBeNull()
  })
})

describe('listing by-key page uses the slim lookup', () => {
  const src = readFileSync(resolve('app/listing/by-key/[listingKey]/page.tsx'), 'utf8')

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

  it('builds listingDetailPath from the slim columns', () => {
    expect(src).toMatch(/listingDetailPath\(/)
    expect(src).toMatch(/boundary_neighborhood/)
    expect(src).toMatch(/permanentRedirect\(/)
  })
})

