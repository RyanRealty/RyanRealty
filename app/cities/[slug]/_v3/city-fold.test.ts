import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPlaceMosView } from '@/lib/site/place-mos'

const PAGE = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
const FOLD_CSS = readFileSync(resolve('app/cities/[slug]/_v3/city-fold.css'), 'utf8')
const PLACE_MOS = readFileSync(resolve('lib/site/place-mos.ts'), 'utf8')

describe('SITE-82 city fold composition', () => {
  it('imports page-local city-fold.css and composes Atlas beside CityAlertsStrip', () => {
    expect(PAGE).toMatch(/import '\.\/_v3\/city-fold\.css'/)
    expect(PAGE).toMatch(/className="city-fold"/)
    expect(PAGE).toMatch(/city-fold__drawing/)
    expect(PAGE).toMatch(/city-fold__figure/)
    expect(PAGE).toMatch(/place-opening--city/)
    expect(PAGE).toMatch(/<V3Atlas[\s\S]*?id="atlas"/)
    expect(PAGE).toMatch(/<CityAlertsStrip[\s\S]*?id="alerts"/)
    expect(PAGE).toMatch(/headlineTone="eyebrow"/)
    expect(PAGE).toMatch(/keyPlacement="dock"/)
    expect(PAGE).toMatch(/claimText=\{/)
  })

  it('shortens the city photograph so the drawing can own the fold', () => {
    expect(FOLD_CSS).toMatch(/\.place-opening\.place-opening--city\.place-opening--media/)
    expect(FOLD_CSS).toMatch(/max-height:\s*12rem/)
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__frame/)
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__dock/)
  })

  it('puts MOS + alerts in the fold figure and drops PlaceDoor when MOS publishes', () => {
    expect(PAGE).toMatch(/const placeDoor = placeMos \? null : placeDoorRaw/)
    expect(PAGE).toMatch(/<V3MosBars/)
    expect(PAGE).toMatch(/city-fold__figure/)
    expect(PAGE).toMatch(/foldAtlasDots/)
    // Photograph no longer carries the MOS overlay — fold figure owns it.
    expect(PAGE).toMatch(/<PlaceAreaHero posterSrc=\{stagePosterSrc\} \/>/)
  })

  it('hides Atlas key counts in the fold so MOS owns the inventory numeral', () => {
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__key/)
    expect(FOLD_CSS).toMatch(/display:\s*none/)
  })

  it('keeps alerts type toggle and 44px tap targets in the fold figure', () => {
    expect(FOLD_CSS).toMatch(/\.city-fold__figure \.v3-alerts__types/)
    expect(FOLD_CSS).toMatch(/min-height:\s*var\(--v3-tap\)/)
  })

  it('adds crawlable opening doors for SEO without inventing a portal search hero', () => {
    expect(PAGE).toMatch(/place-opening__caption--doors/)
    expect(PAGE).toMatch(/homes for sale/)
    expect(PAGE).toMatch(/housing-market/)
    expect(PAGE).not.toMatch(/MorphingSearch|morphing-search/)
  })
})

describe('SITE-82 visitor-English MOS source', () => {
  it('never prints leftoverHudKpis or market_metric in the source string', () => {
    expect(PLACE_MOS).not.toMatch(/leftoverHudKpis via/)
    const view = buildPlaceMosView({
      active: 645,
      monthsSupply: 3.7,
      grain: 'city',
      geoSlug: 'bend',
      asOf: 'Sep 10, 2026',
    })
    expect(view).not.toBeNull()
    expect(view!.source).toContain('Oregon Data Share')
    expect(view!.source).toContain('detached single-family')
    expect(view!.source).toContain('as of Sep 10, 2026')
    expect(view!.source).not.toMatch(/leftoverHudKpis/)
    expect(view!.source).not.toMatch(/market_metric/)
    expect(view!.homesValue).toBe(645)
  })

  it('keeps MOS homes-for-sale equal to the HUD active the page already publishes', () => {
    const active = 645
    const view = buildPlaceMosView({
      active,
      monthsSupply: 3.7,
      grain: 'city',
      geoSlug: 'bend',
      asOf: 'Sep 10, 2026',
    })
    expect(view!.homesForSale).toBe(active)
    expect(view!.homesLabel).toBe('645')
  })
})
