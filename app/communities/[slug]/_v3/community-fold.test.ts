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
    expect(FOLD_CSS).toMatch(/\.community-fold__drawing \.v3-atlas__scrub[\s\S]{0,200}display:\s*none/)
  })

  it('keeps typed stock on the page and does not remount Split search', () => {
    expect(PAGE).toMatch(/<V3PlaceInventory/)
    expect(PAGE).toMatch(/placeStockSectionsFromTiles/)
    expect(PAGE).not.toMatch(/<PlaceSplitView/)
    expect(PAGE).not.toMatch(/MorphingSearch|morphing-search/)
  })
})
