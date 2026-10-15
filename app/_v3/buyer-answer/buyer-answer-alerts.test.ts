/**
 * Matt 2026-10-14: every area page carries a quick "get new listings for this
 * area" signup. The buyer-answer page is one shared page for the city,
 * neighborhood and community answer routes, so it mounts the shared strip once,
 * directly after the listings (#homes), from the model's `alert` scope.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve('app/_v3/buyer-answer/BuyerAnswerPage.tsx'), 'utf8')
const LOAD = readFileSync(resolve('lib/buyer-answers/load.ts'), 'utf8')

describe('BuyerAnswerPage listing-alert signup', () => {
  it('mounts one PlaceAlertsStrip as its own section between #homes and #questions', () => {
    expect(PAGE.match(/<PlaceAlertsStrip/g)?.length).toBe(1)
    const homes = PAGE.indexOf('id="homes"')
    const strip = PAGE.indexOf('<PlaceAlertsStrip')
    const questions = PAGE.indexOf('id="questions"')
    expect(homes).toBeGreaterThan(-1)
    expect(strip).toBeGreaterThan(homes)
    expect(questions).toBeGreaterThan(strip)
    expect(PAGE).toMatch(/id="alerts"/)
    // inline only: the sticky repeat is for the type pages
    expect(PAGE).not.toMatch(/stickyAfter/)
  })

  it('renders nothing when the model maps no area', () => {
    expect(PAGE).toMatch(/\{model\.alert \? \(/)
  })

  it('takes every field from the model, never a name of its own', () => {
    expect(PAGE).toMatch(/filters=\{model\.alert\.filters\}/)
    expect(PAGE).toMatch(/placeName=\{model\.alert\.placeName\}/)
    expect(PAGE).toMatch(/browseHref=\{model\.alert\.browseHref\}/)
  })
})

describe('buyer-answer model alert scope', () => {
  it('builds each place kind through the shared scope builders', () => {
    expect(LOAD).toMatch(/communityAlertScope\(\{ community, slug: publicSlug, placeName: publicName \}\)/)
    expect(LOAD).toMatch(/cityAlertScope\(\{ cityName: cityMlsName\(citySlug\), citySlug \}\)/)
    expect(LOAD).toMatch(/bendDistrictAlertScope\(\{ hoodSlug, hoodLabel: district\.label, cityName: 'Bend' \}\)/)
  })

  it('a vs page offers the first place\'s alert', () => {
    expect(LOAD).toMatch(/alert: bundle\.alert,/)
    expect(LOAD).not.toMatch(/alert: otherBundle/)
  })
})
