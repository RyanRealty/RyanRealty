import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Place pages: the living atlas is the map. PlaceSplitView passes listOnly so
 * MapSearchView never mounts SearchMapClustered (the Google canvas). Search
 * filters and the listing list stay.
 */

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

const PLACE_PAGES = [
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
] as const

describe('place Split is list-only; the living atlas owns the map', () => {
  it('PlaceSplitView source contains listOnly', () => {
    const place = readSrc('components/search/PlaceSplitView.tsx')
    expect(place).toMatch(/<MapSearchView[\s\S]*?\blistOnly\b/)
    expect(place).toMatch(/<SearchFilters/)
  })

  it('MapSearchViewProps includes listOnly?: boolean', () => {
    const src = readSrc('components/search/MapSearchView.tsx')
    expect(src).toMatch(/export type MapSearchViewProps = \{/)
    expect(src).toMatch(/listOnly\?: boolean/)
  })

  it('when listOnly, MapSearchView does not render SearchMapClustered', () => {
    const src = readSrc('components/search/MapSearchView.tsx')
    expect(src).toMatch(/const mapPanel = listOnly \? null : \(/)
    const mapPanelAt = src.indexOf('const mapPanel = listOnly ? null')
    const clusteredAt = src.indexOf('<SearchMapClustered')
    expect(mapPanelAt).toBeGreaterThan(-1)
    expect(clusteredAt).toBeGreaterThan(mapPanelAt)
    expect((src.match(/<SearchMapClustered\b/g) ?? []).length).toBe(1)
    expect(src).toMatch(/\{listOnly \? null : \(\s*<div\s+className=\{cn\([\s\S]*?\{mapPanel\}/)
  })

  for (const rel of PLACE_PAGES) {
    it(`${rel} mounts V3Atlas and PlaceSplitView`, () => {
      const src = readSrc(rel)
      expect(src).toMatch(/<V3Atlas/)
      expect(src).toMatch(/<PlaceSplitView/)
    })
  }
})
