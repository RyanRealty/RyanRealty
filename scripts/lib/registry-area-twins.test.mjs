import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CENTRAL_OREGON_CITY_SLUGS } from '../../lib/central-oregon'
import { publicCommunitySlug as tsPublicCommunitySlug } from '../../lib/communities/community-public-pair'
import { isSelfCityCommunity } from '../../lib/communities/self-city-community'
import {
  areaTwinPathsFor,
  isSelfCityEntry,
  loadCentralOregonCitySlugs,
  loadResortRegistry,
  publicCommunitySlug,
  registryAreaTwinRedirects,
} from './registry-area-twins.mjs'

const ROOT = process.cwd()
const registry = loadResortRegistry(ROOT)
const citySlugs = loadCentralOregonCitySlugs(ROOT)
const twins = registryAreaTwinRedirects({ registry, citySlugs })
const committed = JSON.parse(readFileSync(join(ROOT, 'data', 'legacy-redirects.json'), 'utf8'))

describe('registry-area-twins (SITE-183 / SITE-182)', () => {
  it('reads the city slug set out of lib/central-oregon.ts, byte for byte', () => {
    expect([...citySlugs].sort()).toEqual([...CENTRAL_OREGON_CITY_SLUGS].sort())
  })

  it('replicates the public-slug rule of lib/communities/community-public-pair.ts', () => {
    expect(registry.length).toBeGreaterThan(0)
    for (const entry of registry) expect(publicCommunitySlug(entry)).toBe(tsPublicCommunitySlug(entry))
    expect(publicCommunitySlug({ slug: 'pronghorn', label: 'Juniper Preserve' })).toBe('juniper-preserve')
  })

  it('replicates the self-city rule of lib/communities/self-city-community.ts', () => {
    for (const entry of registry) expect(isSelfCityEntry(entry, citySlugs)).toBe(isSelfCityCommunity(entry.slug))
  })

  it('derives one twin per registry city, MLS city and public slug, two segments each', () => {
    for (const entry of registry) {
      const paths = areaTwinPathsFor(entry, citySlugs)
      expect(paths).toContain(`/homes-for-sale/${entry.city_slug}/${entry.slug}`)
      if (isSelfCityCommunity(entry.slug)) expect(paths).toContain(`/homes-for-sale/${entry.slug}/${entry.slug}`)
      for (const p of paths) expect(p.split('/').length).toBe(4)
    }
    expect(twins['/homes-for-sale/bend/broken-top']).toBe('/communities/broken-top')
    expect(twins['/homes-for-sale/bend/tetherow']).toBe('/communities/tetherow')
    expect(twins['/homes-for-sale/bend/pronghorn']).toBe('/communities/juniper-preserve')
    expect(twins['/homes-for-sale/bend/juniper-preserve']).toBe('/communities/juniper-preserve')
    expect(twins['/homes-for-sale/bend/caldera-springs']).toBe('/communities/caldera-springs')
    expect(twins['/homes-for-sale/sunriver/sunriver']).toBe('/communities/sunriver')
    expect(twins['/homes-for-sale/black-butte-ranch/black-butte-ranch']).toBe('/communities/black-butte-ranch')
    expect(twins['/homes-for-sale/sisters/black-butte-ranch']).toBe('/communities/black-butte-ranch')
    expect(twins['/homes-for-sale/terrebonne/crooked-river-ranch']).toBe('/communities/crooked-river-ranch')
    expect(twins['/homes-for-sale/crooked-river-ranch/crooked-river-ranch']).toBe('/communities/crooked-river-ranch')
    // Never a listing URL, never a preset variant.
    expect(Object.keys(twins).some((k) => k.split('/').length !== 4)).toBe(false)
  })

  it('every destination is a live public URL, never itself a redirect key', () => {
    for (const dest of Object.values(twins)) {
      expect(dest).toMatch(/^\/communities\/[a-z0-9-]+$/)
      expect(committed[dest]).toBeUndefined()
    }
  })

  it('the committed map carries every derived twin (regenerate with scripts/build-legacy-redirects.mjs)', () => {
    for (const [path, dest] of Object.entries(twins)) expect(committed[path], path).toBe(dest)
  })
})
