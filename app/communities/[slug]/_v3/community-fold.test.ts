import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
const FOLD_CSS = readFileSync(resolve('app/communities/[slug]/_v3/community-fold.css'), 'utf8')

describe('SITE-129 community fold inventory', () => {
  it('imports page-local community-fold.css and hides the Atlas price range', () => {
    expect(PAGE).toMatch(/import '\.\/_v3\/community-fold\.css'/)
    expect(PAGE).toMatch(/className="community-fold"/)
    expect(PAGE).toMatch(/community-fold__drawing/)
    expect(PAGE).toMatch(/<V3Atlas[\s\S]*?hidePriceScrubber/)
    expect(FOLD_CSS).toMatch(/\.community-atlas \.v3-atlas__scrub[\s\S]{0,200}display:\s*none/)
  })

  it('keeps typed stock on the page and does not remount Split search', () => {
    expect(PAGE).toMatch(/<V3PlaceInventory/)
    expect(PAGE).toMatch(/placeStockSectionsFromTiles/)
    expect(PAGE).not.toMatch(/<PlaceSplitView/)
    expect(PAGE).not.toMatch(/MorphingSearch|morphing-search/)
  })

  it('clusters the Caldera island on first paint and hides unpinned plat cards', () => {
    expect(PAGE).toMatch(/clusterCellPx=\{COMMUNITY_FOLD_CLUSTER_CELL_PX\}/)
    expect(PAGE).toMatch(/clusterStageHint=\{COMMUNITY_FOLD_CLUSTER_STAGE\}/)
    expect(FOLD_CSS).toMatch(/\.community-atlas \.v3-atlas__card:not\(\.is-pinned\)/)
    expect(FOLD_CSS).toMatch(/\.community-atlas \.v3-atlas__labels/)
  })
})

describe('SITE-162 community first-look', () => {
  it('opens on V3PlaceLook with priced photo cards, Atlas later', () => {
    expect(PAGE).toMatch(/<V3PlaceLook[\s\S]*?id="place-look"/)
    expect(PAGE).toMatch(/photoCards=\{foldPhotoCards\}/)
    expect(PAGE).toMatch(/placeLookPhotoCards/)
    expect(PAGE).toMatch(/<V3Atlas[\s\S]*?id="atlas"/)
    expect(FOLD_CSS).toMatch(/\.community-fold__drawing \.v3-place-look__map/)
    expect(FOLD_CSS).toMatch(/grid-template-areas:\s*'cards' 'map'/)
    expect(FOLD_CSS).toMatch(/nth-child\(n \+ 3\)/)
    expect(PAGE.indexOf('<V3PlaceLook')).toBeLessThan(PAGE.indexOf('<V3Atlas'))
  })
})
