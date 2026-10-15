/**
 * Matt 2026-10-14: every area page carries a quick "get new listings for this
 * area" signup. A plat page with a map carries SubdivisionAlertsStrip in the
 * fold; a plat page with no map used to show only door buttons. The no-map
 * branch now mounts the shared strip with the same filter the fold strip sends:
 * this city plus this subdivision, every property type.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')

describe('subdivision page signup when there is no map', () => {
  it('mounts the shared strip in the !canMapAtlas branch only, one strip per branch', () => {
    expect(PAGE.match(/<PlaceAlertsStrip/g)?.length).toBe(1)
    expect(PAGE.match(/<SubdivisionAlertsStrip/g)?.length).toBe(1)
    const mapStrip = PAGE.indexOf('<SubdivisionAlertsStrip')
    const noMapStrip = PAGE.indexOf('<PlaceAlertsStrip')
    const elseBranch = PAGE.indexOf(') : (\n          <>\n            <div className="plat-opening__doors">')
    expect(mapStrip).toBeGreaterThan(-1)
    expect(elseBranch).toBeGreaterThan(mapStrip)
    expect(noMapStrip).toBeGreaterThan(elseBranch)
  })

  it('sends the fold strip\'s own filter and skips the strip with no city', () => {
    expect(PAGE).toMatch(/\{placeCity \? \(\s*<PlaceAlertsStrip/)
    expect(PAGE).toMatch(/filters=\{\{ city: placeCity, subdivision: displayName \}\}/)
    // the same values the fold strip gets
    expect(PAGE).toMatch(/subdivision=\{displayName\}/)
    expect(PAGE).toMatch(/placeName=\{displayName\}/)
  })

  it('steps down to ghost under the doors, which carry the page\'s filled button', () => {
    expect(PAGE).toMatch(/<PlaceAlertsStrip[\s\S]*?emphasis="ghost"/)
  })
})
