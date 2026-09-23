import { describe, expect, it } from 'vitest'
import { resolvePlatParentCommunity } from './getPlatParentCommunity'

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

describe('resolvePlatParentCommunity (SITE-183 / SITE-182)', () => {
  it('answers the community whose member list holds the plat, durable slug + label', async () => {
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
    const read = async (slug: string) => MEMBERS[slug] ?? []
    await expect(resolvePlatParentCommunity('tetherow-crossing', ENTRIES, read)).resolves.toBeNull()
    await expect(resolvePlatParentCommunity('', ENTRIES, read)).resolves.toBeNull()
  })

  it('lets a failed member read propagate rather than answering a wrong parent', async () => {
    const read = async (slug: string) => {
      if (slug === 'tetherow') throw new Error('rpc down')
      return MEMBERS[slug] ?? []
    }
    await expect(resolvePlatParentCommunity('tennis-tracts-at-broken-top', ENTRIES, read)).rejects.toThrow('rpc down')
  })
})
