import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
const FOLD_CSS = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-fold.css'), 'utf8')

describe('SITE-128 neighborhood fold Atlas', () => {
  it('uses a dominant map row and hides the price scrubber', () => {
    expect(PAGE).toMatch(/import '\.\/_v3\/neighborhood-fold\.css'/)
    expect(PAGE).toMatch(/className="nbh-fold"/)
    expect(PAGE).toMatch(/<V3PlaceLook[\s\S]*?id="place-look"/)
    expect(PAGE).toMatch(/photoCards=\{foldPhotoCards\}/)
    expect(FOLD_CSS).toMatch(/\.nbh-fold__drawing \.v3-place-look__map/)
    expect(FOLD_CSS).toMatch(/overflow:\s*visible/)
    expect(PAGE).toMatch(/<V3Atlas[\s\S]*?id="atlas"/)
    expect(PAGE).toMatch(/amenities=\{amenityLayers\}/)
    expect(PAGE).toMatch(/getPlaceAmenityLayers/)
    expect(PAGE).not.toMatch(/clusterStageHint/)
    expect(PAGE).not.toMatch(/CITY_FOLD_CLUSTER_STAGE/)
    expect(PAGE).not.toMatch(/clusterStageHintPhone/)
    expect(PAGE).not.toMatch(/Scrub price to filter the map/)
    expect(FOLD_CSS).toMatch(/grid-template-areas:\s*'drawing drawing'/)
    expect(FOLD_CSS).toMatch(/\.nbh-fold__drawing \.v3-atlas__scrub[\s\S]{0,80}display:\s*none/)
    expect(FOLD_CSS).toMatch(/max-height:\s*min\(68vh,\s*40rem\)/)
    expect(FOLD_CSS).toMatch(/min-height:\s*min\(36vh,\s*16rem\)/)
    expect(FOLD_CSS).not.toMatch(/max-height:\s*min\(11vh,\s*4\.5rem\)/)
  })
})
