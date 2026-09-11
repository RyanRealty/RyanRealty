import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
const FOLD_CSS = readFileSync(resolve('app/subdivisions/[slug]/_v3/plat-fold.css'), 'utf8')
const PLACE_MOS = readFileSync(resolve('lib/site/place-mos.ts'), 'utf8')
const ALERT_BINDER = readFileSync(
  resolve('app/subdivisions/[slug]/_v3/SubdivisionAlertSheet.client.tsx'),
  'utf8',
)

describe('SITE-86 plat fold composition', () => {
  it('imports page-local plat-fold.css and composes Atlas beside alerts', () => {
    expect(PAGE).toMatch(/import '\.\/_v3\/plat-fold\.css'/)
    expect(PAGE).toMatch(/className="plat-fold"/)
    expect(PAGE).toMatch(/plat-fold__drawing/)
    expect(PAGE).toMatch(/plat-fold__figure/)
    expect(PAGE).toMatch(/place-opening--plat/)
    expect(PAGE).toMatch(/<V3Atlas[\s\S]*?id="atlas"/)
    expect(PAGE).toMatch(/<SubdivisionAlertsStrip[\s\S]*?id="alerts"/)
    expect(PAGE).toMatch(/headlineTone="eyebrow"/)
    expect(PAGE).toMatch(/keyPlacement=/)
    expect(PAGE).toMatch(/claimText=\{/)
  })

  it('shortens the plat photograph so the drawing can own the fold', () => {
    expect(FOLD_CSS).toMatch(/\.place-opening\.place-opening--plat\.place-opening--media/)
    expect(FOLD_CSS).toMatch(/max-height:\s*12rem/)
    expect(FOLD_CSS).toMatch(/\.plat-fold__drawing \.v3-atlas__frame/)
    expect(FOLD_CSS).toMatch(/\.plat-fold__drawing \.v3-atlas__dock/)
  })

  it('puts alerts in the fold figure and never mounts MOS on this grain', () => {
    expect(PAGE).toMatch(/plat-fold__figure/)
    expect(PAGE).toMatch(/foldAtlasDots/)
    expect(PAGE).not.toMatch(/<V3MosBars/)
    expect(PAGE).not.toMatch(/buildPlaceMosView/)
    expect(PAGE).not.toMatch(/platMonthsSupplyFromPace/)
  })

  it('does not mount V3SourceLine as hero under the H1', () => {
    expect(PAGE).not.toMatch(/<V3SourceLine[\s\S]*?mount="hero"/)
    expect(PAGE).toMatch(/<V3SourceLine/)
  })

  it('keeps alerts type toggle and 44px tap targets in the fold figure', () => {
    expect(FOLD_CSS).toMatch(/\.plat-fold__figure \.v3-alerts__types/)
    expect(FOLD_CSS).toMatch(/min-height:\s*var\(--v3-tap\)/)
  })

  it('adds crawlable opening doors for SEO without inventing a portal search hero', () => {
    expect(PAGE).toMatch(/place-opening__caption--doors/)
    expect(PAGE).toMatch(/homes for sale/)
    expect(PAGE).not.toMatch(/MorphingSearch|morphing-search/)
    expect(PAGE).not.toMatch(/parentPulse|leftoverHudKpis/)
  })

  it('binds alerts to this plat filter, not a parent city pulse', () => {
    expect(ALERT_BINDER).toMatch(/subdivision/)
    expect(ALERT_BINDER).toMatch(/submitSearchAlertSignup/)
    expect(ALERT_BINDER).toMatch(/fleet-test|placeAlertsCopy/)
    expect(ALERT_BINDER).not.toMatch(/Redmond pulse|parent pulse/i)
  })
})

describe('SITE-86 REGISTRY §4 — no plat MOS grain', () => {
  it('does not accept subdivision as a PlaceMosGrain', () => {
    expect(PLACE_MOS).not.toMatch(/'subdivision'/)
    expect(PLACE_MOS).not.toMatch(/leftoverHudKpis via/)
  })
})
