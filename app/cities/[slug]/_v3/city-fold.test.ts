import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeProjection, padBbox } from '@/lib/geo/project-svg'
import { recordFrame } from '@/lib/geo/record-frame'
import {
  ATLAS_PIN_CLUSTER_CELL_PX,
  CITY_FOLD_CLUSTER_STAGE,
  CITY_FOLD_CLUSTER_STAGE_PHONE,
  clusterAtlasPins,
  projectPinsToFoldStage,
} from '@/lib/atlas/cluster-pins'
import { buildPlaceMosView } from '@/lib/site/place-mos'

const PAGE = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
const ATLAS = readFileSync(resolve('components/site/v3/V3Atlas.client.tsx'), 'utf8')
const FOLD_CSS = readFileSync(resolve('app/cities/[slug]/_v3/city-fold.css'), 'utf8')
const PLACE_MOS = readFileSync(resolve('lib/site/place-mos.ts'), 'utf8')
const INSIGHT = readFileSync(resolve('app/cities/[slug]/_v3/CityInsight.client.tsx'), 'utf8')
const COMBOBOX = readFileSync(resolve('app/cities/[slug]/_v3/CityTypeCombobox.client.tsx'), 'utf8')
const ALERT_SHEET = readFileSync(resolve('app/cities/[slug]/_v3/CityAlertSheet.client.tsx'), 'utf8')

describe('SITE-82 city fold composition', () => {
  it('imports page-local city-fold.css and composes Atlas beside CityAlertsStrip', () => {
    expect(PAGE).toMatch(/import '\.\/_v3\/city-fold\.css'/)
    expect(PAGE).toMatch(/className="city-fold"/)
    expect(PAGE).toMatch(/city-fold__drawing/)
    expect(PAGE).toMatch(/city-fold__figure/)
    expect(PAGE).toMatch(/place-opening--city/)
    expect(PAGE).toMatch(/<V3Atlas[\s\S]*?id="atlas"/)
    expect(PAGE).toMatch(/amenities=\{amenityLayers\}/)
    expect(PAGE).toMatch(/getPlaceAmenityLayers/)
    expect(PAGE).toMatch(/dots=\{foldAtlasDots/)
    expect(PAGE).toMatch(/<CityAlertsStrip[\s\S]*?id="alerts"/)
    expect(PAGE).toMatch(/headlineTone="eyebrow"/)
    expect(PAGE).toMatch(/keyPlacement="dock"/)
    expect(PAGE).toMatch(/claimText=\{/)
    expect(PAGE).not.toMatch(/Scrub price to filter the map/)
  })

  it('shortens the city photograph so the drawing can own the fold', () => {
    expect(FOLD_CSS).toMatch(/\.place-opening\.place-opening--city\.place-opening--media/)
    expect(FOLD_CSS).toMatch(/max-height:\s*12rem/)
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__frame/)
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__dock/)
  })

  it('puts MOS + alerts in the fold figure and drops PlaceDoor when MOS publishes', () => {
    expect(PAGE).toMatch(/const placeDoor = placeMos \? null : placeDoorRaw/)
    // SITE-93: the two named bars are page one of the fold's insight pager, so
    // the page hands them over as props instead of mounting V3MosBars itself.
    expect(PAGE).toMatch(/<CityInsight/)
    expect(PAGE).toMatch(/mos=\{foldMosProps\}/)
    expect(INSIGHT).toMatch(/<V3MosBars/)
    expect(PAGE).toMatch(/city-fold__figure/)
    expect(PAGE).toMatch(/foldAtlasDots/)
    expect(PAGE).toMatch(/dots=\{foldAtlasDots\.length > 0 \? foldAtlasDots : atlasView\.dots\}/)
    expect(PAGE).toMatch(/clusterPins/)
    expect(PAGE).toMatch(/clusterCellPx=\{ATLAS_PIN_CLUSTER_CELL_PX\}/)
    expect(PAGE).toMatch(/clusterStageHint=\{CITY_FOLD_CLUSTER_STAGE\}/)
    expect(PAGE).toMatch(/clusterStageHintPhone=\{CITY_FOLD_CLUSTER_STAGE_PHONE\}/)
    expect(FOLD_CSS).toMatch(/height:\s*min\(38\.125rem,\s*68vh\)/)
    expect(ATLAS).toMatch(/projectPinsToFoldStage/)
    expect(ATLAS).toMatch(/floorCityFoldPaintView/)
    expect(ATLAS).toMatch(/data-atlas-cluster-stage/)
    expect(ATLAS).toMatch(/clusterAtlasPins/)
    expect(ATLAS).toMatch(/data-atlas-cluster/)
    expect(ATLAS).toMatch(/data-atlas-pin-layer/)
    expect(ATLAS).toMatch(/atlasPinShouldPaint\(d\)\) return null/)
    // Photograph no longer carries the MOS overlay — fold figure owns it.
    expect(PAGE).toMatch(/<PlaceAreaHero posterSrc=\{stagePosterSrc\} \/>/)
  })

  it('SITE-93: the fold is drawing | figure | ask, and the figure is the catalog pager', () => {
    expect(PAGE).toMatch(/city-fold__figure city-fold__figure--insight/)
    expect(PAGE).toMatch(/city-fold__figure city-fold__figure--ask/)
    expect(FOLD_CSS).toMatch(/\.city-fold__figure--insight/)
    expect(FOLD_CSS).toMatch(/grid-template-areas:\s*'drawing drawing'/)
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__scrub[\s\S]{0,80}display:\s*none/)
    expect(FOLD_CSS).toMatch(/max-height:\s*min\(68vh,\s*40rem\)/)
    expect(FOLD_CSS).toMatch(/min-height:\s*min\(36vh,\s*16rem\)/)
    // The catalog source itself, imported by the route (ci:catalog-install).
    expect(INSIGHT).toMatch(/from '@\/components\/motion\/insight-cards'/)
    expect(INSIGHT).toMatch(/from '@\/components\/motion\/number'/)
    expect(COMBOBOX).toMatch(/from '@\/components\/motion\/combobox'/)
  })

  it('SITE-93: the alerts type control is the installed combobox, bound by the route', () => {
    expect(ALERT_SHEET).toMatch(/renderTypes=/)
    expect(ALERT_SHEET).toMatch(/<CityTypeCombobox/)
    expect(FOLD_CSS).toMatch(/\.city-fold__figure \.v3-alerts__types/)
  })

  it('SITE-93: the phone keeps the proof cards and the as-of stamp it used to drop', () => {
    // The rule that hid the whole strip (and every source line) below 64rem is
    // gone; two cards and the MOS stamp stay on a phone.
    expect(FOLD_CSS).not.toMatch(/\.city-fold__figure \.v3-alerts__strip \{\s*\n\s*display: none/)
    expect(FOLD_CSS).toMatch(/nth-child\(n \+ 3\)/)
  })

  it('hides Atlas key counts in the fold so MOS owns the inventory numeral', () => {
    expect(FOLD_CSS).toMatch(/\.city-fold__drawing \.v3-atlas__key/)
    expect(FOLD_CSS).toMatch(/display:\s*none/)
  })

  it('keeps a type control and 44px tap targets in the fold figure', () => {
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

describe('SITE-128 city fold pin clustering', () => {
  it('contract: desktop fold stage is 46 / 44 / 2; phone is 14 + 2', () => {
    const houses = JSON.parse(
      readFileSync(resolve('lib/atlas/fixtures/bend-city-fold-houses.json'), 'utf8'),
    ) as { lat: number; lng: number }[]
    expect(houses.length).toBeGreaterThanOrEqual(758)

    const frame = recordFrame(houses, [])
    expect(frame.bbox).not.toBeNull()
    const proj = makeProjection(padBbox(frame.bbox!, 0.1), 1000)
    const projPins = houses.map((d, i) => {
      const [x, y] = proj.toXY(d.lng, d.lat)
      return { i, x, y }
    })

    const desktop = clusterAtlasPins(
      projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE, proj, 1),
      ATLAS_PIN_CLUSTER_CELL_PX,
    )
    expect(desktop).toHaveLength(46)
    expect(desktop.filter((c) => c.count > 1)).toHaveLength(44)
    expect(desktop.filter((c) => c.count === 1)).toHaveLength(2)

    const phone = clusterAtlasPins(
      projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE_PHONE, proj, 1),
      ATLAS_PIN_CLUSTER_CELL_PX,
    )
    expect(phone.filter((c) => c.count > 1)).toHaveLength(14)
    expect(phone.filter((c) => c.count === 1)).toHaveLength(2)
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
