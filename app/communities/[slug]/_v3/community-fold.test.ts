import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
const FOLD_CSS = readFileSync(resolve('app/communities/[slug]/_v3/community-fold.css'), 'utf8')

describe('SITE-129 community fold inventory', () => {
  it('imports page-local community-fold.css and hides the Atlas price range', () => {
    expect(PAGE).toMatch(/import '\.\/_v3\/community-fold\.css'/)
    expect(PAGE).toMatch(/className="community-fold"/)
    expect(PAGE).toMatch(/className="place-one-map[ "]/)
    expect(PAGE).toMatch(/<PlaceSubdivisionAtlas[\s\S]*?hidePriceScrubber/)
    expect(FOLD_CSS).toMatch(/\.community-atlas \.v3-atlas__scrub[\s\S]{0,200}display:\s*none/)
  })

  it('keeps typed stock on the page and does not remount Split search', () => {
    expect(PAGE).toMatch(/homes:\s*placeHomes/)
    expect(PAGE).toMatch(/<PlaceSubdivisionHomes/)
    expect(PAGE).toMatch(/placeStockSectionsFromTiles/)
    expect(PAGE).toMatch(/community-field-types/)
    expect(PAGE).toMatch(/communityFieldTypeIndex/)
    expect(PAGE).not.toMatch(/<PlaceSplitView/)
    expect(PAGE).not.toMatch(/MorphingSearch|morphing-search/)
  })

  it('never clamps the belonging facts mid-sentence at 375 (SITE-193)', () => {
    // "$2,052 HOA a year from homes here. 3…" was a one-line clamp inside an
    // 8rem photograph: the facts print whole and the photograph grows instead.
    expect(FOLD_CSS).not.toMatch(/caption--belonging[\s\S]{0,200}line-clamp/)
    expect(FOLD_CSS).toMatch(/place-opening--community\.place-opening--media \{\s*min-height: 6\.5rem;\s*max-height: none;/)
  })

  it('clusters the Caldera island on first paint and hides unpinned plat cards', () => {
    expect(PAGE).toMatch(/clusterCellPx=\{COMMUNITY_FOLD_CLUSTER_CELL_PX\}/)
    expect(PAGE).toMatch(/clusterStageHint=\{COMMUNITY_FOLD_CLUSTER_STAGE\}/)
    expect(FOLD_CSS).toMatch(/\.community-atlas \.v3-atlas__card:not\(\.is-pinned\)/)
    expect(FOLD_CSS).toMatch(/\.community-atlas \.v3-atlas__labels/)
  })
})

describe('community map', () => {
  it('opens on one atlas with the subdivision list and the listing dials under it', () => {
    expect(PAGE).toMatch(/<PlaceSubdivisionAtlas[\s\S]*?id="atlas"/)
    expect(PAGE).toMatch(/<PlaceSubdivisionRail[\s\S]*?id="child-places"/)
    expect(PAGE).toMatch(/<PlaceSubdivisionHomes[\s\S]*?id="homes"/)
    expect(PAGE).toMatch(/nameOnly/)
    expect(PAGE).not.toMatch(/<V3PlaceLook/)
    expect(PAGE).toMatch(/<V3Amenities/)
    expect(PAGE).toMatch(/id="amenities"/)
    expect(PAGE).not.toMatch(/has on the ground/)
    expect(PAGE.indexOf('id="homes"')).toBeLessThan(PAGE.indexOf('id="amenities"'))
    expect(PAGE.indexOf('id="atlas"')).toBeLessThan(PAGE.indexOf('id="homes"'))
  })
})

describe('community opening fold (2026-10-01)', () => {
  it('opens on one composed grid: the paged supply figure, the alerts beside it, the map under the figure', () => {
    expect(PAGE).toMatch(/className="place-one-map place-one-map--fold"/)
    expect(PAGE).toMatch(/<CommunityInsight[\s\S]*?id="place-insight"/)
    expect(PAGE).toMatch(/<CommunityAlertsStrip[\s\S]*?id="alerts"/)
    expect(PAGE.indexOf('id="place-insight"')).toBeLessThan(PAGE.indexOf('id="alerts"'))
    expect(PAGE.indexOf('id="alerts"')).toBeLessThan(PAGE.indexOf('id="atlas"'))
    expect(PAGE.match(/<CommunityAlertsStrip/g) ?? []).toHaveLength(1)
    expect(FOLD_CSS).toMatch(
      /\.place-one-map\.place-one-map--fold \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(20rem, 26rem\);[\s\S]*?'insight ask'[\s\S]*?'map ask'/,
    )
  })

  it('takes months of supply off the photograph and never draws the parent city as bars', () => {
    expect(PAGE).toMatch(/<PlaceAreaHero posterSrc=\{stagePosterSrc\} \/>/)
    expect(PAGE).toMatch(/geoType: 'city' as const, geoSlug: citySlug/)
    expect(PAGE).toMatch(/supplyFloor/)
    expect(PAGE).not.toMatch(/contextMos/)
  })
})
