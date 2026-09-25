import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@/lib/data/client', () => ({ supabaseAnon: () => ({ rpc }) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const ENTRIES = [
  { slug: 'tetherow', label: 'Tetherow' },
  { slug: 'broken-top', label: 'Broken Top' },
  { slug: 'pronghorn', label: 'Juniper Preserve' },
]

const MEMBERS: Record<string, string[]> = {
  tetherow: ['tetherow-phase-1', 'golf-homes-at-tetherow'],
  'broken-top': ['ridge-at-broken-top', 'tennis-tracts-at-broken-top', 'courtyard-garages-at-broken-top'],
  pronghorn: [],
}

describe('resolvePlatParentCommunity, the reference walk (SITE-183 / SITE-182)', () => {
  it('answers the community whose member list holds the plat, durable slug + label', async () => {
    const { resolvePlatParentCommunity } = await import('./getPlatParentCommunity')
    const reads: string[] = []
    const read = async (slug: string) => {
      reads.push(slug)
      return MEMBERS[slug] ?? []
    }
    await expect(resolvePlatParentCommunity('tennis-tracts-at-broken-top', ENTRIES, read)).resolves.toEqual({
      slug: 'broken-top',
      label: 'Broken Top',
    })
    await expect(resolvePlatParentCommunity('golf-homes-at-tetherow', ENTRIES, read)).resolves.toEqual({
      slug: 'tetherow',
      label: 'Tetherow',
    })
    // Stops at the first community that claims the plat.
    expect(reads).toEqual(['tetherow', 'broken-top', 'tetherow'])
  })

  it('never claims a plat by name resemblance', async () => {
    const { resolvePlatParentCommunity } = await import('./getPlatParentCommunity')
    const read = async (slug: string) => MEMBERS[slug] ?? []
    await expect(resolvePlatParentCommunity('tetherow-crossing', ENTRIES, read)).resolves.toBeNull()
    await expect(resolvePlatParentCommunity('', ENTRIES, read)).resolves.toBeNull()
  })

  it('lets a failed member read propagate rather than answering a wrong parent', async () => {
    const { resolvePlatParentCommunity } = await import('./getPlatParentCommunity')
    const read = async (slug: string) => {
      if (slug === 'tetherow') throw new Error('rpc down')
      return MEMBERS[slug] ?? []
    }
    await expect(resolvePlatParentCommunity('tennis-tracts-at-broken-top', ENTRIES, read)).rejects.toThrow('rpc down')
  })
})

describe('getPlatParentCommunity, one RPC (SITE-208)', () => {
  beforeEach(() => {
    vi.resetModules()
    rpc.mockReset()
  })

  it('asks plat_parent_community once, with every registry slug in registry order', async () => {
    const { getPlatParentCommunity } = await import('./getPlatParentCommunity')
    const { getAllResortCommunities } = await import('@/lib/data/communities/registry')
    rpc.mockResolvedValue({ data: [{ geo_slug: 'broken-top' }], error: null })

    const registryOrder = getAllResortCommunities().map((c) => c.slug)
    expect(registryOrder.length).toBeGreaterThan(1)

    await getPlatParentCommunity('  Tennis-Tracts-At-Broken-Top ')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('plat_parent_community', {
      p_plat_slug: 'tennis-tracts-at-broken-top',
      p_community_slugs: registryOrder,
    })
  })

  it('a row answers the registry slug and the registry label, not a database label', async () => {
    const { getPlatParentCommunity } = await import('./getPlatParentCommunity')
    const { getResortCommunityBySlug } = await import('@/lib/data/communities/registry')
    rpc.mockResolvedValue({ data: [{ geo_slug: 'pronghorn' }], error: null })

    await expect(getPlatParentCommunity('some-plat-at-pronghorn')).resolves.toEqual({
      slug: 'pronghorn',
      label: getResortCommunityBySlug('pronghorn')!.label,
    })
  })

  it('no row answers null', async () => {
    const { getPlatParentCommunity } = await import('./getPlatParentCommunity')
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(getPlatParentCommunity('tetherow-crossing')).resolves.toBeNull()
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(getPlatParentCommunity('tetherow-crossing')).resolves.toBeNull()
  })

  it('an empty slug answers null without a call', async () => {
    const { getPlatParentCommunity } = await import('./getPlatParentCommunity')
    await expect(getPlatParentCommunity('   ')).resolves.toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('an RPC error THROWS, so the failure is never cached as "no parent"', async () => {
    const { getPlatParentCommunity } = await import('./getPlatParentCommunity')
    rpc.mockResolvedValue({ data: null, error: { message: 'statement timeout' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getPlatParentCommunity('golf-homes-at-tetherow')).rejects.toThrow(
      /plat_parent_community RPC failed for golf-homes-at-tetherow/,
    )
    spy.mockRestore()
  })

  it('a slug outside the registry THROWS rather than labelling an unknown parent', async () => {
    const { getPlatParentCommunity } = await import('./getPlatParentCommunity')
    rpc.mockResolvedValue({ data: [{ geo_slug: 'century-west' }], error: null })
    await expect(getPlatParentCommunity('golf-homes-at-tetherow')).rejects.toThrow(/not a registry community/)
  })
})
